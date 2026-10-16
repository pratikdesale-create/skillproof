import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError, requireRole } from '@/lib/auth'
import { requireUser, getPagination } from '@/lib/api-helpers'

// GET /api/evidence/pending — OFFICER only.
// List pending/needs_more evidence with student name, skills, submit date.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req)
    requireRole(user, 'OFFICER', 'ADMIN')

    const { skip, take } = getPagination(req)
    const where = {
      status: { in: ['PENDING_REVIEW', 'NEEDS_MORE_EVIDENCE', 'UNVERIFIED'] },
    }

    const [items, total] = await Promise.all([
      db.evidence.findMany({
        where,
        skip,
        take,
        orderBy: { submittedAt: 'asc' },
        include: {
          student: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
          skills: {
            include: { skill: { select: { id: true, displayName: true, category: true } } },
          },
        },
      }),
      db.evidence.count({ where }),
    ])

    const data = items.map(e => ({
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
      student: {
        id: e.student.id,
        name: e.student.user.name,
        email: e.student.user.email,
        batch: e.student.batch,
        branch: e.student.branch,
        cgpa: e.student.cgpa,
      },
      skills: e.skills.map(es => ({
        skillId: es.skillId,
        name: es.skill.displayName,
        category: es.skill.category,
        relevance: es.relevance,
      })),
    }))

    return Response.json({ data, total, skip, take })
  } catch (err) {
    return errorResponse(err)
  }
}
