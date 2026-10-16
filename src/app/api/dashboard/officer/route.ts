import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, requireRole } from '@/lib/auth'
import { requireUser } from '@/lib/api-helpers'

// GET /api/dashboard/officer — OFFICER only.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req)
    requireRole(user, 'OFFICER', 'ADMIN')

    const url = new URL(req.url)
    const selectedJobId = url.searchParams.get('jobId')

    const [
      totalActiveStudents,
      totalOpenJobs,
      pendingEvidenceCount,
      totalMatchesComputed,
      applicationsByStage,
      totalInterviews,
      totalOffers,
      jobsBySource,
      recentActivity,
    ] = await Promise.all([
      db.studentProfile.count(),
      db.job.count({ where: { status: 'OPEN' } }),
      db.evidence.count({ where: { status: { in: ['PENDING_REVIEW', 'NEEDS_MORE_EVIDENCE', 'UNVERIFIED'] } } }),
      db.matchResult.count(),
      db.application.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      db.interview.count(),
      db.offer.count(),
      db.job.groupBy({
        by: ['sourceType'],
        _count: { sourceType: true },
      }),
      db.applicationEvent.findMany({
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

    let topMatchesForSelectedJob: Array<{
      studentId: string
      studentName: string
      fitScore: number
      requiredCoverage: number
    }> = []
    if (selectedJobId) {
      const matches = await db.matchResult.findMany({
        where: { jobId: selectedJobId },
        orderBy: { fitScore: 'desc' },
        take: 5,
        include: {
          student: { include: { user: { select: { name: true } } } },
        },
      })
      topMatchesForSelectedJob = matches.map(m => ({
        studentId: m.studentId,
        studentName: m.student.user.name,
        fitScore: m.fitScore,
        requiredCoverage: m.requiredCoverage,
      }))
    }

    const applicationsByStageMap = applicationsByStage.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = item._count.status
      return acc
    }, {})

    const jobsBySourceMap = jobsBySource.reduce<Record<string, number>>((acc, item) => {
      acc[item.sourceType] = item._count.sourceType
      return acc
    }, {})

    return Response.json({
      totalActiveStudents,
      totalOpenJobs,
      pendingEvidenceCount,
      totalMatchesComputed,
      applicationsByStage: applicationsByStageMap,
      totalInterviews,
      totalOffers,
      jobsBySource: jobsBySourceMap,
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
        companyName: e.application.job.company.name,
      })),
      topMatchesForSelectedJob,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
