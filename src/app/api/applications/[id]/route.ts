import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError } from '@/lib/auth'
import {
  requireUser,
  requireStudentProfileId,
  requireRecruiterCompanyId,
  notifyUsers,
  getStudentUserId,
} from '@/lib/api-helpers'
import { z } from 'zod'

const allowedTransitions: Record<string, string[]> = {
  APPLIED: ['UNDER_REVIEW', 'SHORTLISTED', 'ASSESSMENT', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN'],
  UNDER_REVIEW: ['SHORTLISTED', 'ASSESSMENT', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN'],
  SHORTLISTED: ['ASSESSMENT', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN'],
  ASSESSMENT: ['INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN'],
  INTERVIEW: ['OFFER', 'REJECTED', 'WITHDRAWN'],
  OFFER: ['WITHDRAWN', 'REJECTED'],
  REJECTED: [],
  WITHDRAWN: [],
}

// GET /api/applications/[id] — owner student, OFFICER, or recruiter (if owns company).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser(req)
    const { id } = await params

    const app = await db.application.findUnique({
      where: { id },
      include: {
        student: { include: { user: { select: { id: true, name: true, email: true } } } },
        job: { include: { company: { select: { id: true, name: true } } } },
        resume: { select: { id: true, title: true, version: true } },
        events: {
          include: { actor: { select: { id: true, name: true } } },
          orderBy: { timestamp: 'desc' } },
        interviews: { orderBy: { scheduledAt: 'desc' } },
        offer: true,
      },
    })
    if (!app) throw new ResponseError(404, 'Application not found')

    if (user.role === 'STUDENT') {
      const spId = await requireStudentProfileId(user)
      if (app.studentId !== spId) throw new ResponseError(403, 'Not your application')
    } else if (user.role === 'RECRUITER') {
      const myCompanyId = await requireRecruiterCompanyId(user)
      if (!myCompanyId || myCompanyId !== app.job.companyId) {
        throw new ResponseError(403, 'You do not own this company')
      }
    } else if (user.role !== 'OFFICER' && user.role !== 'ADMIN') {
      throw new ResponseError(403, 'Insufficient permissions')
    }

    return Response.json({
      id: app.id,
      studentId: app.studentId,
      student: app.student,
      jobId: app.jobId,
      job: app.job,
      resume: app.resume,
      status: app.status,
      appliedAt: app.appliedAt,
      coverLetter: app.coverLetter,
      notes: app.notes,
      events: app.events,
      interviews: app.interviews,
      offer: app.offer,
    })
  } catch (err) {
    return errorResponse(err)
  }
}

const patchSchema = z.object({
  status: z.enum(['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'ASSESSMENT', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN']),
  reason: z.string().max(500).optional(),
})

// PATCH /api/applications/[id] — OFFICER or RECRUITER (if owns company).
// STUDENT may withdraw their own application: newStatus must be 'WITHDRAWN'.
// Validate allowed transitions. Create ApplicationEvent with previousStatus, newStatus, actorId, reason.
// If status='OFFER', auto-create Offer record (placeholder). Notify student.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser(req)
    const { id } = await params

    const body = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      throw new ResponseError(400, 'Invalid input: ' + (parsed.error.issues[0]?.message ?? 'validation error'))
    }
    const { status: newStatus, reason } = parsed.data

    const app = await db.application.findUnique({
      where: { id },
      include: { job: { include: { company: true } }, student: true },
    })
    if (!app) throw new ResponseError(404, 'Application not found')

    // STUDENT role can only WITHDRAW their own application.
    if (user.role === 'STUDENT') {
      const spId = await requireStudentProfileId(user)
      if (app.studentId !== spId) throw new ResponseError(403, 'Not your application')
      if (newStatus !== 'WITHDRAWN') {
        throw new ResponseError(403, 'Students can only withdraw applications')
      }
    } else if (user.role === 'RECRUITER') {
      const myCompanyId = await requireRecruiterCompanyId(user)
      if (!myCompanyId || myCompanyId !== app.job.companyId) {
        throw new ResponseError(403, 'You do not own this company')
      }
    } else if (user.role !== 'OFFICER' && user.role !== 'ADMIN') {
      throw new ResponseError(403, 'Insufficient permissions')
    }

    // Validate transition
    const allowed = allowedTransitions[app.status] ?? []
    if (!allowed.includes(newStatus)) {
      throw new ResponseError(
        409,
        `Invalid transition from ${app.status} to ${newStatus}. Allowed: ${allowed.join(', ') || '(terminal)'}`
      )
    }

    // Update + create event in a transaction
    const updated = await db.$transaction(async (tx) => {
      const prevStatus = app.status
      const updatedApp = await tx.application.update({
        where: { id },
        data: { status: newStatus },
      })

      await tx.applicationEvent.create({
        data: {
          applicationId: id,
          previousStatus: prevStatus,
          newStatus,
          actorId: user.id,
          reason: reason ?? null,
        },
      })

      // If OFFER, auto-create Offer placeholder if it doesn't exist
      if (newStatus === 'OFFER') {
        await tx.offer.upsert({
          where: { applicationId: id },
          update: {},
          create: {
            applicationId: id,
            decision: 'PENDING',
          },
        })
      }

      return updatedApp
    })

    // Notify student
    const studentUserId = await getStudentUserId(app.studentId)
    if (studentUserId) {
      await notifyUsers([studentUserId], {
        type: 'application_status',
        title: `Application updated to ${newStatus}`,
        message: `Your application for ${app.job.title} is now ${newStatus}${reason ? ': ' + reason : ''}`,
        link: `/applications/${id}`,
      })
    }

    await db.auditEvent.create({
      data: {
        actorId: user.id,
        action: 'APPLICATION_STATUS_CHANGED',
        targetType: 'Application',
        targetId: id,
        metadata: JSON.stringify({ previousStatus: app.status, newStatus, reason }),
      },
    })

    return Response.json({
      id,
      previousStatus: app.status,
      newStatus: updated.status,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
