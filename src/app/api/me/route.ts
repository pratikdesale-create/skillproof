import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromCookies, errorResponse } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromCookies(req.headers.get('cookie'))
    if (!user) {
      return Response.json({ user: null }, { status: 200 })
    }
    // Return basic profile depending on role
    let profile: Record<string, unknown> | null = null
    let extra: Record<string, unknown> = {}
    if (user.role === 'STUDENT') {
      profile = await db.studentProfile.findUnique({
        where: { userId: user.id },
        select: {
          id: true, university: true, batch: true, branch: true,
          cgpa: true, bio: true, location: true, linkedinUrl: true,
          githubUser: true, portfolioUrl: true, graduationYear: true,
          profileCompletion: true,
        },
      })
    } else if (user.role === 'RECRUITER') {
      profile = await db.recruiterProfile.findUnique({
        where: { userId: user.id },
        include: { company: { select: { id: true, name: true, industry: true } } },
      })
    } else if (user.role === 'OFFICER') {
      profile = await db.officerProfile.findUnique({ where: { userId: user.id } })
    }
    return Response.json({ user, profile })
  } catch (err) {
    return errorResponse(err)
  }
}
