import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError } from '@/lib/auth'
import { requireUser } from '@/lib/api-helpers'
import { hashPassword, verifyPassword } from '@/lib/auth'
import { z } from 'zod'

// GET /api/settings — any authenticated. Returns current account info.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req)
    const full = await db.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, name: true, role: true, phone: true, avatarUrl: true },
    })
    return Response.json({ user: full })
  } catch (err) {
    return errorResponse(err)
  }
}

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
})

// PATCH /api/settings — update basic account info
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser(req)
    const body = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      throw new ResponseError(400, 'Invalid input: ' + JSON.stringify(parsed.error.issues[0]?.message))
    }
    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone } : {}),
        ...(parsed.data.avatarUrl !== undefined ? { avatarUrl: parsed.data.avatarUrl } : {}),
      },
      select: { id: true, email: true, name: true, role: true, phone: true, avatarUrl: true },
    })
    return Response.json({ user: updated })
  } catch (err) {
    return errorResponse(err)
  }
}

// POST /api/settings/password — change password
const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
})

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req)
    const body = await req.json()
    // Determine if this is a password change
    if (body && 'currentPassword' in body && 'newPassword' in body) {
      const parsed = passwordSchema.safeParse(body)
      if (!parsed.success) {
        throw new ResponseError(400, 'Password must be at least 6 characters.')
      }
      const full = await db.user.findUnique({ where: { id: user.id } })
      if (!full) throw new ResponseError(404, 'User not found')
      if (!verifyPassword(parsed.data.currentPassword, full.passwordHash)) {
        throw new ResponseError(401, 'Current password is incorrect.')
      }
      const newHash = hashPassword(parsed.data.newPassword)
      await db.user.update({ where: { id: user.id }, data: { passwordHash: newHash } })
      return Response.json({ ok: true })
    }
    throw new ResponseError(400, 'Invalid request')
  } catch (err) {
    return errorResponse(err)
  }
}
