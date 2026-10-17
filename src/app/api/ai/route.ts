import { NextRequest } from 'next/server'
import { errorResponse, ResponseError } from '@/lib/auth'
import { requireUser } from '@/lib/api-helpers'
import { glmHealthCheck, parseJobDescription, explainMatch } from '@/lib/ai/glm-service'
import { z } from 'zod'

// GET /api/ai/health — OFFICER or ADMIN only.
// Returns whether the GLM integration is live or running in fallback mode.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req)
    if (user.role !== 'OFFICER' && user.role !== 'ADMIN') {
      throw new ResponseError(403, 'Officer access required to inspect AI health')
    }
    const health = await glmHealthCheck()
    return Response.json(health)
  } catch (err) {
    return errorResponse(err)
  }
}

const parseSchema = z.object({
  description: z.string().min(10).max(8000),
})

const explainSchema = z.object({
  fitScore: z.number(),
  verifiedRequiredCoverage: z.number(),
  provisionalRequiredCoverage: z.number(),
  missingRequiredCoverage: z.number(),
  matchingSkills: z.array(z.object({
    name: z.string(),
    coverageTier: z.enum(['verified', 'provisional']),
  })),
  missingSkills: z.array(z.object({
    name: z.string(),
    isRequired: z.boolean(),
  })),
  provisionalSkills: z.array(z.object({
    name: z.string(),
    isRequired: z.boolean(),
  })),
  studentName: z.string(),
  jobTitle: z.string(),
})

// POST /api/ai/parse-job — OFFICER or RECRUITER.
// Body: { description: string }
// Returns the parsed job requirements + the source ('live_glm' | 'demo_fallback').
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req)
    if (user.role !== 'OFFICER' && user.role !== 'ADMIN' && user.role !== 'RECRUITER') {
      throw new ResponseError(403, 'Insufficient permissions')
    }
    const body = await req.json()
    // Dispatch by presence of fields — support both parse-job and explain-match
    if ('description' in body) {
      const parsed = parseSchema.safeParse(body)
      if (!parsed.success) {
        throw new ResponseError(400, 'Invalid input: ' + (parsed.error.issues[0]?.message ?? 'validation'))
      }
      const result = await parseJobDescription(parsed.data.description)
      return Response.json(result)
    }
    if ('fitScore' in body) {
      const parsed = explainSchema.safeParse(body)
      if (!parsed.success) {
        throw new ResponseError(400, 'Invalid input: ' + (parsed.error.issues[0]?.message ?? 'validation'))
      }
      const result = await explainMatch(parsed.data)
      return Response.json(result)
    }
    throw new ResponseError(400, 'Body must contain either `description` (parse) or `fitScore` (explain).')
  } catch (err) {
    return errorResponse(err)
  }
}
