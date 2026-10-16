import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse } from '@/lib/auth'
import { requireUser } from '@/lib/api-helpers'

// GET /api/skills — any authenticated. List all canonical skills with aliases.
export async function GET(req: NextRequest) {
  try {
    await requireUser(req)
    const skills = await db.skill.findMany({
      orderBy: { displayName: 'asc' },
      include: {
        aliases: { select: { id: true, alias: true, caseInsensitive: true } },
      },
    })
    const data = skills.map(s => ({
      id: s.id,
      canonicalName: s.canonicalName,
      displayName: s.displayName,
      category: s.category,
      description: s.description,
      aliases: s.aliases.map(a => a.alias),
    }))
    return Response.json({ data })
  } catch (err) {
    return errorResponse(err)
  }
}
