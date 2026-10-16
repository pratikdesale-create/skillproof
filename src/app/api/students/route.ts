import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError, requireRole } from '@/lib/auth'
import { requireUser, getPagination } from '@/lib/api-helpers'

// GET /api/students — OFFICER or RECRUITER only
// Paginated list with filters: ?search, ?batch, ?branch, ?minCgpa, ?verifiedOnly, ?skip, ?take
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req)
    requireRole(user, 'OFFICER', 'RECRUITER', 'ADMIN')

    const url = new URL(req.url)
    const search = url.searchParams.get('search')?.trim() || null
    const batch = url.searchParams.get('batch')?.trim() || null
    const branch = url.searchParams.get('branch')?.trim() || null
    const minCgpaRaw = url.searchParams.get('minCgpa')
    const minCgpa = minCgpaRaw ? parseFloat(minCgpaRaw) : null
    const verifiedOnly = url.searchParams.get('verifiedOnly') === 'true'

    const { skip, take } = getPagination(req)

    const where: Record<string, unknown> = { AND: [] as unknown[] }
    if (search) {
      where.AND = [
        ...(where.AND as unknown[]),
        {
          OR: [
            { user: { name: { contains: search } } },
            { user: { email: { contains: search } } },
            { location: { contains: search } },
            { university: { contains: search } },
          ],
        },
      ]
    }
    if (batch) (where.AND as unknown[]).push({ batch })
    if (branch) (where.AND as unknown[]).push({ branch: { contains: branch } })
    if (minCgpa != null && !Number.isNaN(minCgpa)) {
      (where.AND as unknown[]).push({ cgpa: { gte: minCgpa } })
    }
    if (verifiedOnly) {
      (where.AND as unknown[]).push({ skills: { some: { isVerified: true } } })
    }
    if ((where.AND as unknown[]).length === 0) delete where.AND

    const [students, total] = await Promise.all([
      db.studentProfile.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          university: true,
          batch: true,
          branch: true,
          cgpa: true,
          location: true,
          profileCompletion: true,
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          _count: {
            select: {
              skills: { where: verifiedOnly ? { isVerified: true } : undefined },
              evidence: true,
            },
          },
        },
      }),
      db.studentProfile.count({ where }),
    ])

    const data = students.map(s => ({
      id: s.id,
      name: s.user.name,
      email: s.user.email,
      avatarUrl: s.user.avatarUrl,
      university: s.university,
      batch: s.batch,
      branch: s.branch,
      cgpa: s.cgpa,
      location: s.location,
      skillsCount: s._count.skills,
      verifiedSkillsCount: verifiedOnly ? s._count.skills : null,
      evidenceCount: s._count.evidence,
      profileCompletion: s.profileCompletion,
    }))

    return Response.json({ data, total, skip, take })
  } catch (err) {
    return errorResponse(err)
  }
}
