import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError } from '@/lib/auth'
import { requireUser, requireStudentProfileId, computeProfileCompletion } from '@/lib/api-helpers'
import { normalizeSkill, clearNormalizationCache } from '@/lib/matching'
import { z } from 'zod'

const addSchema = z.object({
  skillName: z.string().min(1),
  selfRated: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
})

// GET /api/student/skills — STUDENT only. List own skills with skill display name and isVerified flag.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req)
    const spId = await requireStudentProfileId(user)

    const skills = await db.studentSkill.findMany({
      where: { studentId: spId },
      include: {
        skill: { select: { id: true, displayName: true, category: true } },
      },
      orderBy: { addedAt: 'desc' },
    })

    const data = skills.map(s => ({
      id: s.id,
      skillId: s.skillId,
      name: s.skill.displayName,
      category: s.skill.category,
      selfRated: s.selfRated,
      isVerified: s.isVerified,
      source: s.source,
      addedAt: s.addedAt,
    }))

    return Response.json({ data })
  } catch (err) {
    return errorResponse(err)
  }
}

// POST /api/student/skills — STUDENT only. Body: { skillName, selfRated? }.
// Normalize the skill name; must resolve to canonical. Return created or existing.
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req)
    const spId = await requireStudentProfileId(user)

    const body = await req.json()
    const parsed = addSchema.safeParse(body)
    if (!parsed.success) {
      throw new ResponseError(400, 'Invalid input: ' + (parsed.error.issues[0]?.message ?? 'validation error'))
    }
    clearNormalizationCache()
    const canonical = await normalizeSkill(parsed.data.skillName)
    if (!canonical) {
      throw new ResponseError(400, `Cannot resolve skill "${parsed.data.skillName}" to a known canonical skill`)
    }

    // Find existing
    const existing = await db.studentSkill.findFirst({
      where: { studentId: spId, skillId: canonical.skillId },
      include: { skill: { select: { displayName: true, category: true } } },
    })
    if (existing) {
      return Response.json({
        id: existing.id,
        skillId: existing.skillId,
        name: existing.skill.displayName,
        category: existing.skill.category,
        selfRated: existing.selfRated,
        isVerified: existing.isVerified,
        source: existing.source,
        addedAt: existing.addedAt,
        message: 'Already added',
      })
    }

    const created = await db.studentSkill.create({
      data: {
        studentId: spId,
        skillId: canonical.skillId,
        selfRated: parsed.data.selfRated ?? null,
        isClaimed: true,
        isVerified: false,
        source: 'self',
      },
      include: { skill: { select: { displayName: true, category: true } } },
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

    return Response.json({
      id: created.id,
      skillId: created.skillId,
      name: created.skill.displayName,
      category: created.skill.category,
      selfRated: created.selfRated,
      isVerified: created.isVerified,
      source: created.source,
      addedAt: created.addedAt,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
