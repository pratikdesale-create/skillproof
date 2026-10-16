import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError } from '@/lib/auth'
import { requireUser, requireStudentProfileId } from '@/lib/api-helpers'

// GET /api/resumes — STUDENT: own resumes.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req)
    const spId = await requireStudentProfileId(user)

    const resumes = await db.resume.findMany({
      where: { studentId: spId },
      orderBy: { createdAt: 'desc' },
      include: {
        job: { select: { id: true, title: true } },
        _count: { select: { bullets: true } },
      },
    })

    const data = resumes.map(r => ({
      id: r.id,
      jobId: r.jobId,
      jobTitle: r.job?.title ?? null,
      version: r.version,
      title: r.title,
      isGenerated: r.isGenerated,
      summary: r.summary,
      bulletCount: r._count.bullets,
      pdfPath: r.pdfPath,
      docxPath: r.docxPath,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))

    return Response.json({ data })
  } catch (err) {
    return errorResponse(err)
  }
}
