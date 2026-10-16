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
const SESSION_SECRET = process.env.SESSION_SECRET || 'placement-hub-dev-secret-change-me'

export function createSessionToken(userId: string): string {
  const payload = `${userId}:${Date.now()}:${crypto.randomBytes(16).toString('hex')}`
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex')
  return Buffer.from(`${payload}:${sig}`).toString('base64')
}

export function parseSessionToken(token: string): { userId: string; ts: number } | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8')
    const parts = decoded.split(':')
    if (parts.length !== 4) return null
    const [userId, ts, rand, sig] = parts
    const payload = `${userId}:${ts}:${rand}`
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex')
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
    return Response.json({ error: err.message }, { status: err.status })
  }
  console.error('Unhandled error:', err)
  return Response.json({ error: 'Internal server error' }, { status: 500 })
}
