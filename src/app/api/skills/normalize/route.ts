import { NextRequest } from 'next/server'
import { errorResponse, ResponseError } from '@/lib/auth'
import { requireUser } from '@/lib/api-helpers'
import { normalizeSkills } from '@/lib/matching'
import { z } from 'zod'

const bodySchema = z.object({
  names: z.array(z.string().min(1)).min(1).max(200),
})

// POST /api/skills/normalize — any authenticated. Body: { names: string[] }
export async function POST(req: NextRequest) {
  try {
    await requireUser(req)
    const body = await req.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      throw new ResponseError(400, 'Invalid input: ' + (parsed.error.issues[0]?.message ?? 'validation error'))
    }
    const results = await normalizeSkills(parsed.data.names)
    return Response.json({
      results: results.map(r => ({
        rawName: r.rawName,
        canonical: r.canonical ? { skillId: r.canonical.skillId, displayName: r.canonical.displayName } : null,
      })),
    })
  } catch (err) {
    return errorResponse(err)
  }
}
