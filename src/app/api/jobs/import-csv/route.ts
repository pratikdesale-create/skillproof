import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError, requireRole } from '@/lib/auth'
import { requireUser } from '@/lib/api-helpers'
import { normalizeSkills, clearNormalizationCache } from '@/lib/matching'
import { runDuplicateDetection } from '@/app/api/jobs/route'
import { z } from 'zod'

const bodySchema = z.object({
  csv: z.string().min(1),
})

// Minimal CSV parser: handles double-quoted fields and escaped quotes ("").
// Assumes the first row is a header. Returns rows as objects keyed by header.
function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++ }
        else inQuotes = false
      } else cur += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++
        lines.push(cur); cur = ''
      } else cur += ch
    }
  }
  if (cur.length > 0) lines.push(cur)

  const splitRow = (row: string): string[] => {
    const out: string[] = []
    let field = ''
    let inQ = false
    for (let i = 0; i < row.length; i++) {
      const ch = row[i]
      if (inQ) {
        if (ch === '"') {
          if (row[i + 1] === '"') { field += '"'; i++ }
          else inQ = false
        } else field += ch
      } else {
        if (ch === '"') inQ = true
        else if (ch === ',') { out.push(field); field = '' }
        else field += ch
      }
    }
    out.push(field)
    return out
  }

  if (lines.length === 0) return { headers: [], rows: [] }
  const headers = splitRow(lines[0]).map(h => h.trim())
  const rows = lines.slice(1).filter(l => l.trim() !== '').map(l => splitRow(l))
  return { headers, rows }
}

const numOrUndefined = (v?: string) => {
  if (!v || v.trim() === '') return undefined
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : undefined
}

// POST /api/jobs/import-csv — OFFICER only. Body: { csv: string }.
// Validate rows; return { imported, errors }.
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req)
    requireRole(user, 'OFFICER', 'ADMIN')

    const body = await req.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      throw new ResponseError(400, 'Invalid input: ' + (parsed.error.issues[0]?.message ?? 'validation error'))
    }

    const { headers, rows } = parseCsv(parsed.data.csv)
    if (!headers.length) {
      throw new ResponseError(400, 'CSV is empty or malformed')
    }
    const idx = (name: string) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase())

    const titleIdx = idx('title')
    const companyIdx = idx('company')
    const descriptionIdx = idx('description')
    if (titleIdx === -1 || companyIdx === -1 || descriptionIdx === -1) {
      throw new ResponseError(400, 'CSV must include at least title, company, and description headers')
    }

    const locationIdx = idx('location')
    const workArrIdx = idx('workarrangement')
    const empTypeIdx = idx('employmenttype')
    const minExpIdx = idx('minexperience')
    const maxExpIdx = idx('maxexperience')
    const salaryMinIdx = idx('salarymin')
    const salaryMaxIdx = idx('salarymax')
    const sourceUrlIdx = idx('sourceurl')
    const externalIdIdx = idx('externalid')
    const batchIdx = idx('batcheligible')
    const reqSkillsIdx = idx('requiredskills')
    const prefSkillsIdx = idx('preferredskills')

    clearNormalizationCache()

    const errors: Array<{ row: number; message: string }> = []
    let imported = 0

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      try {
        const title = row[titleIdx]?.trim()
        const companyName = row[companyIdx]?.trim()
        const description = row[descriptionIdx]?.trim()
        if (!title || !companyName || !description) {
          errors.push({ row: i + 2, message: 'Missing required field (title, company, or description)' })
          continue
        }

        // Find or create company
        let company = await db.company.findFirst({ where: { name: companyName } })
        if (!company) {
          company = await db.company.create({
            data: {
              name: companyName,
              ownerId: user.id,
            },
          })
        }

        const requiredSkillsRaw = reqSkillsIdx >= 0 ? (row[reqSkillsIdx] ?? '') : ''
        const preferredSkillsRaw = prefSkillsIdx >= 0 ? (row[prefSkillsIdx] ?? '') : ''
        const requiredSkillNames = requiredSkillsRaw ? requiredSkillsRaw.split(/[|;]+/).map(s => s.trim()).filter(Boolean) : []
        const preferredSkillNames = preferredSkillsRaw ? preferredSkillsRaw.split(/[|;]+/).map(s => s.trim()).filter(Boolean) : []

        const requiredNorm = requiredSkillNames.length ? await normalizeSkills(requiredSkillNames) : []
        const preferredNorm = preferredSkillNames.length ? await normalizeSkills(preferredSkillNames) : []
        const requiredResolved = requiredNorm.filter(r => r.canonical)
        const preferredResolved = preferredNorm.filter(r => r.canonical)

        const job = await db.job.create({
          data: {
            title,
            companyId: company.id,
            description,
            location: locationIdx >= 0 ? (row[locationIdx]?.trim() || null) : null,
            workArrangement: workArrIdx >= 0 ? (row[workArrIdx]?.trim() || null) : null,
            employmentType: empTypeIdx >= 0 ? (row[empTypeIdx]?.trim() || null) : null,
            minExperience: numOrUndefined(row[minExpIdx]) ?? null,
            maxExperience: numOrUndefined(row[maxExpIdx]) ?? null,
            salaryMin: numOrUndefined(row[salaryMinIdx]) ?? null,
            salaryMax: numOrUndefined(row[salaryMaxIdx]) ?? null,
            sourceUrl: sourceUrlIdx >= 0 ? (row[sourceUrlIdx]?.trim() || null) : null,
            externalId: externalIdIdx >= 0 ? (row[externalIdIdx]?.trim() || null) : null,
            batchEligible: batchIdx >= 0 ? (row[batchIdx]?.trim() || null) : null,
            status: 'OPEN',
            sourceType: 'CSV',
            requirements: {
              create: requiredResolved.map(r => ({
                skillId: r.canonical!.skillId,
                weight: 4,
                isRequired: true,
                minLevel: 'intermediate',
              })),
            },
          },
        })

        if (preferredResolved.length > 0) {
          await db.jobSkill.createMany({
            data: preferredResolved.map(r => ({
              jobId: job.id,
              skillId: r.canonical!.skillId,
              weight: 1,
              isRequired: false,
              minLevel: 'beginner',
            })),
          })
        }

        // Run duplicate detection per row (best-effort, do not fail import if it errors)
        try { await runDuplicateDetection(job.id) } catch { /* non-fatal */ }

        imported++
      } catch (e: unknown) {
        errors.push({
          row: i + 2,
          message: e instanceof Error ? e.message : 'Unknown error',
        })
      }
    }

    // Audit
    await db.auditEvent.create({
      data: {
        actorId: user.id,
        action: 'JOB_CSV_IMPORT',
        targetType: 'Job',
        metadata: JSON.stringify({ imported, errorCount: errors.length, rows: rows.length }),
      },
    })

    return Response.json({ imported, errors, totalRows: rows.length })
  } catch (err) {
    return errorResponse(err)
  }
}
