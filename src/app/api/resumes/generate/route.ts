import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError } from '@/lib/auth'
import { requireUser, requireStudentProfileId } from '@/lib/api-helpers'
import {
  validateSkillClaim,
  validateProjectClaim,
  validateCertificationClaim,
  validateAssessmentClaim,
  isRejectedStatus,
  type EvidenceWithSkills,
  type ClaimStatus,
} from '@/lib/evidence-validation'
import { z } from 'zod'

const generateSchema = z.object({
  jobId: z.string().optional(),
  title: z.string().max(200).optional(),
})

// POST /api/resumes/generate — STUDENT only. Body: { jobId?, title? }.
//
// Generate a resume using template + verified evidence. Pulls student
// profile, education, evidence with skills, projects, assessment results
// from the database, then validates every claim against the
// evidence-validation library (src/lib/evidence-validation.ts).
//
// Per spec section 5 (P2 fix):
//   1. Resolve evidence references from trusted server-side records. ✓
//   2. Confirm records exist. ✓ (validateProjectClaim / validateAssessmentClaim)
//   3. Confirm they belong to the correct student. ✓ (loaded via student.evidence)
//   4. Confirm they relate to the specific project/cert/assessment/skill claim. ✓
//   5. Check their actual verification/review status. ✓
//
// Claim statuses: SUPPORTED | NEEDS_REVIEW | UNSUPPORTED
// A supported claim has appropriate verified evidence + relevant relationship.
// Pending evidence → NEEDS_REVIEW (NOT supported).
// Missing / rejected / cross-student / unrelated evidence → UNSUPPORTED.
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

    // Load full student data — all evidence loaded here belongs to this student
    // by Prisma relation, so cross-student evidence concerns are handled at the
    // data-loading layer.
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

    // Build the typed evidence list once — used by all validators
    const studentEvidence: EvidenceWithSkills[] = student.evidence.map(e => ({
      ...e,
      skills: e.skills.map(es => ({ skillId: es.skillId, relevance: es.relevance })),
    }))

    // ---------- SKILLS SECTION ----------
    // Each skill is validated against the student's evidence records that
    // link to that specific skill. Self-declared skills without verified
    // evidence are filtered out (they appear as NEEDS_REVIEW only if they
    // have pending evidence — otherwise they are excluded entirely).
    const skillsSection: Array<{
      skillId: string; name: string; level: string | null
      isVerified: boolean; evidenceIds: string[]; claimStatus: ClaimStatus
      reason: string
    }> = []
    for (const ss of student.skills) {
      const claim = validateSkillClaim(ss.skillId, studentEvidence)
      // Include skills that are SUPPORTED or NEEDS_REVIEW.
      // Exclude UNSUPPORTED skills (no evidence at all or all rejected).
      if (claim.status === 'UNSUPPORTED') {
        // Self-declared skills without evidence are NOT included in the
        // generated resume — they would be unsupported claims.
        // (Per spec: "Do not invent proficiency" + "Mark unsupported claim for review or exclude")
        continue
      }
      skillsSection.push({
        skillId: ss.skillId,
        name: ss.skill.displayName,
        level: ss.selfRated ?? null,
        isVerified: claim.status === 'SUPPORTED',
        evidenceIds: claim.evidenceIds,
        claimStatus: claim.status,
        reason: claim.reason,
      })
    }

    // ---------- PROJECTS SECTION ----------
    // SECURITY (P2 fix): each project is validated against its SPECIFICALLY
    // linked evidence record (Project.evidenceId). We no longer
    // indiscriminately attach all project/github/demo evidence to every
    // project.
    const projectsSection: Array<{
      projectId: string; title: string; description: string
      repoUrl: string | null; demoUrl: string | null
      role: string | null; teamSize: number | null
      evidenceIds: string[]; claimStatus: ClaimStatus; reason: string
    }> = []
    for (const p of student.projects) {
      const claim = validateProjectClaim(p, studentEvidence)
      projectsSection.push({
        projectId: p.id,
        title: p.title,
        description: p.description,
        repoUrl: p.repoUrl,
        demoUrl: p.demoUrl,
        role: p.role,
        teamSize: p.teamSize,
        evidenceIds: claim.evidenceIds,
        claimStatus: claim.status,
        reason: claim.reason,
      })
    }

    // ---------- CERTIFICATIONS SECTION ----------
    // Only certification-type evidence records. Rejected/needs-more are excluded.
    const certificationsSection: Array<{
      title: string; organization: string | null
      evidenceId: string | null; claimStatus: ClaimStatus; reason: string
    }> = []
    const certEvidence = studentEvidence.filter(e => e.type === 'certification')
    for (const c of certEvidence) {
      if (isRejectedStatus(c.status)) continue
      const claim = validateCertificationClaim(c)
      certificationsSection.push({
        title: c.title,
        organization: c.organization,
        evidenceId: claim.evidenceIds[0] ?? null,
        claimStatus: claim.status,
        reason: claim.reason,
      })
    }

    // ---------- ASSESSMENTS SECTION ----------
    // SECURITY (P2 fix): each assessment result is validated by looking up
    // its linked evidence record (if any), confirming the evidence exists,
    // belongs to the student, is of type 'assessment', and checking its
    // verification status.
    const assessmentsSection: Array<{
      name: string; organization: string | null
      score: number; maxScore: number; percentile: number | null
      date: Date; evidenceId: string | null
      claimStatus: ClaimStatus; reason: string
    }> = []
    for (const ar of student.assessments) {
      const claim = validateAssessmentClaim(ar, studentEvidence)
      assessmentsSection.push({
        name: ar.assessment.name,
        organization: ar.assessment.organization,
        score: ar.score,
        maxScore: ar.assessment.maxScore,
        percentile: ar.percentile,
        date: ar.date,
        evidenceId: ar.evidenceId,
        claimStatus: claim.status,
        reason: claim.reason,
      })
    }

    // ---------- EDUCATION SECTION ----------
    const educationSection = student.education.map(ed => ({
      degree: ed.degree,
      institution: ed.institution,
      startYear: ed.startYear,
      endYear: ed.endYear,
      score: ed.score,
      scoreType: ed.scoreType,
      field: ed.field,
    }))

    // ---------- SUMMARY ----------
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

    // ---------- COMPOSE BULLETS ----------
    type Bullet = {
      section: string
      text: string
      skillIds: string[] | null
      evidenceIds: string[] | null
      claimStatus: ClaimStatus
      reason: string
      orderIndex: number
    }
    const bullets: Bullet[] = []
    let orderIndex = 0

    // Education (always SUPPORTED — comes from the student's own profile)
    for (const ed of educationSection) {
      bullets.push({
        section: 'education',
        text: `${ed.degree}, ${ed.institution} (${ed.startYear}–${ed.endYear}) — ${ed.score ?? 'N/A'}${ed.scoreType ? ' ' + ed.scoreType : ''}${ed.field ? ', ' + ed.field : ''}`,
        skillIds: null,
        evidenceIds: null,
        claimStatus: 'SUPPORTED',
        reason: 'Education record from student profile.',
        orderIndex: orderIndex++,
      })
    }
    // Skills
    for (const s of skillsSection) {
      const tag = s.claimStatus === 'NEEDS_REVIEW' ? ' [Pending review]' : ''
      bullets.push({
        section: 'skills',
        text: `${s.name}${s.level ? ` (${s.level})` : ''}${tag}`,
        skillIds: [s.skillId],
        evidenceIds: s.evidenceIds.length > 0 ? s.evidenceIds : null,
        claimStatus: s.claimStatus,
        reason: s.reason,
        orderIndex: orderIndex++,
      })
    }
    // Projects
    for (const p of projectsSection) {
      const tag = p.claimStatus === 'NEEDS_REVIEW'
        ? ' [Pending review]'
        : p.claimStatus === 'UNSUPPORTED' ? ' [Unverified]' : ''
      bullets.push({
        section: 'projects',
        text: `${p.title}${p.role ? ' — ' + p.role : ''}: ${p.description}${tag}`,
        skillIds: null,
        evidenceIds: p.evidenceIds.length > 0 ? p.evidenceIds : null,
        claimStatus: p.claimStatus,
        reason: p.reason,
        orderIndex: orderIndex++,
      })
    }
    // Certifications
    for (const c of certificationsSection) {
      const tag = c.claimStatus === 'NEEDS_REVIEW'
        ? ' [Pending review]'
        : c.claimStatus === 'UNSUPPORTED' ? ' [Unverified]' : ''
      bullets.push({
        section: 'certifications',
        text: `${c.title}${c.organization ? ' — ' + c.organization : ''}${tag}`,
        skillIds: null,
        evidenceIds: c.evidenceId ? [c.evidenceId] : null,
        claimStatus: c.claimStatus,
        reason: c.reason,
        orderIndex: orderIndex++,
      })
    }
    // Assessments
    for (const a of assessmentsSection) {
      const tag = a.claimStatus === 'NEEDS_REVIEW'
        ? ' [Pending review]'
        : a.claimStatus === 'UNSUPPORTED' ? ' [Unverified]' : ''
      bullets.push({
        section: 'experience',
        text: `${a.name}${a.organization ? ' (' + a.organization + ')' : ''}: ${a.score}/${a.maxScore}${a.percentile ? ', ' + a.percentile + 'th percentile' : ''}${tag}`,
        skillIds: null,
        evidenceIds: a.evidenceId ? [a.evidenceId] : null,
        claimStatus: a.claimStatus,
        reason: a.reason,
        orderIndex: orderIndex++,
      })
    }

    // ---------- VERSION + PERSIST ----------
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
          skills: {
            supported: skillsSection.filter(s => s.claimStatus === 'SUPPORTED').length,
            needs_review: skillsSection.filter(s => s.claimStatus === 'NEEDS_REVIEW').length,
            unsupported_excluded: student.skills.length - skillsSection.length,
          },
          projects: {
            supported: projectsSection.filter(p => p.claimStatus === 'SUPPORTED').length,
            needs_review: projectsSection.filter(p => p.claimStatus === 'NEEDS_REVIEW').length,
            unsupported: projectsSection.filter(p => p.claimStatus === 'UNSUPPORTED').length,
          },
          certifications: {
            supported: certificationsSection.filter(c => c.claimStatus === 'SUPPORTED').length,
            needs_review: certificationsSection.filter(c => c.claimStatus === 'NEEDS_REVIEW').length,
            unsupported: certificationsSection.filter(c => c.claimStatus === 'UNSUPPORTED').length,
          },
          assessments: {
            supported: assessmentsSection.filter(a => a.claimStatus === 'SUPPORTED').length,
            needs_review: assessmentsSection.filter(a => a.claimStatus === 'NEEDS_REVIEW').length,
            unsupported: assessmentsSection.filter(a => a.claimStatus === 'UNSUPPORTED').length,
          },
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
      content,
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
