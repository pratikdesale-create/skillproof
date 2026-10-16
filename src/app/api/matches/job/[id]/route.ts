import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError } from '@/lib/auth'
import { requireUser, requireRecruiterCompanyId, getPagination, safeParseJson } from '@/lib/api-helpers'

// GET /api/matches/job/[id] — OFFICER or RECRUITER (if recruiter owns the job's company).
// Return all MatchResults for a job sorted by fitScore desc.
// Optional ?minScore, ?requiredCoverageOnly filters. Pagination.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser(req)
    const { id } = await params

    if (user.role !== 'OFFICER' && user.role !== 'ADMIN' && user.role !== 'RECRUITER') {
      throw new ResponseError(403, 'Insufficient permissions')
    }

    const job = await db.job.findUnique({
      where: { id },
      select: { id: true, companyId: true },
    })
    if (!job) throw new ResponseError(404, 'Job not found')

    if (user.role === 'RECRUITER') {
      const myCompanyId = await requireRecruiterCompanyId(user)
      if (!myCompanyId || myCompanyId !== job.companyId) {
        throw new ResponseError(403, 'You do not own this job')
      }
    }

    const url = new URL(req.url)
    const minScoreRaw = url.searchParams.get('minScore')
    const minScore = minScoreRaw ? parseFloat(minScoreRaw) : 0
    const requiredCoverageOnly = url.searchParams.get('requiredCoverageOnly') === 'true'

    const { skip, take } = getPagination(req)

    const where: Record<string, unknown> = {
      jobId: id,
      fitScore: { gte: Number.isFinite(minScore) ? minScore : 0 },
    }
    if (requiredCoverageOnly) where.requiredCoverage = { gte: 1.0 }

    const [matches, total] = await Promise.all([
      db.matchResult.findMany({
        where,
        skip,
        take,
        orderBy: { fitScore: 'desc' },
        include: {
          student: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      }),
      db.matchResult.count({ where }),
    ])

    const data = matches.map(m => {
      const missing = safeParseJson<unknown[]>(m.missingSkills, []) ?? []
      const matching = safeParseJson<unknown[]>(m.matchingSkills, []) ?? []
      return {
        id: m.id,
        jobId: m.jobId,
        studentId: m.studentId,
        studentName: m.student.user.name,
        branch: m.student.branch,
        batch: m.student.batch,
        cgpa: m.student.cgpa,
        fitScore: m.fitScore,
        requiredCoverage: m.requiredCoverage,
        preferredCoverage: m.preferredCoverage,
        missingSkills: Array.isArray(missing) ? missing : [],
        matchingSkills: Array.isArray(matching) ? matching : [],
        updatedAt: m.updatedAt,
      }
    })

    return Response.json({ data, total, skip, take })
  } catch (err) {
    return errorResponse(err)
  }
}
