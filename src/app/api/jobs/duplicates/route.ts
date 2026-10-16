import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError, requireRole } from '@/lib/auth'
import { requireUser } from '@/lib/api-helpers'

// GET /api/jobs/duplicates — OFFICER only.
// List all DuplicateJob records with status='POSSIBLE' or 'CONFIRMED', with the two jobs side-by-side.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req)
    requireRole(user, 'OFFICER', 'ADMIN')

    const records = await db.duplicateJob.findMany({
      where: { status: { in: ['POSSIBLE', 'CONFIRMED'] } },
      orderBy: { similarity: 'desc' },
      include: {
        jobA: { include: { company: { select: { id: true, name: true } } } },
        jobB: { include: { company: { select: { id: true, name: true } } } },
      },
    })

    const data = records.map(r => ({
      id: r.id,
      status: r.status,
      similarity: r.similarity,
      reasons: r.reasons,
      detectedAt: r.detectedAt,
      resolvedAt: r.resolvedAt,
      jobA: {
        id: r.jobA.id,
        title: r.jobA.title,
        companyId: r.jobA.companyId,
        companyName: r.jobA.company.name,
        location: r.jobA.location,
        postingDate: r.jobA.postingDate,
        status: r.jobA.status,
      },
      jobB: {
        id: r.jobB.id,
        title: r.jobB.title,
        companyId: r.jobB.companyId,
        companyName: r.jobB.company.name,
        location: r.jobB.location,
        postingDate: r.jobB.postingDate,
        status: r.jobB.status,
      },
    }))

    return Response.json({ data })
  } catch (err) {
    return errorResponse(err)
  }
}
