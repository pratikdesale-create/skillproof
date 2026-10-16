import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError } from '@/lib/auth'
import { requireUser, requireStudentProfileId } from '@/lib/api-helpers'

// GET /api/resumes/[id] — owner student. Return resume with bullets and their evidence references.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser(req)
    const spId = await requireStudentProfileId(user)
    const { id } = await params

    const resume = await db.resume.findUnique({
      where: { id },
      include: {
        bullets: { orderBy: { orderIndex: 'asc' } },
        job: { select: { id: true, title: true } },
      },
    })
    if (!resume) throw new ResponseError(404, 'Resume not found')
    if (resume.studentId !== spId) throw new ResponseError(403, 'Not your resume')

    // Collect all referenced evidence IDs
    const evidenceIds = new Set<string>()
    for (const b of resume.bullets) {
      if (b.evidenceIds) {
        try {
          const arr = JSON.parse(b.evidenceIds) as string[]
          arr.forEach(eid => evidenceIds.add(eid))
        } catch { /* ignore */ }
      }
    }
    const evidenceRecords = await db.evidence.findMany({
      where: { id: { in: Array.from(evidenceIds) } },
      select: { id: true, title: true, type: true, status: true, sourceUrl: true, organization: true },
    })
    const evidenceMap = new Map(evidenceRecords.map(e => [e.id, e]))

    return Response.json({
      id: resume.id,
      title: resume.title,
      version: resume.version,
      jobId: resume.jobId,
      job: resume.job,
      isGenerated: resume.isGenerated,
      summary: resume.summary,
      content: resume.content ? JSON.parse(resume.content) : null,
      claimValidation: resume.claimValidation ? JSON.parse(resume.claimValidation) : null,
      pdfPath: resume.pdfPath,
      docxPath: resume.docxPath,
      createdAt: resume.createdAt,
      updatedAt: resume.updatedAt,
      bullets: resume.bullets.map(b => ({
        id: b.id,
        section: b.section,
        text: b.text,
        skillIds: b.skillIds ? JSON.parse(b.skillIds) : [],
        evidenceIds: b.evidenceIds ? JSON.parse(b.evidenceIds) : [],
        claimStatus: b.claimStatus,
        orderIndex: b.orderIndex,
        evidence: (b.evidenceIds ? JSON.parse(b.evidenceIds) as string[] : [])
          .map(eid => evidenceMap.get(eid))
          .filter(Boolean),
      })),
    })
  } catch (err) {
    return errorResponse(err)
  }
}
