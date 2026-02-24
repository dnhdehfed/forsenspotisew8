// app/api/spotify/route.ts
import { spotifyFetch } from '@/lib/spotify'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'No path' }, { status: 400 })

  try {
    const data = await spotifyFetch(path)
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
