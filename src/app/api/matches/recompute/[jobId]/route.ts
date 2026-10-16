import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError, requireRole } from '@/lib/auth'
import { requireUser } from '@/lib/api-helpers'
import { computeMatchFor, upsertMatchResult } from '@/lib/match-compute'

// POST /api/matches/recompute/[jobId] — OFFICER only.
// Recompute match results for ALL eligible students for this job.
// Return { computed: number }.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const user = await requireUser(req)
    requireRole(user, 'OFFICER', 'ADMIN')
    const { jobId } = await params

    const job = await db.job.findUnique({
      where: { id: jobId },
      select: { id: true, status: true },
    })
    if (!job) throw new ResponseError(404, 'Job not found')

    // Eligible students: those with at least one evidence item
    const students = await db.studentProfile.findMany({
      where: { evidence: { some: {} } },
      select: { id: true },
    })

    let computed = 0
    for (const s of students) {
      const m = await computeMatchFor(jobId, s.id)
      if (!m) continue
      await upsertMatchResult(jobId, s.id, m)
      computed++
    }

    await db.auditEvent.create({
      data: {
        actorId: user.id,
        action: 'MATCH_RECOMPUTE_JOB',
        targetType: 'Job',
        targetId: jobId,
        metadata: JSON.stringify({ computed }),
      },
    })

    return Response.json({ jobId, computed })
  } catch (err) {
    return errorResponse(err)
  }
}
