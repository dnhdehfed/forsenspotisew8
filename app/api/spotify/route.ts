import { getAccessToken } from '@/lib/spotify'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const path = url.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'No path' }, { status: 400 })

  try {
    const token = await getAccessToken()
    const spotifyUrl = `https://api.spotify.com/v1${path}`
    const res = await fetch(spotifyUrl, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
