import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  hashPassword, createSessionToken, makeSessionCookieHeader,
  errorResponse, ResponseError,
} from '@/lib/auth'
import { z } from 'zod'

// PUBLIC registration schema.
//
// SECURITY: public (anonymous) registration is restricted to STUDENT accounts.
// OFFICER, ADMIN, and RECRUITER roles must be provisioned through a trusted
// administrative workflow (seed script, admin invite, or officer-approval
// flow) — NOT through this public endpoint.
//
// Any client-supplied `role` field is silently ignored; the role is forced
// to STUDENT. This prevents role-escalation attacks where an anonymous user
// could register as an OFFICER and gain access to the evidence-review queue,
// batch-ranking tools, or the audit log.
//
// See P0-A in the security review + tests in scripts/tests/registration.test.ts.

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('A valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  // Accept but IGNORE any client-supplied role — public registration is
  // STUDENT-only. We accept the field (rather than rejecting the request)
  // so that legitimate student sign-ups that happen to include role=STUDENT
  // are not broken.
  role: z.enum(['STUDENT', 'OFFICER', 'RECRUITER']).optional(),
  university: z.string().optional(),
  batch: z.string().optional(),
  branch: z.string().optional(),
})

// Trusted role provisioning is a separate workflow — see scripts/seed.ts
// for the demo officer/recruiter/admin accounts, and the README for the
// administrative invitation flow (to be implemented when an admin UI exists).
//
// DO NOT add OFFICER or RECRUITER creation to this public route.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      throw new ResponseError(400, 'Invalid input: ' + (parsed.error.issues[0]?.message ?? 'validation error'))
    }

    // SECURITY: force role to STUDENT regardless of what the client sent.
    // If a privileged role was requested, log it (server-side only, no PII)
    // so administrators can audit attempted escalation.
    const requestedRole = parsed.data.role
    if (requestedRole && requestedRole !== 'STUDENT') {
      // We do NOT echo the email or any PII here — just the event.
      console.warn('[security] Public registration attempted privileged role:', requestedRole, '(forced to STUDENT)')
    }
    const role = 'STUDENT' as const

    const { name, email, password } = parsed.data

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

    // STUDENT profile creation (the only role public registration can produce)
    await db.studentProfile.create({
      data: {
        userId: user.id,
        university: parsed.data.university ?? 'Not specified',
        batch: parsed.data.batch,
        branch: parsed.data.branch,
        profileCompletion: 20,
      },
    })

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
  // Public endpoint existence check — does not return any sensitive info.
  return Response.json({ ok: true, publicRegistration: 'STUDENT_ONLY' })
}
