import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError, requireRole } from '@/lib/auth'
import { requireUser } from '@/lib/api-helpers'
import { z } from 'zod'

const schema = z.object({
  action: z.enum(['CONFIRM_MERGE', 'REJECT']),
})

// POST /api/jobs/duplicates/[id]/resolve — OFFICER only.
// Body: { action: 'CONFIRM_MERGE' | 'REJECT' }
// If merge: mark duplicateJob.status='MERGED', archive the older job (status='ARCHIVED'),
// move any applications from archived job to the surviving job.
// If reject: status='REJECTED'.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser(req)
    requireRole(user, 'OFFICER', 'ADMIN')
    const { id } = await params

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      throw new ResponseError(400, 'Invalid input: ' + (parsed.error.issues[0]?.message ?? 'validation error'))
    }

    const dup = await db.duplicateJob.findUnique({
      where: { id },
      include: { jobA: true, jobB: true },
    })
    if (!dup) throw new ResponseError(404, 'Duplicate record not found')

    if (parsed.data.action === 'REJECT') {
      await db.duplicateJob.update({
        where: { id },
        data: {
          status: 'REJECTED',
          resolvedAt: new Date(),
          resolvedBy: user.id,
        },
      })
      await db.auditEvent.create({
        data: {
          actorId: user.id,
          action: 'DUPLICATE_REJECTED',
          targetType: 'DuplicateJob',
          targetId: id,
          metadata: JSON.stringify({ jobAId: dup.jobAId, jobBId: dup.jobBId }),
        },
      })
      return Response.json({ id, status: 'REJECTED' })
    }

    // CONFIRM_MERGE: older job is archived
    const jobA = dup.jobA
    const jobB = dup.jobB
    const olderJob = jobA.postingDate <= jobB.postingDate ? jobA : jobB
    const survivingJob = olderJob.id === jobA.id ? jobB : jobA

    const appsToMove = await db.application.findMany({
      where: { jobId: olderJob.id },
      select: { id: true, studentId: true, status: true, coverLetter: true, resumeId: true, appliedAt: true },
    })

    let moved = 0
    let deduped = 0
    await db.$transaction(async (tx) => {
      for (const app of appsToMove) {
        const existingApp = await tx.application.findUnique({
          where: { studentId_jobId: { studentId: app.studentId, jobId: survivingJob.id } },
        })
        if (existingApp) {
          // Student already applied to surviving job — drop the duplicate application but log the event.
          await tx.applicationEvent.create({
            data: {
              applicationId: existingApp.id,
              previousStatus: existingApp.status,
              newStatus: existingApp.status,
              actorId: user.id,
              reason: `Merged duplicate application from archived job ${olderJob.id}`,
            },
          })
          await tx.application.delete({ where: { id: app.id } })
          deduped++
        } else {
          await tx.application.update({
            where: { id: app.id },
            data: { jobId: survivingJob.id },
          })
          await tx.applicationEvent.create({
            data: {
              applicationId: app.id,
              previousStatus: app.status,
              newStatus: app.status,
              actorId: user.id,
              reason: `Merged from duplicate job ${olderJob.id}`,
            },
          })
          moved++
        }
      }

      // Archive the older job (preserve source refs/externalId)
      await tx.job.update({
        where: { id: olderJob.id },
        data: { status: 'ARCHIVED' },
      })

      await tx.duplicateJob.update({
        where: { id },
        data: {
          status: 'MERGED',
          resolvedAt: new Date(),
          resolvedBy: user.id,
          notes: `Merged ${olderJob.id} into ${survivingJob.id}`,
        },
      })
    })

    await db.auditEvent.create({
      data: {
        actorId: user.id,
        action: 'DUPLICATE_MERGED',
        targetType: 'DuplicateJob',
        targetId: id,
        metadata: JSON.stringify({
          archivedJobId: olderJob.id,
          survivingJobId: survivingJob.id,
          applicationsMoved: moved,
          applicationsDeduped: deduped,
        }),
      },
    })

    return Response.json({
      id,
      status: 'MERGED',
      archivedJobId: olderJob.id,
      survivingJobId: survivingJob.id,
      applicationsMoved: moved,
      applicationsDeduped: deduped,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
