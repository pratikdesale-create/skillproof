import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError } from '@/lib/auth'
import { requireUser, requireStudentProfileId, safeParseJson } from '@/lib/api-helpers'

// GET /api/dashboard/student — STUDENT only.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req)
    const spId = await requireStudentProfileId(user)

    const profile = await db.studentProfile.findUnique({
      where: { id: spId },
      select: {
        id: true, university: true, batch: true, branch: true, cgpa: true,
        bio: true, location: true, linkedinUrl: true, githubUser: true,
        portfolioUrl: true, graduationYear: true, profileCompletion: true,
      },
    })
    if (!profile) throw new ResponseError(404, 'Profile not found')

    const [skillsCount, verifiedSkillsCount, evidenceCount] = await Promise.all([
      db.studentSkill.count({ where: { studentId: spId } }),
      db.studentSkill.count({ where: { studentId: spId, isVerified: true } }),
      db.evidence.count({ where: { studentId: spId } }),
    ])
    const supportedSkillsCount = verifiedSkillsCount
    const unverifiedSkillsCount = skillsCount - verifiedSkillsCount

    // Suitable jobs (fitScore > 0; batchEligible should contain the student's batch if specified)
    const matches = await db.matchResult.findMany({
      where: {
        studentId: spId,
        fitScore: { gt: 0 },
        job: { status: 'OPEN' },
      },
      orderBy: { fitScore: 'desc' },
      include: {
        job: {
          include: {
            company: { select: { id: true, name: true, industry: true } },
          },
        },
      },
    })

    // Optionally filter by batch
    const url = new URL(req.url)
    const filterByBatch = url.searchParams.get('filterByBatch') !== 'false'
    const studentBatch = profile.batch
    const filtered = filterByBatch && studentBatch
      ? matches.filter(m => {
          const eligible = m.job.batchEligible
          if (!eligible) return true // open to all
          return eligible.split(',').map(b => b.trim()).includes(studentBatch)
        })
      : matches

    const suitableJobsCount = filtered.length
    const recentMatches = filtered.slice(0, 5).map(m => ({
      jobId: m.jobId,
      jobTitle: m.job.title,
      company: m.job.company,
      fitScore: m.fitScore,
      requiredCoverage: m.requiredCoverage,
    }))

    // Average fit score across all matches
    const avgFitScore = matches.length === 0
      ? 0
      : Math.round((matches.reduce((sum, m) => sum + m.fitScore, 0) / matches.length) * 10) / 10

    // Active applications count
    const activeApplicationsCount = await db.application.count({
      where: {
        studentId: spId,
        status: { notIn: ['REJECTED', 'WITHDRAWN'] },
      },
    })

    // Upcoming interviews (next 3)
    const upcomingInterviews = await db.interview.findMany({
      where: {
        application: { studentId: spId },
        scheduledAt: { gte: new Date() },
        outcome: null,
      },
      orderBy: { scheduledAt: 'asc' },
      take: 3,
      include: {
        application: {
          include: {
            job: { select: { id: true, title: true, company: { select: { id: true, name: true } } } },
          },
        },
      },
    })

    // Recent application updates (last 5 ApplicationEvent involving student's apps)
    const recentApplicationUpdates = await db.applicationEvent.findMany({
      where: { application: { studentId: spId } },
      orderBy: { timestamp: 'desc' },
      take: 5,
      include: {
        actor: { select: { id: true, name: true } },
        application: {
          include: { job: { select: { id: true, title: true } } },
        },
      },
    })

    // Missing skills for top match
    const topMatch = matches[0]
    let missingSkillsForTopMatch: unknown[] = []
    if (topMatch) {
      const parsed = safeParseJson<unknown[]>(topMatch.missingSkills, []) ?? []
      if (Array.isArray(parsed)) {
        missingSkillsForTopMatch = parsed.filter((s): s is { isRequired: boolean } => {
          return typeof s === 'object' && s !== null && 'isRequired' in s && (s as { isRequired: boolean }).isRequired
        })
      }
    }

    return Response.json({
      profileCompletion: profile.profileCompletion,
      supportedSkillsCount,
      unverifiedSkillsCount,
      skillsCount,
      evidenceCount,
      suitableJobsCount,
      recentMatches,
      avgFitScore,
      activeApplicationsCount,
      upcomingInterviews: upcomingInterviews.map(i => ({
        id: i.id,
        scheduledAt: i.scheduledAt,
        duration: i.duration,
        location: i.location,
        meetingUrl: i.meetingUrl,
        type: i.type,
        round: i.round,
        applicationId: i.applicationId,
        job: i.application.job,
      })),
      recentApplicationUpdates: recentApplicationUpdates.map(e => ({
        id: e.id,
        applicationId: e.applicationId,
        previousStatus: e.previousStatus,
        newStatus: e.newStatus,
        reason: e.reason,
        timestamp: e.timestamp,
        actor: e.actor,
        job: e.application.job,
      })),
      missingSkillsForTopMatch: topMatch ? {
        jobId: topMatch.jobId,
        jobTitle: topMatch.job.title,
        skills: missingSkillsForTopMatch,
      } : null,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
