import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError } from '@/lib/auth'
import { requireUser, getPagination } from '@/lib/api-helpers'

// GET /api/interviews — OFFICER/ADMIN or RECRUITER (own company only).
// Returns upcoming + past interviews for the authorized scope.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req)
    if (user.role !== 'OFFICER' && user.role !== 'ADMIN' && user.role !== 'RECRUITER') {
      throw new ResponseError(403, 'Insufficient permissions')
    }

    const url = new URL(req.url)
    const status = url.searchParams.get('status') || 'all' // all | upcoming | past
    const { skip, take } = getPagination(req)

    const now = new Date()
    // Build where: officer sees everything; recruiter filters by their company via job
    let where: Record<string, unknown> = {}
    if (user.role === 'RECRUITER') {
      const rp = await db.recruiterProfile.findUnique({ where: { userId: user.id }, select: { companyId: true } })
      if (!rp?.companyId) throw new ResponseError(403, 'Not bound to a company')
      where = { application: { job: { companyId: rp.companyId } } }
    }
    if (status === 'upcoming') where.scheduledAt = { gte: now }
    if (status === 'past') where.scheduledAt = { lt: now }

    const [interviews, total] = await Promise.all([
      db.interview.findMany({
        where,
        skip,
        take,
        orderBy: { scheduledAt: 'asc' },
        include: {
          application: {
            select: {
              id: true,
              student: {
                select: {
                  id: true,
                  user: { select: { id: true, name: true, email: true } },
                  branch: true,
                  batch: true,
                  cgpa: true,
                },
              },
              job: { select: { id: true, title: true, company: { select: { id: true, name: true } } } },
              status: true,
            },
          },
        },
      }),
      db.interview.count({ where }),
    ])

    return Response.json({ data: interviews, total, skip, take })
  } catch (err) {
    return errorResponse(err)
  }
}
