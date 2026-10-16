import { NextRequest, NextResponse } from 'next/server'
import { makeClearCookieHeader, errorResponse } from '@/lib/auth'

export async function POST() {
  try {
    const res = NextResponse.json({ ok: true })
    res.headers.set('Set-Cookie', makeClearCookieHeader())
    return res
  } catch (err) {
    return errorResponse(err)
  }
}
