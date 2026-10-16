import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError } from '@/lib/auth'
import {
  requireUser,
  requireStudentProfileId,
  requireRecruiterCompanyId,
  getOfficerUserIds,
  getRecruiterUserIdsForCompany,
  notifyUsers,
} from '@/lib/api-helpers'
import { z } from 'zod'

// GET /api/applications — STUDENT: own. OFFICER: all (with filters).
// RECRUITER: applications for jobs of their company.
// Include student name, job title, company, status, appliedAt, resume.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req)

    const url = new URL(req.url)
    const statusFilter = url.searchParams.get('status')?.trim() || null
    const jobIdFilter = url.searchParams.get('jobId')?.trim() || null
    const companyIdFilter = url.searchParams.get('companyId')?.trim() || null

    const where: Record<string, unknown> = { AND: [] as unknown[] }

    if (user.role === 'STUDENT') {
      const spId = await requireStudentProfileId(user)
      ;(where.AND as unknown[]).push({ studentId: spId })
    } else if (user.role === 'OFFICER' || user.role === 'ADMIN') {
      // All — apply filters below
    } else if (user.role === 'RECRUITER') {
      const myCompanyId = await requireRecruiterCompanyId(user)
      if (!myCompanyId) {
        return Response.json({ data: [], total: 0 })
      }
      (where.AND as unknown[]).push({ job: { companyId: myCompanyId } })
    } else {
      throw new ResponseError(403, 'Insufficient permissions')
    }

    if (statusFilter) (where.AND as unknown[]).push({ status: statusFilter })
    if (jobIdFilter) (where.AND as unknown[]).push({ jobId: jobIdFilter })
    if (companyIdFilter) (where.AND as unknown[]).push({ job: { companyId: companyIdFilter } })
    if ((where.AND as unknown[]).length === 0) delete where.AND

    const apps = await db.application.findMany({
      where,
      orderBy: { appliedAt: 'desc' },
      take: 200,
      include: {
        student: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
        job: { include: { company: { select: { id: true, name: true } } } },
        resume: { select: { id: true, title: true } },
      },
    })

    const data = apps.map(a => ({
      id: a.id,
      studentId: a.studentId,
      studentName: a.student.user.name,
      studentEmail: a.student.user.email,
      studentAvatarUrl: a.student.user.avatarUrl,
      jobId: a.jobId,
      jobTitle: a.job.title,
      companyId: a.job.company.id,
      companyName: a.job.company.name,
      status: a.status,
      appliedAt: a.appliedAt,
      coverLetter: a.coverLetter,
      resume: a.resume,
    }))

    return Response.json({ data, total: data.length })
  } catch (err) {
    return errorResponse(err)
  }
}

const createSchema = z.object({
  jobId: z.string().min(1),
  resumeId: z.string().optional(),
  coverLetter: z.string().max(5000).optional(),
})

// POST /api/applications — STUDENT only. Body: { jobId, resumeId?, coverLetter? }.
// Check unique student+job. Create application with status='APPLIED',
// create ApplicationEvent with newStatus='APPLIED'. Notify OFFICER users + job's company recruiters.
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req)
    const spId = await requireStudentProfileId(user)

    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      throw new ResponseError(400, 'Invalid input: ' + (parsed.error.issues[0]?.message ?? 'validation error'))
    }
    const { jobId, resumeId, coverLetter } = parsed.data

    const job = await db.job.findUnique({
      where: { id: jobId },
      include: { company: { select: { id: true, name: true } } },
    })
    if (!job) throw new ResponseError(404, 'Job not found')
    if (job.status !== 'OPEN') throw new ResponseError(409, 'This job is no longer open for applications')

    // Check uniqueness
    const existing = await db.application.findUnique({
      where: { studentId_jobId: { studentId: spId, jobId } },
    })
    if (existing) throw new ResponseError(409, 'You have already applied to this job')

    // Optionally verify resume belongs to the student
    if (resumeId) {
      const resume = await db.resume.findUnique({ where: { id: resumeId } })
      if (!resume || resume.studentId !== spId) {
        throw new ResponseError(400, 'Invalid resume')
      }
    }

    const application = await db.application.create({
      data: {
        studentId: spId,
        jobId,
        resumeId: resumeId ?? null,
        coverLetter: coverLetter ?? null,
        status: 'APPLIED',
        events: {
          create: [{
            newStatus: 'APPLIED',
            actorId: user.id,
            reason: 'Initial application submitted',
          }],
        },
      },
      include: {
        job: { include: { company: { select: { id: true, name: true } } } },
      },
    })

    // Notify all officers
    const officerIds = await getOfficerUserIds()
    await notifyUsers(officerIds, {
      type: 'application_status',
      title: 'New application received',
      message: `Application for ${application.job.title} at ${application.job.company.name}`,
      link: `/applications/${application.id}`,
    })

    // Notify recruiters of the company
    if (application.job.company.id) {
      const recruiterIds = await getRecruiterUserIdsForCompany(application.job.company.id)
      await notifyUsers(recruiterIds, {
        type: 'application_status',
        title: 'New application received',
        message: `Application for ${application.job.title}`,
        link: `/applications/${application.id}`,
      })
    }

    return Response.json({
      id: application.id,
      jobId: application.jobId,
      studentId: application.studentId,
      status: application.status,
      appliedAt: application.appliedAt,
    }, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
