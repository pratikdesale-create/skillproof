import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError } from '@/lib/auth'
import { requireUser, requireStudentProfileId } from '@/lib/api-helpers'

// GET /api/evidence/[id] — OFFICER or owner student. Return evidence details + skills + reviews history.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser(req)
    const { id } = await params

    const evidence = await db.evidence.findUnique({
      where: { id },
      include: {
        student: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        skills: {
          include: { skill: { select: { id: true, displayName: true, category: true } } },
        },
        reviews: {
          include: { reviewer: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!evidence) throw new ResponseError(404, 'Evidence not found')

    // Authorization: officer/admin OR owner student
    if (user.role === 'STUDENT') {
      const spId = await requireStudentProfileId(user)
      if (evidence.studentId !== spId) throw new ResponseError(403, 'Not your evidence')
    } else if (user.role !== 'OFFICER' && user.role !== 'ADMIN') {
      throw new ResponseError(403, 'Insufficient permissions')
    }

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
      reviewerId: evidence.reviewerId,
      reviewerNotes: evidence.reviewerNotes,
      reviewedAt: evidence.reviewedAt,
      provenance: evidence.provenance,
      student: {
        id: evidence.student.id,
        name: evidence.student.user.name,
        email: evidence.student.user.email,
        batch: evidence.student.batch,
        branch: evidence.student.branch,
        cgpa: evidence.student.cgpa,
      },
      skills: evidence.skills.map(es => ({
        skillId: es.skillId,
        name: es.skill.displayName,
        category: es.skill.category,
        relevance: es.relevance,
      })),
      reviews: evidence.reviews.map(r => ({
        id: r.id,
        reviewerId: r.reviewerId,
        reviewerName: r.reviewer.name,
        action: r.action,
        status: r.status,
        reason: r.reason,
        notes: r.notes,
        createdAt: r.createdAt,
      })),
    })
  } catch (err) {
    return errorResponse(err)
  }
}
