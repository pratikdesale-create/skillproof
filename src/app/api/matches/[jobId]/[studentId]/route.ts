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
      requiredCoverage: live?.requiredCoverage ?? stored?.requiredCoverage ?? 0,
      preferredCoverage: live?.preferredCoverage ?? stored?.preferredCoverage ?? 0,
      matchingSkills: live?.matchingSkills ?? safeParseJson(stored?.matchingSkills ?? null, []) ?? [],
      missingSkills: live?.missingSkills ?? safeParseJson(stored?.missingSkills ?? null, []) ?? [],
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
