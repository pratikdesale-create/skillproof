// Shared helpers for API route handlers (does NOT modify auth.ts or matching.ts).

import { NextRequest } from 'next/server'
import { db } from './db'
import { AuthUser, ResponseError, getUserFromCookies } from './auth'

/** Authenticate or throw 401. */
export async function requireUser(req: NextRequest): Promise<NonNullable<AuthUser>> {
  const user = await getUserFromCookies(req.headers.get('cookie'))
  if (!user) throw new ResponseError(401, 'Authentication required')
  return user
}

/** Load the student profile id for the given user. Throws 403 if not a student. */
export async function requireStudentProfileId(user: AuthUser): Promise<string> {
  if (user.role !== 'STUDENT') throw new ResponseError(403, 'Students only')
  const sp = await db.studentProfile.findUnique({ where: { userId: user.id }, select: { id: true } })
  if (!sp) throw new ResponseError(403, 'Student profile not found')
  return sp.id
}

/** Load the recruiter's companyId (or null if not bound). Throws 403 if not a recruiter. */
export async function requireRecruiterCompanyId(user: AuthUser): Promise<string | null> {
  if (user.role !== 'RECRUITER') throw new ResponseError(403, 'Recruiters only')
  const rp = await db.recruiterProfile.findUnique({ where: { userId: user.id }, select: { companyId: true } })
  return rp?.companyId ?? null
}

/** Returns true if user is an officer. */
export function isOfficer(user: AuthUser): boolean {
  return user.role === 'OFFICER' || user.role === 'ADMIN'
}

/** Verify that the recruiter owns the given company; throw 403 otherwise. */
export function assertRecruiterOwnsCompany(user: AuthUser, companyId: string | null, targetCompanyId: string | undefined | null) {
  if (user.role === 'OFFICER' || user.role === 'ADMIN') return
  if (user.role !== 'RECRUITER') throw new ResponseError(403, 'Insufficient permissions')
  if (!targetCompanyId || !companyId || companyId !== targetCompanyId) {
    throw new ResponseError(403, 'You do not own this company')
  }
}

/** Parse pagination from query: ?take, ?skip — defaults take=20, skip=0; caps take at 100. */
export function getPagination(req: NextRequest) {
  const url = new URL(req.url)
  const skipRaw = parseInt(url.searchParams.get('skip') ?? '0', 10)
  const takeRaw = parseInt(url.searchParams.get('take') ?? '20', 10)
  const skip = Number.isFinite(skipRaw) && skipRaw >= 0 ? skipRaw : 0
  const take = Number.isFinite(takeRaw) && takeRaw > 0 ? Math.min(100, takeRaw) : 20
  return { skip, take }
}

/** Fan-out notifications to many users at once (skips empty list). */
export async function notifyUsers(
  userIds: string[],
  payload: { type: string; title: string; message: string; link?: string | null }
) {
  const uniq = Array.from(new Set(userIds))
  if (uniq.length === 0) return
  await db.notification.createMany({
    data: uniq.map(userId => ({ userId, ...payload })),
  })
}

/** Get all officer + admin user ids (for fan-out notifications). */
export async function getOfficerUserIds(): Promise<string[]> {
  const users = await db.user.findMany({
    where: { role: { in: ['OFFICER', 'ADMIN'] } },
    select: { id: true },
  })
  return users.map(u => u.id)
}

/** Get all recruiter user ids for a given company. */
export async function getRecruiterUserIdsForCompany(companyId: string): Promise<string[]> {
  const rps = await db.recruiterProfile.findMany({
    where: { companyId },
    select: { userId: true },
  })
  return rps.map(r => r.userId)
}

/** Get student user id from studentProfile id. */
export async function getStudentUserId(studentProfileId: string): Promise<string | null> {
  const sp = await db.studentProfile.findUnique({
    where: { id: studentProfileId },
    select: { userId: true },
  })
  return sp?.userId ?? null
}

/** Parse a JSON string field safely. Returns null on failure or for null/undefined. */
export function safeParseJson<T = unknown>(raw: string | null | undefined, fallback: T | null = null): T | null {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/** Compute profile completion 0..100 from a profile object. */
export function computeProfileCompletion(profile: {
  university?: string | null
  batch?: string | null
  branch?: string | null
  cgpa?: number | null
  bio?: string | null
  location?: string | null
  linkedinUrl?: string | null
  githubUser?: string | null
  portfolioUrl?: string | null
  graduationYear?: number | null
}, skillsCount = 0, evidenceCount = 0): number {
  const fields = [
    profile.university,
    profile.batch,
    profile.branch,
    profile.cgpa != null ? String(profile.cgpa) : null,
    profile.bio,
    profile.location,
    profile.linkedinUrl,
    profile.githubUser,
    profile.portfolioUrl,
    profile.graduationYear != null ? String(profile.graduationYear) : null,
  ]
  const filledFields = fields.filter(f => f != null && String(f).trim() !== '').length
  // 60% weight to fields, 20% to having >=1 skill, 20% to having >=1 evidence
  const fieldsScore = (filledFields / fields.length) * 60
  const skillsScore = skillsCount > 0 ? 20 : 0
  const evidenceScore = evidenceCount > 0 ? 20 : 0
  return Math.round(fieldsScore + skillsScore + evidenceScore)
}
