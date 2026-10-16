import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse } from '@/lib/auth'
import { requireUser } from '@/lib/api-helpers'

// GET /api/notifications — any authenticated. Unread first, then by createdAt desc.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req)
    const notifications = await db.notification.findMany({
      where: { userId: user.id },
      orderBy: [{ read: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    })
    const unreadCount = notifications.filter(n => !n.read).length
    return Response.json(notifications)
  } catch (err) {
    return errorResponse(err)
  }
}
