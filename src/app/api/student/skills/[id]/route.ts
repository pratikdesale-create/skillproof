import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError } from '@/lib/auth'
import { requireUser, requireStudentProfileId, computeProfileCompletion } from '@/lib/api-helpers'

// DELETE /api/student/skills/[id] — STUDENT only. Delete own student skill.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser(req)
    const spId = await requireStudentProfileId(user)
    const { id } = await params

    const skill = await db.studentSkill.findUnique({ where: { id } })
    if (!skill) throw new ResponseError(404, 'Skill not found')
    if (skill.studentId !== spId) throw new ResponseError(403, 'Not your skill')

    await db.studentSkill.delete({ where: { id } })

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
