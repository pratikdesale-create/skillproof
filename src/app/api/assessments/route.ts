import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError } from '@/lib/auth'
import { requireUser } from '@/lib/api-helpers'

// GET /api/assessments — any authenticated user.
// Students see all available assessments + their own results.
// Officers see assessments + counts of results.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req)
    const assessments = await db.assessment.findMany({
      include: {
        skill: { select: { id: true, displayName: true, canonicalName: true, category: true } },
        results: {
          where: user.role === 'STUDENT'
            ? { student: { userId: user.id } }
            : undefined,
          select: { id: true, score: true, percentile: true, date: true, studentId: true },
        },
      },
    })
    const data = assessments.map(a => {
      const results = a.results
      const submissions = results.length
      const avgScore = submissions > 0 ? results.reduce((s, r) => s + r.score, 0) / submissions : null
      const myResult = user.role === 'STUDENT' ? results[0] ?? null : null
      return {
        id: a.id,
        name: a.name,
        organization: a.organization,
        description: a.description,
        maxScore: a.maxScore,
        skill: a.skill,
        submissions,
        avgScore,
        myResult,
      }
    })
    return Response.json({ data })
  } catch (err) {
    return errorResponse(err)
  }
}
