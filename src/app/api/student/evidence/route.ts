import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError } from '@/lib/auth'
import { requireUser, requireStudentProfileId, getOfficerUserIds, notifyUsers, computeProfileCompletion } from '@/lib/api-helpers'
import { normalizeSkills, clearNormalizationCache } from '@/lib/matching'
import { z } from 'zod'

const evidenceTypes = ['assessment', 'project', 'github', 'certification', 'demo_url', 'report', 'feedback'] as const

const createSchema = z.object({
  type: z.enum(evidenceTypes),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  sourceUrl: z.string().url().optional().or(z.literal('')),
  organization: z.string().optional(),
  assessor: z.string().optional(),
  score: z.number().min(0).optional(),
  maxScore: z.number().min(0).optional(),
  skillNames: z.array(z.string().min(1)).min(1).max(20),
})

// GET /api/student/evidence — STUDENT only. List own evidence with skills.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req)
    const spId = await requireStudentProfileId(user)

    const evidence = await db.evidence.findMany({
      where: { studentId: spId },
      include: {
        skills: {
          include: { skill: { select: { id: true, displayName: true, category: true } } },
        },
      },
      orderBy: { submittedAt: 'desc' },
    })

    const data = evidence.map(e => ({
      id: e.id,
      type: e.type,
      title: e.title,
      description: e.description,
      sourceUrl: e.sourceUrl,
      organization: e.organization,
      assessor: e.assessor,
      score: e.score,
      maxScore: e.maxScore,
      status: e.status,
      submittedAt: e.submittedAt,
      reviewedAt: e.reviewedAt,
      reviewerNotes: e.reviewerNotes,
      skills: e.skills.map(es => ({
        skillId: es.skillId,
        name: es.skill.displayName,
        category: es.skill.category,
        relevance: es.relevance,
      })),
    }))

    return Response.json({ data })
  } catch (err) {
    return errorResponse(err)
  }
}

// POST /api/student/evidence — STUDENT only. Body schema above.
// Normalize skill names, create EvidenceSkill rows. Status='PENDING_REVIEW'.
// Notify all OFFICER users.
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req)
    const spId = await requireStudentProfileId(user)

    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      throw new ResponseError(400, 'Invalid input: ' + (parsed.error.issues[0]?.message ?? 'validation error'))
    }
    const data = parsed.data

    clearNormalizationCache()
    const normalized = await normalizeSkills(data.skillNames)
    const resolved = normalized.filter(n => n.canonical)
    if (resolved.length === 0) {
      throw new ResponseError(400, 'None of the provided skill names could be normalized to a canonical skill')
    }

    const evidence = await db.evidence.create({
      data: {
        studentId: spId,
        type: data.type,
        title: data.title,
        description: data.description ?? null,
        sourceUrl: data.sourceUrl ? data.sourceUrl : null,
        organization: data.organization ?? null,
        assessor: data.assessor ?? null,
        score: data.score ?? null,
        maxScore: data.maxScore ?? null,
        status: 'PENDING_REVIEW',
        provenance: JSON.stringify({ submittedBy: user.id, source: 'self', submittedAt: new Date().toISOString() }),
        skills: {
          create: resolved.map(r => ({
            skillId: r.canonical!.skillId,
            relevance: 1.0,
          })),
        },
      },
      include: {
        skills: {
          include: { skill: { select: { id: true, displayName: true, category: true } } },
        },
      },
    })

    // Update profile completion
    const [skillsCount, evidenceCount, profile] = await Promise.all([
      db.studentSkill.count({ where: { studentId: spId } }),
      db.evidence.count({ where: { studentId: spId } }),
      db.studentProfile.findUnique({ where: { id: spId } }),
    ])
    if (profile) {
      const profileCompletion = computeProfileCompletion(profile, skillsCount, evidenceCount)
      await db.studentProfile.update({
        where: { id: spId },
        data: { profileCompletion },
      })
    }

    // Notify all officers
    const officerIds = await getOfficerUserIds()
    await notifyUsers(officerIds, {
      type: 'evidence_status',
      title: 'New evidence submitted for review',
      message: `${data.title} (${data.type})`,
      link: `/evidence/${evidence.id}`,
    })

    // Audit log
    await db.auditEvent.create({
      data: {
        actorId: user.id,
        action: 'EVIDENCE_SUBMITTED',
        targetType: 'Evidence',
        targetId: evidence.id,
        metadata: JSON.stringify({ title: data.title, type: data.type }),
      },
    })

    return Response.json({
      id: evidence.id,
      type: evidence.type,
      title: evidence.title,
      description: evidence.description,
      sourceUrl: evidence.sourceUrl,
      organization: evidence.organization,
      assessor: evidence.assessor,
      score: evidence.score,
      maxScore: evidence.maxScore,
      status: evidence.status,
      submittedAt: evidence.submittedAt,
      skills: evidence.skills.map(es => ({
        skillId: es.skillId,
        name: es.skill.displayName,
        category: es.skill.category,
        relevance: es.relevance,
      })),
      unresolvedSkills: normalized
        .filter(n => !n.canonical)
        .map(n => ({ rawName: n.rawName, reason: 'NO_CANONICAL_MATCH' })),
    })
  } catch (err) {
    return errorResponse(err)
  }
}
