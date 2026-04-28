// Vercel serverless proxy for FRED's public CSV graph endpoint.
// Browsers can't fetch FRED directly because of CORS; this function runs
// server-side, fetches the CSV, parses it, and returns JSON.
//
// Route: /api/fred?series=MORTGAGE30US
// Response: { series, data: [{ date, value }] }
//
// We use a flat file + query parameter (rather than a dynamic route file
// like /api/fred/[series].js) because the dynamic-route file wasn't being
// detected as a function in this project's Vercel build.
//
// Cache headers: 24 hours at the edge with a 12-hour stale-while-revalidate
// so a single agent's first hit per day pays the upstream cost; everyone
// after that hits Vercel's edge cache for free.

const ALLOWED = /^[A-Z0-9_]+$/i
const DEFAULT_SERIES = 'MORTGAGE30US'

export default async function handler(req, res) {
  const series = (req.query?.series || DEFAULT_SERIES).toString()
  if (!ALLOWED.test(series)) {
    return res.status(400).json({ error: 'Invalid series ID' })
  }

  const upstreamUrl = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(series)}`

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { 'user-agent': 'dealflow-proxy/1.0' },
    })
    if (!upstream.ok) {
      return res.status(502).json({ error: 'upstream', status: upstream.status })
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
      return res.status(502).json({ error: 'empty-series' })
    }

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=43200')
    return res.status(200).json({ series, data })
  } catch (err) {
    return res.status(502).json({ error: 'fetch-failed', message: err.message || String(err) })
  }
}
