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

// Application status ordering — used to decide whether to advance the stage
const STAGE_ORDER: Record<string, number> = {
  APPLIED: 1,
  UNDER_REVIEW: 2,
  SHORTLISTED: 3,
  ASSESSMENT: 4,
  INTERVIEW: 5,
  OFFER: 6,
  REJECTED: 0,
  WITHDRAWN: 0,
}

const createInterviewSchema = z.object({
  scheduledAt: z.string().datetime(),
  duration: z.number().int().min(5).max(480).optional(),
  location: z.string().optional(),
  meetingUrl: z.string().url().optional().or(z.literal('')),
  type: z.enum(['TECHNICAL', 'HR', 'MANAGERIAL', 'GROUP']).optional(),
  round: z.number().int().min(1).max(20).optional(),
  notes: z.string().max(2000).optional(),
})

// POST /api/applications/[id]/interview — OFFICER or RECRUITER.
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
    const parsed = createInterviewSchema.safeParse(body)
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

    const scheduledAt = new Date(data.scheduledAt)
    const interview = await db.interview.create({
      data: {
        applicationId: id,
        scheduledAt,
        duration: data.duration ?? null,
        location: data.location ?? null,
        meetingUrl: data.meetingUrl ? data.meetingUrl : null,
        type: data.type ?? 'TECHNICAL',
        round: data.round ?? 1,
        notes: data.notes ?? null,
      },
    })

    // Update application status to INTERVIEW if currently earlier stage
    let statusChanged = false
    if ((STAGE_ORDER[app.status] ?? 0) < STAGE_ORDER.INTERVIEW) {
      await db.$transaction(async (tx) => {
        await tx.application.update({ where: { id }, data: { status: 'INTERVIEW' } })
        await tx.applicationEvent.create({
          data: {
            applicationId: id,
            previousStatus: app.status,
            newStatus: 'INTERVIEW',
            actorId: user.id,
            reason: `Interview scheduled for round ${data.round ?? 1}`,
          },
        })
      })
      statusChanged = true
    }

    // Notify student
    const studentUserId = await getStudentUserId(app.studentId)
    if (studentUserId) {
      await notifyUsers([studentUserId], {
        type: 'interview_scheduled',
        title: 'Interview scheduled',
        message: `Interview for ${app.job.title} scheduled at ${scheduledAt.toISOString()}`,
        link: `/applications/${id}`,
      })
    }

    return Response.json({
      interview,
      applicationStatusChanged: statusChanged,
    }, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
