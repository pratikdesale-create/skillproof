import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError } from '@/lib/auth'
import { requireUser, requireRecruiterCompanyId } from '@/lib/api-helpers'

// GET /api/dashboard/recruiter — RECRUITER only.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req)
    const companyId = await requireRecruiterCompanyId(user)
    if (!companyId) throw new ResponseError(403, 'No company bound to your recruiter profile')

    const [openJobsForCompany, totalCandidates, shortlistedCount, candidatesNeedingReview, stageDistribution, recentActivity] = await Promise.all([
      db.job.count({ where: { companyId, status: 'OPEN' } }),
      db.application.findMany({
        where: { job: { companyId } },
        distinct: ['studentId'],
        select: { studentId: true },
      }),
      db.application.count({ where: { job: { companyId }, status: 'SHORTLISTED' } }),
      db.application.count({ where: { job: { companyId }, status: 'UNDER_REVIEW' } }),
      db.application.groupBy({
        by: ['status'],
        where: { job: { companyId } },
        _count: { status: true },
      }),
      db.applicationEvent.findMany({
        where: { application: { job: { companyId } } },
        orderBy: { timestamp: 'desc' },
        take: 10,
        include: {
          actor: { select: { id: true, name: true } },
          application: {
            include: {
              student: { include: { user: { select: { name: true } } } },
              job: { include: { company: { select: { name: true } } } },
            },
          },
        },
      }),
    ])

    const stageDistributionMap = stageDistribution.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = item._count.status
      return acc
    }, {})

    return Response.json({
      companyId,
      openJobsForCompany,
      totalCandidates: totalCandidates.length,
      shortlistedCount,
      candidatesNeedingReview,
      stageDistribution: stageDistributionMap,
      recentActivity: recentActivity.map(e => ({
        id: e.id,
        applicationId: e.applicationId,
        previousStatus: e.previousStatus,
        newStatus: e.newStatus,
        reason: e.reason,
        timestamp: e.timestamp,
        actor: e.actor,
        studentName: e.application.student.user.name,
        jobTitle: e.application.job.title,
      })),
    })
  } catch (err) {
    return errorResponse(err)
  }
}
