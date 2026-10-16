import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, requireRole } from '@/lib/auth'
import { requireUser } from '@/lib/api-helpers'

// GET /api/job-sources — OFFICER only. List JobSource records.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req)
    requireRole(user, 'OFFICER', 'ADMIN')
    const sources = await db.jobSource.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return Response.json({ data: sources })
  } catch (err) {
    return errorResponse(err)
  }
}
