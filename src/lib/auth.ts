import { db } from './db'
import crypto from 'crypto'

// Password hashing using PBKDF2 (Node built-in, no external deps)
const ITERATIONS = 120000
const KEYLEN = 64
const SALTLEN = 16

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALTLEN)
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, 'sha512')
  return `pbkdf2$${ITERATIONS}$${salt.toString('hex')}$${hash.toString('hex')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const parts = stored.split('$')
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
    const iter = parseInt(parts[1], 10)
    const salt = Buffer.from(parts[2], 'hex')
    const storedHash = parts[3]
    const hash = crypto.pbkdf2Sync(password, salt, iter, KEYLEN, 'sha512')
    return crypto.timingSafeEqual(Buffer.from(storedHash, 'hex'), hash)
  } catch {
    return false
  }
}

// Session token = base64(userId + ':' + random + ':' + signature)
//
// SECURITY (P0-B): the session secret MUST come from the environment.
// In production we FAIL CLOSED if SESSION_SECRET is missing or too short,
// rather than falling back to a predictable default. A predictable secret
// would let an attacker forge session tokens and sign in as any user.
//
// In development (NODE_ENV !== 'production'), a non-secret fallback is
// permitted ONLY so the demo can run without manual env setup — but we
// log a loud warning so developers set the env var before deploying.

const MIN_SECRET_LENGTH = 32

function resolveSessionSecret(): string {
  const envSecret = process.env.SESSION_SECRET
  const isProd = process.env.NODE_ENV === 'production'

  if (envSecret && envSecret.length >= MIN_SECRET_LENGTH) {
    return envSecret
  }

  if (isProd) {
    // FAIL CLOSED in production at REQUEST TIME (not at module-load / build
    // time). Throwing here prevents tokens from being signed with a
    // predictable secret.
    //
    // NOTE: this function is called LAZILY by getSessionSecret() — see
    // below — so that `next build` (which sets NODE_ENV=production) can
    // succeed without SESSION_SECRET being set in the build environment.
    // The secret is only required when an actual request tries to sign or
    // verify a session token.
    throw new Error(
      '[security] SESSION_SECRET is missing or too short (min ' + MIN_SECRET_LENGTH +
      ' chars). Set it in your environment before running in production. ' +
      'Generate one with: openssl rand -hex 32'
    )
  }

  // Development only — log loud warning on first use.
  console.warn(
    '[security] SESSION_SECRET not set or too short. Using an INSECURE dev-only fallback. ' +
    'This MUST NOT be used in production. Set SESSION_SECRET=' +
    '"$(openssl rand -hex 32)" in .env before deploying.'
  )
  return 'skillproof-dev-only-insecure-fallback-DO-NOT-USE-IN-PROD'
}

// LAZY resolver: the secret is resolved only when first needed (at request
// time), NOT at module-load time. This lets `next build` succeed in
// production without SESSION_SECRET being set in the build environment —
// the secret is only required when an actual request tries to sign or
// verify a session token.
let _SESSION_SECRET: string | null = null
function getSessionSecret(): string {
  if (_SESSION_SECRET === null) {
    _SESSION_SECRET = resolveSessionSecret()
  }
  return _SESSION_SECRET
}

export function createSessionToken(userId: string): string {
  const payload = `${userId}:${Date.now()}:${crypto.randomBytes(16).toString('hex')}`
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('hex')
  return Buffer.from(`${payload}:${sig}`).toString('base64')
}

export function parseSessionToken(token: string): { userId: string; ts: number } | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8')
    const parts = decoded.split(':')
    if (parts.length !== 4) return null
    const [userId, ts, rand, sig] = parts
    const payload = `${userId}:${ts}:${rand}`
    const expectedSig = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('hex')
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null
    return { userId, ts: parseInt(ts, 10) }
  } catch {
    return null
  }
}

export interface AuthUser {
  id: string
  email: string
  name: string
  role: 'STUDENT' | 'OFFICER' | 'RECRUITER' | 'ADMIN'
  avatarUrl?: string | null
  phone?: string | null
}

export async function getUserFromCookies(cookieHeader: string | null | undefined): Promise<AuthUser | null> {
  if (!cookieHeader) return null
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const idx = c.indexOf('=')
      if (idx === -1) return ['', '']
      return [c.slice(0, idx).trim(), c.slice(idx + 1).trim()]
    })
  )
  const token = cookies['ph_session']
  if (!token) return null
  const parsed = parseSessionToken(token)
  if (!parsed) return null
  // sessions expire after 7 days
  if (Date.now() - parsed.ts > 7 * 24 * 60 * 60 * 1000) return null
  const user = await db.user.findUnique({
    where: { id: parsed.userId },
    select: { id: true, email: true, name: true, role: true, avatarUrl: true, phone: true },
  })
  if (!user) return null
  return user as AuthUser
}

export const SESSION_COOKIE = 'ph_session'

export function makeSessionCookieHeader(token: string, maxAgeSeconds = 7 * 24 * 60 * 60) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${
    process.env.NODE_ENV === 'production' ? '; Secure' : ''
  }`
}

export function makeClearCookieHeader() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

// Role guard helpers
export function requireRole(user: AuthUser | null, ...roles: AuthUser['role'][]) {
  if (!user) throw new ResponseError(401, 'Authentication required')
  if (!roles.includes(user.role)) throw new ResponseError(403, 'Insufficient permissions')
}

export class ResponseError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function errorResponse(err: unknown) {
  if (err instanceof ResponseError) {
    // Known application error — safe to expose the message to the client.
    return Response.json({ error: err.message }, { status: err.status })
  }
  // Unknown / unexpected error — log the full details server-side only,
  // return a generic message to the client to avoid leaking stack traces,
  // internal paths, or sensitive information that might appear in error
  // messages from Prisma or other libraries.
  // SECURITY: do NOT include `err.message` in the response body.
  // Do NOT include `err.stack` in the response body.
  // Do NOT log `err` if it might contain user data — instead log only
  // the name, message and (in dev) the stack.
  if (process.env.NODE_ENV !== 'production') {
    console.error('[unhandled-error]', err instanceof Error ? err.stack : err)
  } else {
    // Production: log only the error name + message (no stack, no full object).
    // This keeps server logs readable without leaking sensitive request data.
    console.error('[unhandled-error]', err instanceof Error ? err.name : typeof err, err instanceof Error ? err.message : 'no-message')
  }
  return Response.json(
    { error: 'Internal server error. Please try again or contact support if the problem persists.' },
    { status: 500 }
  )
}
