// Vercel serverless proxy for FRED's official JSON API.
//
// Route:    /api/fred?series=MORTGAGE30US
// Success:  { series, data: [{ date, value }] }   ← oldest first
// Failure:  { series, data: [], error: "<reason>" } (still HTTP 200)
//
// We use the official `api.stlouisfed.org/fred/series/observations` endpoint
// (which expects an API key and is built for server-to-server traffic)
// rather than the public `fred.stlouisfed.org/graph/fredgraph.csv` endpoint
// (which the front of FRED's edge appears to drop from Vercel IPs).
//
// Env vars (set in Vercel project settings → Environment Variables):
//   FRED_API_KEY  — required. Free at
//                   https://fred.stlouisfed.org/docs/api/api_key.html
//
// Cache headers: 24 hours at the edge with a 12-hour stale-while-revalidate
// so a single agent's first hit per day pays the upstream cost; everyone
// after that hits Vercel's edge cache for free.

const ALLOWED = /^[A-Z0-9_]+$/i
const DEFAULT_SERIES = 'MORTGAGE30US'
const FETCH_TIMEOUT_MS = 20000
const FRED_API = 'https://api.stlouisfed.org/fred/series/observations'

export default async function handler(req, res) {
  let series = DEFAULT_SERIES
  try {
    series = (req.query?.series || DEFAULT_SERIES).toString()

    if (!ALLOWED.test(series)) {
      return res.status(200).json({ series, data: [], error: 'invalid series' })
    }

    const apiKey = process.env.FRED_API_KEY
    if (!apiKey) {
      return res.status(200).json({
        series,
        data: [],
        error: 'FRED_API_KEY not configured',
      })
    }

    // Fetch the most recent 52 observations (about 1 year of weekly data,
    // or 52 months of monthly — enough for everything the Market tab needs).
    // sort_order=desc returns newest first; we reverse before returning so
    // the rest of the codebase keeps treating series[last] as "latest".
    const params = new URLSearchParams({
      series_id: series,
      api_key: apiKey,
      file_type: 'json',
      sort_order: 'desc',
      limit: '52',
    })
    const upstreamUrl = `${FRED_API}?${params.toString()}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    let upstream
    try {
      upstream = await fetch(upstreamUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'DealFlow/1.0 (contact: support@dealflownow.net)',
          'Accept': 'application/json',
        },
      })
    } finally {
      clearTimeout(timeoutId)
    }

    if (!upstream.ok) {
      return res.status(200).json({
        series,
        data: [],
        error: `upstream ${upstream.status}`,
      })
    }

    const body = await upstream.json()
    const observations = Array.isArray(body?.observations) ? body.observations : []

    // FRED uses '.' for missing values. Skip those, parse the rest, and
    // reverse to ascending chronological order (oldest → newest).
    const data = observations
      .map((o) => ({ date: o.date, value: parseFloat(o.value) }))
      .filter((d) => d.date && !Number.isNaN(d.value))
      .reverse()

    if (data.length === 0) {
      return res.status(200).json({ series, data: [], error: 'empty series' })
    }

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=43200')
    return res.status(200).json({ series, data })
  } catch (err) {
    const cause = err?.cause
    console.error('[api/fred] fetch failed', {
      series,
      message: err?.message,
      name: err?.name,
      causeCode: cause?.code,
      causeMessage: cause?.message,
    })

    const detail =
      err?.name === 'AbortError' ? 'timeout' :
      cause?.code ? `${err.message} (${cause.code})` :
      err?.message || 'fetch failed'

    return res.status(200).json({ series, data: [], error: detail })
  }
}
