import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError, requireRole } from '@/lib/auth'
import { requireUser, getStudentUserId, notifyUsers } from '@/lib/api-helpers'
import { z } from 'zod'

const reviewSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'REQUEST_MORE']),
  reason: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
})

const ACTION_TO_STATUS: Record<string, string> = {
  APPROVE: 'VERIFIED',
  REJECT: 'REJECTED',
  REQUEST_MORE: 'NEEDS_MORE_EVIDENCE',
}

// POST /api/evidence/[id]/review — OFFICER only.
// Body: { action: 'APPROVE'|'REJECT'|'REQUEST_MORE', reason?, notes? }
// Create EvidenceReview record, update evidence.status, set reviewerId, reviewedAt.
// Create AuditEvent. Create notification for student.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser(req)
    requireRole(user, 'OFFICER', 'ADMIN')
    const { id } = await params

    const body = await req.json()
    const parsed = reviewSchema.safeParse(body)
    if (!parsed.success) {
      throw new ResponseError(400, 'Invalid input: ' + (parsed.error.issues[0]?.message ?? 'validation error'))
    }
    const { action, reason, notes } = parsed.data
    const newStatus = ACTION_TO_STATUS[action]

    const evidence = await db.evidence.findUnique({
      where: { id },
      include: { student: true },
    })
    if (!evidence) throw new ResponseError(404, 'Evidence not found')

    const now = new Date()
    // Create the review record
    const review = await db.evidenceReview.create({
      data: {
        evidenceId: id,
        reviewerId: user.id,
        action,
        status: newStatus,
        reason: reason ?? null,
        notes: notes ?? null,
      },
    })

    // Update evidence status
    await db.evidence.update({
      where: { id },
      data: {
        status: newStatus,
        reviewerId: user.id,
        reviewerNotes: notes ?? evidence.reviewerNotes,
        reviewedAt: now,
      },
    })

    // If verified, mark related StudentSkill as verified (if exists for any skill this evidence supports)
    if (newStatus === 'VERIFIED') {
      const evidenceSkills = await db.evidenceSkill.findMany({
        where: { evidenceId: id },
        select: { skillId: true },
      })
      for (const es of evidenceSkills) {
        await db.studentSkill.updateMany({
          where: {
            studentId: evidence.studentId,
            skillId: es.skillId,
          },
          data: {
            isVerified: true,
            source: 'evidence',
          },
        })
      }
    }

    // Audit event
    await db.auditEvent.create({
      data: {
        actorId: user.id,
        action: 'EVIDENCE_REVIEW',
        targetType: 'Evidence',
        targetId: id,
        reason: `${action} → ${newStatus}`,
        metadata: JSON.stringify({ action, newStatus, reason, notes }),
      },
    })

    // Notify student
    const studentUserId = await getStudentUserId(evidence.studentId)
    if (studentUserId) {
      await notifyUsers([studentUserId], {
        type: 'evidence_status',
        title: `Evidence ${action.toLowerCase()}`,
        message: `Your evidence "${evidence.title}" has been ${action.toLowerCase()}${reason ? ': ' + reason : ''}`,
        link: `/evidence/${id}`,
      })
    }

    return Response.json({
      reviewId: review.id,
      evidenceId: id,
      action,
      newStatus,
      reviewerId: user.id,
      reviewedAt: now,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
