import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, verifyPassword, createSessionToken, makeSessionCookieHeader, makeClearCookieHeader, getUserFromCookies, errorResponse, ResponseError } from '@/lib/auth'
import { z } from 'zod'

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['STUDENT', 'OFFICER', 'RECRUITER']).default('STUDENT'),
  university: z.string().optional(),
  batch: z.string().optional(),
  branch: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      throw new ResponseError(400, 'Invalid input: ' + JSON.stringify(parsed.error.issues[0]?.message))
    }
    const { name, email, password, role } = parsed.data

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      throw new ResponseError(409, 'Email already registered. Please sign in.')
    }

    const user = await db.user.create({
      data: {
        email,
        name,
        role,
        passwordHash: hashPassword(password),
      },
    })

    if (role === 'STUDENT') {
      await db.studentProfile.create({
        data: {
          userId: user.id,
          university: parsed.data.university ?? 'Not specified',
          batch: parsed.data.batch,
          branch: parsed.data.branch,
          profileCompletion: 20,
        },
      })
    } else if (role === 'OFFICER') {
      await db.officerProfile.create({ data: { userId: user.id } })
    } else if (role === 'RECRUITER') {
      await db.recruiterProfile.create({ data: { userId: user.id, position: 'Recruiter' } })
    }

    const token = createSessionToken(user.id)
    const res = NextResponse.json({
      id: user.id, email: user.email, name: user.name, role: user.role,
    })
    res.headers.set('Set-Cookie', makeSessionCookieHeader(token))
    return res
  } catch (err) {
    return errorResponse(err)
  }
}

export async function GET() {
  return Response.json({ ok: true })
}
