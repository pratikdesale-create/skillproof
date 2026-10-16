import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError } from '@/lib/auth'
import { requireUser, requireStudentProfileId } from '@/lib/api-helpers'

// GET /api/evidence/history/[id] — OFFICER or owner. List EvidenceReview records for an evidence.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser(req)
    const { id } = await params

    const evidence = await db.evidence.findUnique({
      where: { id },
      select: { id: true, studentId: true },
    })
    if (!evidence) throw new ResponseError(404, 'Evidence not found')

    if (user.role === 'STUDENT') {
      const spId = await requireStudentProfileId(user)
      if (evidence.studentId !== spId) throw new ResponseError(403, 'Not your evidence')
    } else if (user.role !== 'OFFICER' && user.role !== 'ADMIN') {
      throw new ResponseError(403, 'Insufficient permissions')
    }

    const reviews = await db.evidenceReview.findMany({
      where: { evidenceId: id },
      include: { reviewer: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const data = reviews.map(r => ({
      id: r.id,
      reviewerId: r.reviewerId,
      reviewerName: r.reviewer.name,
      action: r.action,
      status: r.status,
      reason: r.reason,
      notes: r.notes,
      createdAt: r.createdAt,
    }))

    return Response.json({ data })
  } catch (err) {
    return errorResponse(err)
  }
}
