import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError } from '@/lib/auth'
import { requireUser, requireStudentProfileId } from '@/lib/api-helpers'
import { safeParseJson } from '@/lib/api-helpers'

// GET /api/matches/student — STUDENT only.
// Return matches for the current student: jobId, job title, company, fitScore,
// requiredCoverage, preferredCoverage, missingSkills count. Sort by fitScore desc.
// Optional ?minScore filter.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req)
    const spId = await requireStudentProfileId(user)

    const url = new URL(req.url)
    const minScoreRaw = url.searchParams.get('minScore')
    const minScore = minScoreRaw ? parseFloat(minScoreRaw) : 0

    const matches = await db.matchResult.findMany({
      where: {
        studentId: spId,
        fitScore: { gte: Number.isFinite(minScore) ? minScore : 0 },
        job: { status: 'OPEN' },
      },
      orderBy: { fitScore: 'desc' },
      include: {
        job: {
          include: { company: { select: { id: true, name: true, industry: true } } },
        },
      },
      take: 200,
    })

    const data = matches.map(m => {
      const missing = safeParseJson<unknown[]>(m.missingSkills, []) ?? []
      return {
        id: m.id,
        jobId: m.jobId,
        jobTitle: m.job.title,
        company: m.job.company,
        location: m.job.location,
        workArrangement: m.job.workArrangement,
        employmentType: m.job.employmentType,
        fitScore: m.fitScore,
        requiredCoverage: m.requiredCoverage,
        preferredCoverage: m.preferredCoverage,
        missingSkillsCount: Array.isArray(missing) ? missing.length : 0,
        updatedAt: m.updatedAt,
      }
    })

    return Response.json({ data })
  } catch (err) {
    return errorResponse(err)
  }
}
