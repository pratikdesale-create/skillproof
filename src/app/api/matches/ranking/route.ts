import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError, requireRole } from '@/lib/auth'
import { requireUser, getPagination, safeParseJson } from '@/lib/api-helpers'

// GET /api/matches/ranking?jobId=... — OFFICER.
// Same as /api/matches/job/[id] but also returns CSV if ?format=csv.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req)
    requireRole(user, 'OFFICER', 'ADMIN')

    const url = new URL(req.url)
    const jobId = url.searchParams.get('jobId')
    if (!jobId) throw new ResponseError(400, 'jobId query param required')

    const minScoreRaw = url.searchParams.get('minScore')
    const minScore = minScoreRaw ? parseFloat(minScoreRaw) : 0
    const format = url.searchParams.get('format')
    const { skip, take } = getPagination(req)

    const where: Record<string, unknown> = {
      jobId,
      fitScore: { gte: Number.isFinite(minScore) ? minScore : 0 },
    }

    const [matches, total] = await Promise.all([
      db.matchResult.findMany({
        where,
        skip,
        take,
        orderBy: { fitScore: 'desc' },
        include: {
          student: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      }),
      db.matchResult.count({ where }),
    ])

    const rows = matches.map((m, i) => {
      const missing = safeParseJson<unknown[]>(m.missingSkills, []) ?? []
      const missingArray = Array.isArray(missing) ? missing : []
      const missingSkillsCsv = missingArray
        .map((s: unknown) => (typeof s === 'object' && s && 'name' in s ? String((s as { name: string }).name) : ''))
        .filter(Boolean)
        .join(';')
      return {
        rank: skip + i + 1,
        matchId: m.id,
        jobId: m.jobId,
        studentId: m.studentId,
        studentName: m.student.user.name,
        batch: m.student.batch ?? '',
        branch: m.student.branch ?? '',
        cgpa: m.student.cgpa ?? '',
        fitScore: m.fitScore,
        requiredCoverage: m.requiredCoverage,
        preferredCoverage: m.preferredCoverage,
        missingSkillsCount: missingArray.length,
        missingSkillsCsv,
      }
    })

    if (format === 'csv') {
      const headers = [
        'rank', 'studentName', 'batch', 'branch', 'cgpa',
        'fitScore', 'requiredCoverage', 'missingSkillsCount', 'missingSkillsCsv',
      ]
      const csvLines = [
        headers.join(','),
        ...rows.map(r => [
          r.rank,
          csvEscape(r.studentName),
          csvEscape(String(r.batch)),
          csvEscape(String(r.branch)),
          r.cgpa,
          r.fitScore,
          r.requiredCoverage,
          r.missingSkillsCount,
          csvEscape(r.missingSkillsCsv),
        ].join(',')),
      ]
      return new Response(csvLines.join('\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="job-${jobId}-ranking.csv"`,
        },
      })
    }

    return Response.json({ data: rows, total, skip, take })
  } catch (err) {
    return errorResponse(err)
  }
}

function csvEscape(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}
