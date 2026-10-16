import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError } from '@/lib/auth'
import { requireUser } from '@/lib/api-helpers'

// POST /api/notifications/[id]/read — owner. Mark as read.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser(req)
    const { id } = await params

    const notif = await db.notification.findUnique({ where: { id } })
    if (!notif) throw new ResponseError(404, 'Notification not found')
    if (notif.userId !== user.id) throw new ResponseError(403, 'Not your notification')

    const updated = await db.notification.update({
      where: { id },
      data: { read: true },
    })
    return Response.json({ id: updated.id, read: updated.read })
  } catch (err) {
    return errorResponse(err)
  }
}
