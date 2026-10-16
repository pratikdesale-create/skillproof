import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError, requireRole } from '@/lib/auth'
import { requireUser } from '@/lib/api-helpers'
import { computeMatchFor, upsertMatchResult } from '@/lib/match-compute'

// POST /api/matches/recompute-all — OFFICER only. Recompute for all OPEN jobs.
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req)
    requireRole(user, 'OFFICER', 'ADMIN')

    const jobs = await db.job.findMany({
      where: { status: 'OPEN' },
      select: { id: true },
    })

    const students = await db.studentProfile.findMany({
      where: { evidence: { some: {} } },
      select: { id: true },
    })

    let computed = 0
    for (const job of jobs) {
      for (const s of students) {
        const m = await computeMatchFor(job.id, s.id)
        if (!m) continue
        await upsertMatchResult(job.id, s.id, m)
        computed++
      }
    }

    await db.auditEvent.create({
      data: {
        actorId: user.id,
        action: 'MATCH_RECOMPUTE_ALL',
        targetType: 'System',
        metadata: JSON.stringify({ jobsProcessed: jobs.length, students: students.length, computed }),
      },
    })

    return Response.json({ jobsProcessed: jobs.length, students: students.length, computed })
  } catch (err) {
    return errorResponse(err)
  }
}
