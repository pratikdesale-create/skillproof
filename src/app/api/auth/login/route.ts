import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, createSessionToken, makeSessionCookieHeader, errorResponse, ResponseError } from '@/lib/auth'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      throw new ResponseError(400, 'Please provide email and password.')
    }
    const { email, password } = parsed.data
    const user = await db.user.findUnique({ where: { email } })
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new ResponseError(401, 'Invalid email or password.')
    }
    const token = createSessionToken(user.id)
    const res = NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
    })
    res.headers.set('Set-Cookie', makeSessionCookieHeader(token))
    return res
  } catch (err) {
    return errorResponse(err)
  }
}
