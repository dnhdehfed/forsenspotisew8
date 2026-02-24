# forsen.me Spotify Player

Personal Spotify player — no login screen, works on any device.

## Deploy to Vercel

### Step 1 — Push to GitHub
1. Create a new repo on GitHub
2. Push this folder to it

### Step 2 — Deploy on Vercel
1. Go to vercel.com → New Project → import your repo
2. Add these Environment Variables:
   ```
   SPOTIFY_CLIENT_ID=39018141ddad4990abbc35593b3d1ea4
   SPOTIFY_CLIENT_SECRET=c6142bdd2e8543969c846c12606d58f3
   SPOTIFY_REDIRECT_URI=https://spotify.forsen.me/api/setup
   SPOTIFY_REFRESH_TOKEN=    ← leave blank for now
   ```
3. Deploy

### Step 3 — Add domain
In Vercel → Settings → Domains → add `spotify.forsen.me`
Set DNS CNAME: `spotify` → `cname.vercel-dns.com`

### Step 4 — Get your refresh token (one time only)
1. In your Spotify Developer Dashboard (developer.spotify.com):
   - Add redirect URI: `https://spotify.forsen.me/api/setup`
   - Add scopes or use the URL below
2. Visit this URL in your browser (replace CLIENT_ID if needed):
   ```
   https://accounts.spotify.com/authorize?client_id=39018141ddad4990abbc35593b3d1ea4&response_type=code&redirect_uri=https%3A%2F%2Fspotify.forsen.me%2Fapi%2Fsetup&scope=streaming+user-read-email+user-read-private+user-library-read+user-read-playback-state+user-modify-playback-state+playlist-read-private+playlist-read-collaborative
   ```
3. Log in with YOUR Spotify account → Agree
4. You'll see your refresh token on screen
5. Copy it

### Step 5 — Add refresh token to Vercel
1. Vercel → your project → Settings → Environment Variables
2. Add `SPOTIFY_REFRESH_TOKEN` = the token you copied
3. Redeploy (Deployments → Redeploy)

### Done!
Visit `https://spotify.forsen.me` — no login, music plays directly.

**Note:** Spotify Web Playback requires Premium.
