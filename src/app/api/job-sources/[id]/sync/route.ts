import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError, requireRole } from '@/lib/auth'
import { requireUser } from '@/lib/api-helpers'

// POST /api/job-sources/[id]/sync — OFFICER only. Body: empty.
// For now, just update lastSyncAt and return demo payload.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser(req)
    requireRole(user, 'OFFICER', 'ADMIN')
    const { id } = await params

    const source = await db.jobSource.findUnique({ where: { id } })
    if (!source) throw new ResponseError(404, 'Job source not found')

    const updated = await db.jobSource.update({
      where: { id },
      data: { lastSyncAt: new Date() },
    })

    return Response.json({
      ok: true,
      imported: 0,
      message: 'Demo: integration not configured',
      sourceId: updated.id,
      lastSyncAt: updated.lastSyncAt,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
