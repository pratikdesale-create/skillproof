import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError } from '@/lib/auth'
import {
  requireUser,
  requireRecruiterCompanyId,
  notifyUsers,
  getStudentUserId,
} from '@/lib/api-helpers'
import { z } from 'zod'

const offerSchema = z.object({
  amount: z.number().int().min(0).optional(),
  currency: z.string().max(10).optional(),
  decision: z.enum(['PENDING', 'ACCEPTED', 'DECLINED']).optional(),
  expiresAt: z.string().datetime().optional(),
})

// POST /api/applications/[id]/offer — OFFICER or RECRUITER.
// Create or update Offer. Update application status to 'OFFER'. Notify student.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser(req)
    const { id } = await params
    if (user.role !== 'OFFICER' && user.role !== 'ADMIN' && user.role !== 'RECRUITER') {
      throw new ResponseError(403, 'Insufficient permissions')
    }

    const body = await req.json()
    const parsed = offerSchema.safeParse(body)
    if (!parsed.success) {
      throw new ResponseError(400, 'Invalid input: ' + (parsed.error.issues[0]?.message ?? 'validation error'))
    }
    const data = parsed.data

    const app = await db.application.findUnique({
      where: { id },
      include: { job: { include: { company: true } } },
    })
    if (!app) throw new ResponseError(404, 'Application not found')

    if (user.role === 'RECRUITER') {
      const myCompanyId = await requireRecruiterCompanyId(user)
      if (!myCompanyId || myCompanyId !== app.job.companyId) {
        throw new ResponseError(403, 'You do not own this company')
      }
    }

    const offer = await db.$transaction(async (tx) => {
      const existing = await tx.offer.findUnique({ where: { applicationId: id } })
      const prevStatus = app.status

      if (existing) {
        const updated = await tx.offer.update({
          where: { applicationId: id },
          data: {
            amount: data.amount ?? existing.amount,
            currency: data.currency ?? existing.currency,
            decision: data.decision ?? existing.decision,
            expiresAt: data.expiresAt ? new Date(data.expiresAt) : existing.expiresAt,
          },
        })
        // Bump application status to OFFER if earlier stage
        if (prevStatus !== 'OFFER' && prevStatus !== 'WITHDRAWN' && prevStatus !== 'REJECTED') {
          await tx.application.update({ where: { id }, data: { status: 'OFFER' } })
          await tx.applicationEvent.create({
            data: {
              applicationId: id,
              previousStatus: prevStatus,
              newStatus: 'OFFER',
              actorId: user.id,
              reason: `Offer updated — ${updated.amount ?? 'unspecified'} ${updated.currency}`,
            },
          })
        }
        return updated
      } else {
        const created = await tx.offer.create({
          data: {
            applicationId: id,
            amount: data.amount ?? null,
            currency: data.currency ?? 'INR',
            decision: data.decision ?? 'PENDING',
            expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
          },
        })
        if (prevStatus !== 'OFFER' && prevStatus !== 'WITHDRAWN' && prevStatus !== 'REJECTED') {
          await tx.application.update({ where: { id }, data: { status: 'OFFER' } })
          await tx.applicationEvent.create({
            data: {
              applicationId: id,
              previousStatus: prevStatus,
              newStatus: 'OFFER',
              actorId: user.id,
              reason: `Offer extended — ${created.amount ?? 'unspecified'} ${created.currency}`,
            },
          })
        }
        return created
      }
    })

    // Notify student
    const studentUserId = await getStudentUserId(app.studentId)
    if (studentUserId) {
      await notifyUsers([studentUserId], {
        type: 'offer',
        title: 'Offer extended!',
        message: `You have received an offer for ${app.job.title}.`,
        link: `/applications/${id}`,
      })
    }

    return Response.json({
      offer,
      applicationId: id,
    }, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
