import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError } from '@/lib/auth'
import { requireUser, requireStudentProfileId, requireRecruiterCompanyId, safeParseJson } from '@/lib/api-helpers'
import { computeMatchFor } from '@/lib/match-compute'

// GET /api/matches/[jobId]/[studentId] — OFFICER, or owner student, or owner-recruiter.
// Return full match result with explanation breakdown.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string; studentId: string }> }
) {
  try {
    const user = await requireUser(req)
    const { jobId, studentId } = await params

    if (user.role === 'STUDENT') {
      const spId = await requireStudentProfileId(user)
      if (spId !== studentId) throw new ResponseError(403, 'Not your match')
    } else if (user.role === 'RECRUITER') {
      const job = await db.job.findUnique({ where: { id: jobId }, select: { companyId: true } })
      if (!job) throw new ResponseError(404, 'Job not found')
      const myCompanyId = await requireRecruiterCompanyId(user)
      if (!myCompanyId || myCompanyId !== job.companyId) {
        throw new ResponseError(403, 'You do not own this job')
      }
    } else if (user.role !== 'OFFICER' && user.role !== 'ADMIN') {
      throw new ResponseError(403, 'Insufficient permissions')
    }

    // Load stored match result
    const stored = await db.matchResult.findUnique({
      where: { jobId_studentId: { jobId, studentId } },
      include: {
        job: { include: { company: { select: { id: true, name: true } } } },
        student: { include: { user: { select: { id: true, name: true } } } },
      },
    })

    // Recompute on-the-fly to ensure breakdown is fresh
    const live = await computeMatchFor(jobId, studentId)

    if (!stored && !live) throw new ResponseError(404, 'Match not found')

    return Response.json({
      jobId,
      studentId,
      job: stored?.job
        ? { id: stored.job.id, title: stored.job.title, company: stored.job.company }
        : null,
      student: stored?.student
        ? { id: stored.student.id, name: stored.student.user.name }
        : null,
      fitScore: live?.fitScore ?? stored?.fitScore ?? 0,
      // Legacy coverage fields (kept for backward compat)
      requiredCoverage: live?.requiredCoverage ?? stored?.requiredCoverage ?? 0,
      preferredCoverage: live?.preferredCoverage ?? stored?.preferredCoverage ?? 0,
      // P3 fix: separated verified / provisional / missing coverage tiers.
      // These come from the live computation (which now exposes them).
      // Falls back to 0 if the live computation wasn't possible (e.g. empty
      // job requirements — in which case verified = 1.0 by convention).
      verifiedRequiredCoverage: live?.verifiedRequiredCoverage ?? 0,
      provisionalRequiredCoverage: live?.provisionalRequiredCoverage ?? 0,
      missingRequiredCoverage: live?.missingRequiredCoverage ?? 0,
      verifiedPreferredCoverage: live?.verifiedPreferredCoverage ?? 0,
      provisionalPreferredCoverage: live?.provisionalPreferredCoverage ?? 0,
      missingPreferredCoverage: live?.missingPreferredCoverage ?? 0,
      matchingSkills: live?.matchingSkills ?? safeParseJson(stored?.matchingSkills ?? null, []) ?? [],
      missingSkills: live?.missingSkills ?? safeParseJson(stored?.missingSkills ?? null, []) ?? [],
      // P3 fix: provisional skills (pending/unverified evidence — neither
      // fully covered nor missing).
      provisionalSkills: live?.provisionalSkills ?? [],
      breakdown: live?.breakdown ?? [],
      factorsSummary: live?.factorsSummary ?? '',
      recommendation: live?.recommendation ?? '',
      algorithmVersion: live?.algorithmVersion ?? stored?.algorithmVersion ?? 'v1.0',
      storedAt: stored?.updatedAt ?? null,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
