import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError } from '@/lib/auth'
import { requireUser, requireRecruiterCompanyId, getPagination } from '@/lib/api-helpers'
import { normalizeSkills, clearNormalizationCache, detectDuplicate } from '@/lib/matching'
import { z } from 'zod'

// Reusable: run duplicate detection for a new/edited job against all OPEN jobs.
export async function runDuplicateDetection(jobId: string) {
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: { company: { select: { name: true } } },
  })
  if (!job) return []
  const others = await db.job.findMany({
    where: {
      id: { not: jobId },
      status: 'OPEN',
    },
    include: { company: { select: { name: true } } },
  })

  const created: Array<{ id: string; similarity: number; reasons: string[]; duplicateJobId: string }> = []
  for (const other of others) {
    // Skip if a DuplicateJob record already exists between these two
    const existingDup = await db.duplicateJob.findFirst({
      where: {
        OR: [
          { jobAId: jobId, jobBId: other.id },
          { jobAId: other.id, jobBId: jobId },
        ],
      },
    })
    if (existingDup && (existingDup.status === 'MERGED' || existingDup.status === 'CONFIRMED' || existingDup.status === 'POSSIBLE')) {
      // Skip duplicates we've already captured
      continue
    }
    const candidate = detectDuplicate(
      {
        id: job.id,
        title: job.title,
        company: job.company.name,
        location: job.location,
        description: job.description,
        sourceUrl: job.sourceUrl,
        externalId: job.externalId,
        sourceType: job.sourceType,
      },
      {
        id: other.id,
        title: other.title,
        company: other.company.name,
        location: other.location,
        description: other.description,
        sourceUrl: other.sourceUrl,
        externalId: other.externalId,
        sourceType: other.sourceType,
      }
    )
    if (candidate) {
      // DuplicateJob has no @@unique([jobAId, jobBId]) constraint, so use findFirst + create/update.
      const existingDup = await db.duplicateJob.findFirst({
        where: { jobAId: jobId, jobBId: other.id },
      })
      let dup
      if (existingDup) {
        dup = await db.duplicateJob.update({
          where: { id: existingDup.id },
          data: {
            similarity: candidate.similarity,
            reasons: JSON.stringify(candidate.reasons),
            status: candidate.status,
            detectedAt: new Date(),
          },
        })
      } else {
        dup = await db.duplicateJob.create({
          data: {
            jobAId: jobId,
            jobBId: other.id,
            similarity: candidate.similarity,
            reasons: JSON.stringify(candidate.reasons),
            status: candidate.status,
          },
        })
      }
      created.push({
        id: dup.id,
        duplicateJobId: dup.id,
        similarity: candidate.similarity,
        reasons: candidate.reasons,
      })
    }
  }
  return created
}

const workArrangementEnum = z.enum(['remote', 'hybrid', 'onsite'])
const employmentTypeEnum = z.enum(['full-time', 'internship', 'contract'])
const sourceTypeEnum = z.enum(['MANUAL', 'FEED', 'ALUMNI', 'API', 'CSV'])

const createJobSchema = z.object({
  title: z.string().min(1).max(200),
  companyId: z.string().min(1),
  description: z.string().min(1).max(10000),
  location: z.string().optional(),
  workArrangement: workArrangementEnum.optional(),
  employmentType: employmentTypeEnum.optional(),
  minExperience: z.number().int().min(0).optional(),
  maxExperience: z.number().int().min(0).optional(),
  salaryMin: z.number().int().min(0).optional(),
  salaryMax: z.number().int().min(0).optional(),
  applicationUrl: z.string().url().optional().or(z.literal('')),
  closingDate: z.string().datetime().optional(),
  batchEligible: z.string().optional(),
  eligibilityCriteria: z.string().optional(),
  sourceType: sourceTypeEnum.optional(),
  sourceUrl: z.string().url().optional().or(z.literal('')),
  externalId: z.string().optional(),
  requiredSkills: z.array(z.string().min(1)).default([]),
  preferredSkills: z.array(z.string().min(1)).default([]),
  skillWeights: z.record(z.string(), z.number()).optional(),
})

// GET /api/jobs — any authenticated. Paginated filters.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req)
    const url = new URL(req.url)
    const search = url.searchParams.get('search')?.trim() || null
    const batch = url.searchParams.get('batch')?.trim() || null
    const company = url.searchParams.get('company')?.trim() || null
    const location = url.searchParams.get('location')?.trim() || null
    const workArrangement = url.searchParams.get('workArrangement')?.trim() || null
    const status = url.searchParams.get('status')?.trim() || 'OPEN'

    const { skip, take } = getPagination(req)
    const where: Record<string, unknown> = { AND: [] as unknown[] }
    // Recruiters are scoped to their own company's jobs only.
    if (user.role === 'RECRUITER') {
      const myCompanyId = await requireRecruiterCompanyId(user)
      if (!myCompanyId) throw new ResponseError(403, 'Recruiter is not bound to a company')
      ;(where.AND as unknown[]).push({ companyId: myCompanyId })
    }
    if (search) {
      (where.AND as unknown[]).push({
        OR: [
          { title: { contains: search } },
          { description: { contains: search } },
          { company: { name: { contains: search } } },
        ],
      })
    }
    if (batch) (where.AND as unknown[]).push({ batchEligible: { contains: batch } })
    if (company) (where.AND as unknown[]).push({ company: { name: { contains: company } } })
    if (location) (where.AND as unknown[]).push({ location: { contains: location } })
    if (workArrangement) (where.AND as unknown[]).push({ workArrangement })
    if (status && status !== 'ALL') (where.AND as unknown[]).push({ status })
    if ((where.AND as unknown[]).length === 0) delete where.AND

    const [jobs, total] = await Promise.all([
      db.job.findMany({
        where,
        skip,
        take,
        orderBy: { postingDate: 'desc' },
        include: {
          company: { select: { id: true, name: true, industry: true } },
          requirements: { select: { id: true, isRequired: true } },
        },
      }),
      db.job.count({ where }),
    ])

    const data = jobs.map(j => {
      const requiredSkillCount = j.requirements.filter(r => r.isRequired).length
      const preferredSkillCount = j.requirements.length - requiredSkillCount
      return {
        id: j.id,
        title: j.title,
        companyId: j.companyId,
        company: j.company,
        location: j.location,
        workArrangement: j.workArrangement,
        employmentType: j.employmentType,
        minExperience: j.minExperience,
        maxExperience: j.maxExperience,
        salaryMin: j.salaryMin,
        salaryMax: j.salaryMax,
        closingDate: j.closingDate,
        batchEligible: j.batchEligible,
        sourceType: j.sourceType,
        postingDate: j.postingDate,
        status: j.status,
        requiredSkillCount,
        preferredSkillCount,
      }
    })

    return Response.json({ data, total, skip, take })
  } catch (err) {
    return errorResponse(err)
  }
}

// POST /api/jobs — OFFICER or RECRUITER (recruiter must own company).
// Normalize all skills. Create JobSkill rows (weight=4 required, weight=1 preferred).
// Run duplicate detection against all existing open jobs. Return job with duplicate flags.
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req)
    if (user.role !== 'OFFICER' && user.role !== 'ADMIN' && user.role !== 'RECRUITER') {
      throw new ResponseError(403, 'Insufficient permissions')
    }

    const body = await req.json()
    const parsed = createJobSchema.safeParse(body)
    if (!parsed.success) {
      throw new ResponseError(400, 'Invalid input: ' + (parsed.error.issues[0]?.message ?? 'validation error'))
    }
    const data = parsed.data

    // Verify company exists and recruiter owns it
    const company = await db.company.findUnique({ where: { id: data.companyId } })
    if (!company) throw new ResponseError(404, 'Company not found')
    if (user.role === 'RECRUITER') {
      const myCompanyId = await requireRecruiterCompanyId(user)
      if (!myCompanyId || myCompanyId !== data.companyId) {
        throw new ResponseError(403, 'You do not own this company')
      }
    }

    // Normalize all skills
    clearNormalizationCache()
    const requiredNorm = await normalizeSkills(data.requiredSkills)
    const preferredNorm = await normalizeSkills(data.preferredSkills)
    const requiredResolved = requiredNorm.filter(r => r.canonical)
    const preferredResolved = preferredNorm.filter(r => r.canonical)

    const job = await db.job.create({
      data: {
        title: data.title,
        companyId: data.companyId,
        description: data.description,
        location: data.location ?? null,
        workArrangement: data.workArrangement ?? null,
        employmentType: data.employmentType ?? null,
        minExperience: data.minExperience ?? null,
        maxExperience: data.maxExperience ?? null,
        salaryMin: data.salaryMin ?? null,
        salaryMax: data.salaryMax ?? null,
        applicationUrl: data.applicationUrl ? data.applicationUrl : null,
        closingDate: data.closingDate ? new Date(data.closingDate) : null,
        batchEligible: data.batchEligible ?? null,
        eligibilityCriteria: data.eligibilityCriteria ?? null,
        sourceType: data.sourceType ?? 'MANUAL',
        sourceUrl: data.sourceUrl ? data.sourceUrl : null,
        externalId: data.externalId ?? null,
        status: 'OPEN',
        requirements: {
          create: requiredResolved.map(r => ({
            skillId: r.canonical!.skillId,
            weight: data.skillWeights?.[r.rawName] ?? 4,
            isRequired: true,
            minLevel: 'intermediate',
          })),
        },
      },
      include: {
        requirements: { include: { skill: true } },
      },
    })

    // Create preferred skills separately (different isRequired flag)
    if (preferredResolved.length > 0) {
      await db.jobSkill.createMany({
        data: preferredResolved.map(r => ({
          jobId: job.id,
          skillId: r.canonical!.skillId,
          weight: data.skillWeights?.[r.rawName] ?? 1,
          isRequired: false,
          minLevel: 'beginner',
        })),
      })
    }

    // Duplicate detection
    const duplicates = await runDuplicateDetection(job.id)

    // Audit event
    await db.auditEvent.create({
      data: {
        actorId: user.id,
        action: 'JOB_CREATED',
        targetType: 'Job',
        targetId: job.id,
        metadata: JSON.stringify({ title: job.title, companyId: data.companyId, duplicateCount: duplicates.length }),
      },
    })

    return Response.json({
      id: job.id,
      title: job.title,
      companyId: job.companyId,
      status: job.status,
      sourceType: job.sourceType,
      postingDate: job.postingDate,
      requiredSkills: requiredResolved.map(r => ({ rawName: r.rawName, canonical: r.canonical })),
      preferredSkills: preferredResolved.map(r => ({ rawName: r.rawName, canonical: r.canonical })),
      unresolvedRequired: requiredNorm.filter(r => !r.canonical).map(r => r.rawName),
      unresolvedPreferred: preferredNorm.filter(r => !r.canonical).map(r => r.rawName),
      duplicates,
    }, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
