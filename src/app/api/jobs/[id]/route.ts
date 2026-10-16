import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError } from '@/lib/auth'
import { requireUser, requireRecruiterCompanyId } from '@/lib/api-helpers'
import { z } from 'zod'

// GET /api/jobs/[id] — any authenticated. Return full job with company, requirements.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser(req)
    const { id } = await params

    const job = await db.job.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true, industry: true, website: true } },
        requirements: {
          include: { skill: { select: { id: true, displayName: true, category: true } } },
          orderBy: [{ isRequired: 'desc' }, { weight: 'desc' }],
        },
      },
    })

    if (!job) throw new ResponseError(404, 'Job not found')

    return Response.json({
      id: job.id,
      title: job.title,
      companyId: job.companyId,
      company: job.company,
      description: job.description,
      location: job.location,
      workArrangement: job.workArrangement,
      employmentType: job.employmentType,
      minExperience: job.minExperience,
      maxExperience: job.maxExperience,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      salaryCurrency: job.salaryCurrency,
      applicationUrl: job.applicationUrl,
      postingDate: job.postingDate,
      closingDate: job.closingDate,
      status: job.status,
      sourceType: job.sourceType,
      sourceRef: job.sourceRef,
      sourceUrl: job.sourceUrl,
      externalId: job.externalId,
      eligibilityCriteria: job.eligibilityCriteria,
      batchEligible: job.batchEligible,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      requirements: job.requirements.map(r => ({
        id: r.id,
        skillId: r.skillId,
        name: r.skill.displayName,
        category: r.skill.category,
        weight: r.weight,
        isRequired: r.isRequired,
        minLevel: r.minLevel,
      })),
    })
  } catch (err) {
    return errorResponse(err)
  }
}

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(10000).optional(),
  location: z.string().optional(),
  workArrangement: z.enum(['remote', 'hybrid', 'onsite']).optional(),
  employmentType: z.enum(['full-time', 'internship', 'contract']).optional(),
  minExperience: z.number().int().min(0).optional(),
  maxExperience: z.number().int().min(0).optional(),
  salaryMin: z.number().int().min(0).optional(),
  salaryMax: z.number().int().min(0).optional(),
  applicationUrl: z.string().url().optional().or(z.literal('')),
  closingDate: z.string().datetime().optional(),
  batchEligible: z.string().optional(),
  eligibilityCriteria: z.string().optional(),
  status: z.enum(['OPEN', 'CLOSED', 'DRAFT', 'ARCHIVED']).optional(),
  requiredSkills: z.array(z.string().min(1)).optional(),
  preferredSkills: z.array(z.string().min(1)).optional(),
})

// PATCH /api/jobs/[id] — OFFICER or owner recruiter.
// If skills changed, re-run duplicate detection. Clear cached match results for this job.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser(req)
    const { id } = await params

    if (user.role !== 'OFFICER' && user.role !== 'ADMIN' && user.role !== 'RECRUITER') {
      throw new ResponseError(403, 'Insufficient permissions')
    }

    const existing = await db.job.findUnique({
      where: { id },
      select: { id: true, companyId: true, title: true },
    })
    if (!existing) throw new ResponseError(404, 'Job not found')

    if (user.role === 'RECRUITER') {
      const myCompanyId = await requireRecruiterCompanyId(user)
      if (!myCompanyId || myCompanyId !== existing.companyId) {
        throw new ResponseError(403, 'You do not own this job')
      }
    }

    const body = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      throw new ResponseError(400, 'Invalid input: ' + (parsed.error.issues[0]?.message ?? 'validation error'))
    }
    const data = parsed.data

    const { requiredSkills, preferredSkills, ...jobFields } = data

    // Normalize empty strings to null for some fields
    const cleaned: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(jobFields)) {
      cleaned[k] = v === '' ? null : v
    }
    if (cleaned.closingDate) cleaned.closingDate = new Date(cleaned.closingDate as string)

    const skillsChanged = requiredSkills !== undefined || preferredSkills !== undefined

    await db.job.update({
      where: { id },
      data: cleaned,
    })

    if (skillsChanged) {
      // Rebuild JobSkill rows
      await db.jobSkill.deleteMany({ where: { jobId: id } })
      const { normalizeSkills, clearNormalizationCache } = await import('@/lib/matching')
      clearNormalizationCache()
      const requiredNorm = requiredSkills ? await normalizeSkills(requiredSkills) : []
      const preferredNorm = preferredSkills ? await normalizeSkills(preferredSkills) : []
      const requiredResolved = requiredNorm.filter(r => r.canonical)
      const preferredResolved = preferredNorm.filter(r => r.canonical)

      if (requiredResolved.length > 0) {
        await db.jobSkill.createMany({
          data: requiredResolved.map(r => ({
            jobId: id,
            skillId: r.canonical!.skillId,
            weight: 4,
            isRequired: true,
            minLevel: 'intermediate',
          })),
        })
      }
      if (preferredResolved.length > 0) {
        await db.jobSkill.createMany({
          data: preferredResolved.map(r => ({
            jobId: id,
            skillId: r.canonical!.skillId,
            weight: 1,
            isRequired: false,
            minLevel: 'beginner',
          })),
        })
      }

      // Re-run duplicate detection
      const { runDuplicateDetection } = await import('@/app/api/jobs/route')
      const duplicates = await runDuplicateDetection(id)

      // Clear cached match results (delete existing, will be recomputed on demand or via recompute endpoint)
      await db.matchResult.deleteMany({ where: { jobId: id } })

      // Audit
      await db.auditEvent.create({
        data: {
          actorId: user.id,
          action: 'JOB_UPDATED',
          targetType: 'Job',
          targetId: id,
          metadata: JSON.stringify({ skillsChanged: true, duplicateCount: duplicates.length }),
        },
      })

      return Response.json({
        id,
        updated: cleaned,
        skillsChanged: true,
        duplicates,
      })
    }

    await db.auditEvent.create({
      data: {
        actorId: user.id,
        action: 'JOB_UPDATED',
        targetType: 'Job',
        targetId: id,
        metadata: JSON.stringify({ skillsChanged: false, fields: Object.keys(cleaned) }),
      },
    })

    return Response.json({ id, updated: cleaned, skillsChanged: false })
  } catch (err) {
    return errorResponse(err)
  }
}
