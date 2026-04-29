// Vercel serverless proxy for FRED's public CSV graph endpoint.
// Browsers can't fetch FRED directly because of CORS; this function runs
// server-side, fetches the CSV, parses it, and returns JSON.
//
// Route:    /api/fred?series=MORTGAGE30US
// Success:  { series, data: [{ date, value }] }
// Failure:  { series, data: [], error: "<reason>" }   (still HTTP 200)
//
// Always returns valid JSON. Even uncaught crashes inside the handler are
// trapped by an outer try/catch so the client never sees a blank response
// or HTML error page.
//
// Cache headers: 24 hours at the edge with a 12-hour stale-while-revalidate
// so a single agent's first hit per day pays the upstream cost; everyone
// after that hits Vercel's edge cache for free.

const ALLOWED = /^[A-Z0-9_]+$/i
const DEFAULT_SERIES = 'MORTGAGE30US'
const FETCH_TIMEOUT_MS = 20000

export default async function handler(req, res) {
  let series = DEFAULT_SERIES
  try {
    series = (req.query?.series || DEFAULT_SERIES).toString()

    if (!ALLOWED.test(series)) {
      return res.status(200).json({ series, data: [], error: 'invalid series' })
    }

    const upstreamUrl = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(series)}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    let upstream
    try {
      upstream = await fetch(upstreamUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'DealFlow/1.0 (contact: support@dealflownow.net)',
          'Accept': 'text/csv,text/plain,*/*',
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

    const text = await upstream.text()

    // FRED returns: "DATE,SERIES_ID\n2024-01-04,6.62\n..."
    // Skip the header and any rows where value is missing (FRED uses '.').
    const lines = text.split(/\r?\n/).filter(Boolean)
    const data = []
    for (let i = 1; i < lines.length; i++) {
      const [date, valueRaw] = lines[i].split(',')
      if (!date) continue
      const value = parseFloat(valueRaw)
      if (Number.isNaN(value)) continue
      data.push({ date, value })
    }

    if (data.length === 0) {
      return res.status(200).json({ series, data: [], error: 'empty series' })
    }

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=43200')
    return res.status(200).json({ series, data })
  } catch (err) {
    // Log the full error to Vercel logs so we can see DNS/connect/TLS codes
    // that bare err.message hides. Node's fetch wraps the underlying error
    // in `err.cause` — that's where the real diagnostic lives.
    const cause = err?.cause
    console.error('[api/fred] fetch failed', {
      series,
      message: err?.message,
      name: err?.name,
      causeCode: cause?.code,
      causeMessage: cause?.message,
      stack: err?.stack,
    })

    const detail =
      err?.name === 'AbortError' ? 'timeout' :
      cause?.code ? `${err.message} (${cause.code})` :
      err?.message || 'fetch failed'

    return res.status(200).json({
      series,
      data: [],
      error: detail,
    })
  }
}
