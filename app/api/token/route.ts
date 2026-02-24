// app/api/token/route.ts
import { getAccessToken } from '@/lib/spotify'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const token = await getAccessToken()
    return NextResponse.json({ token })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
