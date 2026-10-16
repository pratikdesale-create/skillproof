import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError } from '@/lib/auth'
import { requireUser, computeProfileCompletion } from '@/lib/api-helpers'
import { z } from 'zod'

const patchSchema = z.object({
  university: z.string().min(1).optional(),
  batch: z.string().optional(),
  branch: z.string().optional(),
  cgpa: z.number().min(0).max(10).optional(),
  bio: z.string().max(2000).optional(),
  location: z.string().optional(),
  linkedinUrl: z.string().url().optional().or(z.literal('')),
  githubUser: z.string().optional(),
  portfolioUrl: z.string().url().optional().or(z.literal('')),
  graduationYear: z.number().int().min(1900).max(2100).optional(),
})

// PATCH /api/students/profile — STUDENT only. Update own profile.
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser(req)
    if (user.role !== 'STUDENT') throw new ResponseError(403, 'Students only')

    const body = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      throw new ResponseError(400, 'Invalid input: ' + (parsed.error.issues[0]?.message ?? 'validation error'))
    }
    const data = parsed.data
    // Normalize empty strings to null
    const cleaned: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(data)) {
      cleaned[k] = v === '' ? null : v
    }

    const existing = await db.studentProfile.findUnique({ where: { userId: user.id } })
    if (!existing) throw new ResponseError(404, 'Profile not found')

    // Recalculate completion
    const [skillsCount, evidenceCount] = await Promise.all([
      db.studentSkill.count({ where: { studentId: existing.id } }),
      db.evidence.count({ where: { studentId: existing.id } }),
    ])
    const profileCompletion = computeProfileCompletion(
      { ...existing, ...cleaned },
      skillsCount,
      evidenceCount
    )

    const updated = await db.studentProfile.update({
      where: { id: existing.id },
      data: { ...cleaned, profileCompletion },
      select: {
        id: true, userId: true, university: true, batch: true, branch: true,
        cgpa: true, bio: true, location: true, linkedinUrl: true, githubUser: true,
        portfolioUrl: true, graduationYear: true, profileCompletion: true,
      },
    })

    return Response.json({ profile: updated })
  } catch (err) {
    return errorResponse(err)
  }
}
