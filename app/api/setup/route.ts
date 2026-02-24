import { NextRequest, NextResponse } from 'next/server'

// This route handles the one-time OAuth callback to get your refresh token.
// After you have the refresh token, you never need this again.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const error = req.nextUrl.searchParams.get('error')

  if (error) {
    return new NextResponse(`
      <html><body style="font-family:monospace;background:#0a0a0a;color:#f0f0f0;padding:40px">
        <h2 style="color:#e74c3c">Error: ${error}</h2>
        <p>Go back and try again.</p>
      </body></html>`, { headers: { 'Content-Type': 'text/html' } })
  }

  if (!code) {
    return new NextResponse(`
      <html><body style="font-family:monospace;background:#0a0a0a;color:#f0f0f0;padding:40px">
        <h2 style="color:#e74c3c">No code received</h2>
      </body></html>`, { headers: { 'Content-Type': 'text/html' } })
  }

  const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!
  const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!
  const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI!

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }),
  })

  const data = await res.json()

  if (!data.refresh_token) {
    return new NextResponse(`
      <html><body style="font-family:monospace;background:#0a0a0a;color:#f0f0f0;padding:40px">
        <h2 style="color:#e74c3c">Failed to get refresh token</h2>
        <pre>${JSON.stringify(data, null, 2)}</pre>
      </body></html>`, { headers: { 'Content-Type': 'text/html' } })
  }

  return new NextResponse(`
    <html><body style="font-family:monospace;background:#0a0a0a;color:#f0f0f0;padding:40px;max-width:700px">
      <h2 style="color:#1db954">✅ Got your refresh token!</h2>
      <p style="color:#888">Copy this and add it to Vercel as <code style="color:#1db954">SPOTIFY_REFRESH_TOKEN</code></p>
      <div style="background:#111;border:1px solid #2a2a2a;border-radius:8px;padding:16px;word-break:break-all;margin:16px 0">
        <strong style="color:#1db954">${data.refresh_token}</strong>
      </div>
      <p style="color:#888;font-size:13px">
        1. Go to Vercel → your project → Settings → Environment Variables<br>
        2. Add <code>SPOTIFY_REFRESH_TOKEN</code> = the value above<br>
        3. Redeploy the project<br>
        4. Delete this page (remove /app/api/setup folder) — you don't need it anymore
      </p>
    </body></html>`, { headers: { 'Content-Type': 'text/html' } })
}
