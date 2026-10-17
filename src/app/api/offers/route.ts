import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError } from '@/lib/auth'
import { requireUser, getPagination } from '@/lib/api-helpers'

// GET /api/offers — OFFICER/ADMIN or RECRUITER (own company only).
// Returns all offers in the system.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req)
    if (user.role !== 'OFFICER' && user.role !== 'ADMIN' && user.role !== 'RECRUITER') {
      throw new ResponseError(403, 'Insufficient permissions')
    }

    const url = new URL(req.url)
    const decision = url.searchParams.get('decision') // PENDING | ACCEPTED | DECLINED | all
    const { skip, take } = getPagination(req)

    let where: Record<string, unknown> = {}
    if (user.role === 'RECRUITER') {
      const rp = await db.recruiterProfile.findUnique({ where: { userId: user.id }, select: { companyId: true } })
      if (!rp?.companyId) throw new ResponseError(403, 'Not bound to a company')
      where = { application: { job: { companyId: rp.companyId } } }
    }
    if (decision && decision !== 'all') where.decision = decision

    const [offers, total] = await Promise.all([
      db.offer.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          application: {
            select: {
              id: true,
              status: true,
              student: {
                select: {
                  id: true,
                  user: { select: { id: true, name: true, email: true } },
                  branch: true, batch: true, cgpa: true,
                },
              },
              job: { select: { id: true, title: true, company: { select: { id: true, name: true } } } },
            },
          },
        },
      }),
      db.offer.count({ where }),
    ])

    const totalAmount = offers.reduce((s, o) => s + (o.amount ?? 0), 0)
    const accepted = offers.filter(o => o.decision === 'ACCEPTED').length
    return Response.json({ data: offers, total, skip, take, totalAmount, acceptedCount: accepted })
  } catch (err) {
    return errorResponse(err)
  }
}
