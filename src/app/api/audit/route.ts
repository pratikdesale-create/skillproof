import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, requireRole } from '@/lib/auth'
import { requireUser, getPagination } from '@/lib/api-helpers'

// GET /api/audit — OFFICER only. List recent AuditEvent with actor name, action, target, reason, timestamp.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req)
    requireRole(user, 'OFFICER', 'ADMIN')

    const { skip, take } = getPagination(req)
    const [events, total] = await Promise.all([
      db.auditEvent.findMany({
        skip,
        take,
        orderBy: { timestamp: 'desc' },
        include: { actor: { select: { id: true, name: true, email: true, role: true } } },
      }),
      db.auditEvent.count(),
    ])

    const data = events.map(e => ({
      id: e.id,
      actorId: e.actorId,
      actorName: e.actor.name,
      actorEmail: e.actor.email,
      actorRole: e.actor.role,
      action: e.action,
      targetType: e.targetType,
      targetId: e.targetId,
      reason: e.reason,
      metadata: e.metadata,
      timestamp: e.timestamp,
    }))

    return Response.json({ data, total, skip, take })
  } catch (err) {
    return errorResponse(err)
  }
}
