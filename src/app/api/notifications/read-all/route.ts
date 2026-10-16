import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse } from '@/lib/auth'
import { requireUser } from '@/lib/api-helpers'

// POST /api/notifications/read-all — owner. Mark all own as read.
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req)
    const result = await db.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    })
    return Response.json({ updated: result.count })
  } catch (err) {
    return errorResponse(err)
  }
}
