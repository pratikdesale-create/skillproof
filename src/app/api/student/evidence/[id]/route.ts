import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError } from '@/lib/auth'
import { requireUser, requireStudentProfileId, computeProfileCompletion } from '@/lib/api-helpers'

// DELETE /api/student/evidence/[id] — STUDENT only (only if status != VERIFIED).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser(req)
    const spId = await requireStudentProfileId(user)
    const { id } = await params

    const evidence = await db.evidence.findUnique({ where: { id } })
    if (!evidence) throw new ResponseError(404, 'Evidence not found')
    if (evidence.studentId !== spId) throw new ResponseError(403, 'Not your evidence')
    if (evidence.status === 'VERIFIED') {
      throw new ResponseError(409, 'Cannot delete verified evidence')
    }

    await db.evidence.delete({ where: { id } })

    // Update profile completion
    const [skillsCount, evidenceCount, profile] = await Promise.all([
      db.studentSkill.count({ where: { studentId: spId } }),
      db.evidence.count({ where: { studentId: spId } }),
      db.studentProfile.findUnique({ where: { id: spId } }),
    ])
    if (profile) {
      const profileCompletion = computeProfileCompletion(profile, skillsCount, evidenceCount)
      await db.studentProfile.update({
        where: { id: spId },
        data: { profileCompletion },
      })
    }

    return Response.json({ ok: true, id })
  } catch (err) {
    return errorResponse(err)
  }
}
