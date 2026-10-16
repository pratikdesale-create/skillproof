import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError, requireRole } from '@/lib/auth'
import { requireUser, requireStudentProfileId } from '@/lib/api-helpers'

// GET /api/students/[id] — OFFICER, RECRUITER, or owner student
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser(req)
    const { id } = await params

    if (user.role === 'STUDENT') {
      const spId = await requireStudentProfileId(user)
      if (spId !== id) throw new ResponseError(403, 'Not your profile')
    } else {
      requireRole(user, 'OFFICER', 'RECRUITER', 'ADMIN')
    }

    const profile = await db.studentProfile.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true, phone: true } },
        skills: {
          include: {
            skill: { select: { id: true, displayName: true, category: true } },
          },
          orderBy: { addedAt: 'desc' },
        },
        evidence: {
          select: {
            id: true, type: true, title: true, status: true, submittedAt: true,
            sourceUrl: true, organization: true, score: true, maxScore: true,
          },
          orderBy: { submittedAt: 'desc' },
        },
        education: { orderBy: { startYear: 'desc' } },
        projects: { orderBy: { createdAt: 'desc' } },
        assessments: {
          include: {
            assessment: { select: { id: true, name: true, organization: true, maxScore: true } },
          },
          orderBy: { date: 'desc' },
        },
      },
    })

    if (!profile) throw new ResponseError(404, 'Student not found')

    const applicationsCount = await db.application.count({ where: { studentId: id } })

    const skills = profile.skills.map(s => ({
      id: s.id,
      skillId: s.skillId,
      name: s.skill.displayName,
      category: s.skill.category,
      selfRated: s.selfRated,
      isVerified: s.isVerified,
      source: s.source,
      addedAt: s.addedAt,
    }))

    return Response.json({
      id: profile.id,
      userId: profile.userId,
      name: profile.user.name,
      email: profile.user.email,
      avatarUrl: profile.user.avatarUrl,
      phone: profile.user.phone,
      studentId: profile.studentId,
      university: profile.university,
      batch: profile.batch,
      branch: profile.branch,
      cgpa: profile.cgpa,
      bio: profile.bio,
      location: profile.location,
      linkedinUrl: profile.linkedinUrl,
      githubUser: profile.githubUser,
      portfolioUrl: profile.portfolioUrl,
      graduationYear: profile.graduationYear,
      profileCompletion: profile.profileCompletion,
      skills,
      evidence: profile.evidence,
      education: profile.education,
      projects: profile.projects,
      assessmentResults: profile.assessments,
      applicationsCount,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
