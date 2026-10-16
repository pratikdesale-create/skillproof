import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError } from '@/lib/auth'
import { requireUser, requireStudentProfileId } from '@/lib/api-helpers'
import { z } from 'zod'

const generateSchema = z.object({
  jobId: z.string().optional(),
  title: z.string().max(200).optional(),
})

const EVIDENCE_VALUE_FOR_RESUME: Record<string, number> = {
  VERIFIED: 1.0,
  PENDING_REVIEW: 0.25,
  UNVERIFIED: 0.25,
  REJECTED: 0,
  NEEDS_MORE_EVIDENCE: 0,
}

// POST /api/resumes/generate — STUDENT only. Body: { jobId?, title? }.
// Generate a resume using template + verified evidence. Pull student profile,
// education, verified evidence with skills, projects, assessment results.
// Build resume "content" JSON with sections: summary, skills, experience,
// projects (with evidence links), certifications.
// For each bullet, store supporting evidence IDs. For unsupported claims,
// mark claimStatus='UNSUPPORTED' and exclude from the resume or include with explicit "Unverified" flag.
// Save Resume + ResumeBullet rows. Return the full resume with bullets.
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req)
    const spId = await requireStudentProfileId(user)

    const body = await req.json()
    const parsed = generateSchema.safeParse(body)
    if (!parsed.success) {
      throw new ResponseError(400, 'Invalid input: ' + (parsed.error.issues[0]?.message ?? 'validation error'))
    }
    const { jobId, title } = parsed.data

    // Load full student data
    const student = await db.studentProfile.findUnique({
      where: { id: spId },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        education: { orderBy: { startYear: 'desc' } },
        projects: { orderBy: { createdAt: 'desc' } },
        evidence: {
          include: {
            skills: { include: { skill: { select: { id: true, displayName: true } } } },
          },
          orderBy: { submittedAt: 'desc' },
        },
        assessments: {
          include: {
            assessment: { select: { name: true, organization: true, maxScore: true } },
          },
          orderBy: { date: 'desc' },
        },
        skills: {
          include: { skill: { select: { id: true, displayName: true } } },
        },
      },
    })
    if (!student) throw new ResponseError(404, 'Student profile not found')

    // Identify supported skills (have at least one verified evidence) OR self-rated intermediate/advanced
    const skillToEvidenceMap = new Map<string, { status: string; evidenceId: string; title: string; type: string; }[]>()
    for (const e of student.evidence) {
      for (const es of e.skills) {
        const arr = skillToEvidenceMap.get(es.skillId) ?? []
        arr.push({
          status: e.status,
          evidenceId: e.id,
          title: e.title,
          type: e.type,
        })
        skillToEvidenceMap.set(es.skillId, arr)
      }
    }

    const skillsSection: Array<{ skillId: string; name: string; level: string | null; isVerified: boolean; evidenceIds: string[]; claimStatus: string }> = []
    for (const ss of student.skills) {
      const ev = skillToEvidenceMap.get(ss.skillId) ?? []
      const verifiedEv = ev.filter(e => EVIDENCE_VALUE_FOR_RESUME[e.status] >= 1.0)
      const isVerified = verifiedEv.length > 0
      // Include if verified OR self-rated intermediate/advanced
      const includeable = isVerified || ss.selfRated === 'intermediate' || ss.selfRated === 'advanced'
      if (!includeable) continue
      skillsSection.push({
        skillId: ss.skillId,
        name: ss.skill.displayName,
        level: ss.selfRated ?? null,
        isVerified,
        evidenceIds: verifiedEv.map(e => e.evidenceId),
        claimStatus: isVerified ? 'SUPPORTED' : 'UNSUPPORTED',
      })
    }

    // Projects section — supported by project/github evidence
    const projectsSection: Array<{ projectId: string; title: string; description: string; repoUrl: string | null; demoUrl: string | null; role: string | null; teamSize: number | null; evidenceIds: string[]; claimStatus: string }> = []
    for (const p of student.projects) {
      const linkedEvidence = student.evidence
        .filter(e => e.type === 'project' || e.type === 'github' || e.type === 'demo_url')
        .filter(e => e.status !== 'REJECTED' && e.status !== 'NEEDS_MORE_EVIDENCE')
      const evidenceIds = linkedEvidence.map(e => e.id)
      projectsSection.push({
        projectId: p.id,
        title: p.title,
        description: p.description,
        repoUrl: p.repoUrl,
        demoUrl: p.demoUrl,
        role: p.role,
        teamSize: p.teamSize,
        evidenceIds,
        claimStatus: evidenceIds.length > 0 ? 'SUPPORTED' : 'UNSUPPORTED',
      })
    }

    // Certifications section — supported by certification evidence (verified only)
    const certificationsSection: Array<{ title: string; organization: string | null; evidenceId: string | null; claimStatus: string }> = []
    const certEvidence = student.evidence.filter(e => e.type === 'certification')
    for (const c of certEvidence) {
      if (c.status === 'REJECTED' || c.status === 'NEEDS_MORE_EVIDENCE') continue
      certificationsSection.push({
        title: c.title,
        organization: c.organization,
        evidenceId: c.id,
        claimStatus: c.status === 'VERIFIED' ? 'SUPPORTED' : 'UNSUPPORTED',
      })
    }

    // Assessment results section
    const assessmentsSection: Array<{ name: string; organization: string | null; score: number; maxScore: number; percentile: number | null; date: Date; evidenceId: string | null; claimStatus: string }> = []
    for (const ar of student.assessments) {
      assessmentsSection.push({
        name: ar.assessment.name,
        organization: ar.assessment.organization,
        score: ar.score,
        maxScore: ar.assessment.maxScore,
        percentile: ar.percentile,
        date: ar.date,
        evidenceId: ar.evidenceId,
        claimStatus: ar.evidenceId ? 'SUPPORTED' : 'UNSUPPORTED',
      })
    }

    // Education section
    const educationSection = student.education.map(ed => ({
      degree: ed.degree,
      institution: ed.institution,
      startYear: ed.startYear,
      endYear: ed.endYear,
      score: ed.score,
      scoreType: ed.scoreType,
      field: ed.field,
    }))

    // Summary
    const summary =
      student.bio ??
      `${student.user.name} — ${student.branch ?? 'Student'} from ${student.university ?? 'university'}, batch ${student.batch ?? 'N/A'}, CGPA ${student.cgpa ?? 'N/A'}.`

    const content = {
      student: {
        name: student.user.name,
        email: student.user.email,
        phone: student.user.phone,
        location: student.location,
        linkedinUrl: student.linkedinUrl,
        githubUser: student.githubUser,
        portfolioUrl: student.portfolioUrl,
      },
      summary,
      skills: skillsSection,
      education: educationSection,
      projects: projectsSection,
      certifications: certificationsSection,
      assessments: assessmentsSection,
    }

    // Compose bullets (one per item in each section)
    type Bullet = {
      section: string
      text: string
      skillIds: string[] | null
      evidenceIds: string[] | null
      claimStatus: string
      orderIndex: number
    }
    const bullets: Bullet[] = []
    let orderIndex = 0
    for (const ed of educationSection) {
      bullets.push({
        section: 'education',
        text: `${ed.degree}, ${ed.institution} (${ed.startYear}–${ed.endYear}) — ${ed.score ?? 'N/A'}${ed.scoreType ? ' ' + ed.scoreType : ''}${ed.field ? ', ' + ed.field : ''}`,
        skillIds: null,
        evidenceIds: null,
        claimStatus: 'SUPPORTED',
        orderIndex: orderIndex++,
      })
    }
    for (const s of skillsSection) {
      bullets.push({
        section: 'skills',
        text: `${s.name}${s.level ? ` (${s.level})` : ''}${s.isVerified ? '' : ' [Unverified]'}`,
        skillIds: [s.skillId],
        evidenceIds: s.evidenceIds.length > 0 ? s.evidenceIds : null,
        claimStatus: s.claimStatus,
        orderIndex: orderIndex++,
      })
    }
    for (const p of projectsSection) {
      bullets.push({
        section: 'projects',
        text: `${p.title}${p.role ? ' — ' + p.role : ''}: ${p.description}${p.evidenceIds.length === 0 ? ' [Unverified]' : ''}`,
        skillIds: null,
        evidenceIds: p.evidenceIds.length > 0 ? p.evidenceIds : null,
        claimStatus: p.claimStatus,
        orderIndex: orderIndex++,
      })
    }
    for (const c of certificationsSection) {
      bullets.push({
        section: 'certifications',
        text: `${c.title}${c.organization ? ' — ' + c.organization : ''}${c.claimStatus === 'UNSUPPORTED' ? ' [Unverified]' : ''}`,
        skillIds: null,
        evidenceIds: c.evidenceId ? [c.evidenceId] : null,
        claimStatus: c.claimStatus,
        orderIndex: orderIndex++,
      })
    }
    for (const a of assessmentsSection) {
      bullets.push({
        section: 'experience',
        text: `${a.name}${a.organization ? ' (' + a.organization + ')' : ''}: ${a.score}/${a.maxScore}${a.percentile ? ', ' + a.percentile + 'th percentile' : ''}${a.claimStatus === 'UNSUPPORTED' ? ' [Unverified]' : ''}`,
        skillIds: null,
        evidenceIds: a.evidenceId ? [a.evidenceId] : null,
        claimStatus: a.claimStatus,
        orderIndex: orderIndex++,
      })
    }

    // Determine version (increment for same student+job)
    const existing = await db.resume.findMany({
      where: { studentId: spId, jobId: jobId ?? null },
      select: { version: true },
      orderBy: { version: 'desc' },
    })
    const nextVersion = existing.length > 0 ? existing[0].version + 1 : 1

    const resume = await db.resume.create({
      data: {
        studentId: spId,
        jobId: jobId ?? null,
        version: nextVersion,
        title: title ?? `Resume v${nextVersion}`,
        summary,
        content: JSON.stringify(content),
        isGenerated: true,
        claimValidation: JSON.stringify({
          skillsSection: { supported: skillsSection.filter(s => s.claimStatus === 'SUPPORTED').length, unsupported: skillsSection.filter(s => s.claimStatus === 'UNSUPPORTED').length },
          projectsSection: { supported: projectsSection.filter(p => p.claimStatus === 'SUPPORTED').length, unsupported: projectsSection.filter(p => p.claimStatus === 'UNSUPPORTED').length },
          certificationsSection: { supported: certificationsSection.filter(c => c.claimStatus === 'SUPPORTED').length, unsupported: certificationsSection.filter(c => c.claimStatus === 'UNSUPPORTED').length },
          assessmentsSection: { supported: assessmentsSection.filter(a => a.claimStatus === 'SUPPORTED').length, unsupported: assessmentsSection.filter(a => a.claimStatus === 'UNSUPPORTED').length },
        }),
        bullets: {
          create: bullets.map(b => ({
            section: b.section,
            text: b.text,
            skillIds: b.skillIds ? JSON.stringify(b.skillIds) : null,
            evidenceIds: b.evidenceIds ? JSON.stringify(b.evidenceIds) : null,
            claimStatus: b.claimStatus,
            orderIndex: b.orderIndex,
          })),
        },
      },
      include: {
        bullets: { orderBy: { orderIndex: 'asc' } },
      },
    })

    return Response.json({
      id: resume.id,
      title: resume.title,
      version: resume.version,
      isGenerated: resume.isGenerated,
      summary: resume.summary,
      content, // already parsed
      claimValidation: JSON.parse(resume.claimValidation ?? '{}'),
      bullets: resume.bullets.map(b => ({
        id: b.id,
        section: b.section,
        text: b.text,
        skillIds: b.skillIds ? JSON.parse(b.skillIds) : [],
        evidenceIds: b.evidenceIds ? JSON.parse(b.evidenceIds) : [],
        claimStatus: b.claimStatus,
        orderIndex: b.orderIndex,
      })),
    }, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
