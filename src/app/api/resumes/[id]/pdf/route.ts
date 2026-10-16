import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError } from '@/lib/auth'
import { requireUser } from '@/lib/api-helpers'
import { generateResumePdf } from '@/lib/pdf/resume'

// GET /api/resumes/[id]/pdf — stream the resume as a server-rendered PDF.
//
// Access policy: owner student OR OFFICER/ADMIN (recruiters excluded for now).
// Returns Content-Type: application/pdf with Content-Disposition inline so the
// browser can preview it; clients can override by appending ?download=1 to get
// an attachment.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser(req)
    const { id } = await params

    // Verify the resume exists + the caller is allowed to view it.
    const resume = await db.resume.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        studentId: true,
        student: { select: { userId: true } },
      },
    })
    if (!resume) throw new ResponseError(404, 'Resume not found')

    const isOfficerOrAdmin = user.role === 'OFFICER' || user.role === 'ADMIN'
    if (!isOfficerOrAdmin) {
      // Only the owner student may download their own resume.
      if (user.role !== 'STUDENT') {
        throw new ResponseError(403, 'Insufficient permissions')
      }
      if (resume.student.userId !== user.id) {
        throw new ResponseError(403, 'Not your resume')
      }
    }

    // Generate the PDF on the fly.
    const { buffer, filename } = await generateResumePdf(id)

    const wantsDownload = new URL(req.url).searchParams.get('download') === '1'
    const disposition = wantsDownload ? 'attachment' : 'inline'

    return new Response(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${filename.replace(/"/g, '')}"`,
        'Content-Length': String(buffer.byteLength),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    return errorResponse(err)
  }
}
