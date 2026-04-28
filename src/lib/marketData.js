// Fetches free-tier FRED economic series via the public CSV endpoint.
// No API key required for graph CSV.
//
// Caches every series in localStorage for 24 hours. Always returns
// { series: [{date, value}], stale: false } or { error } — never throws.
//
// CORS: FRED's fredgraph.csv endpoint is generally CORS-permissive in modern
// browsers. If it isn't on a given network, fetches will fail and we return
// { error: 'unavailable' }; the UI shows a graceful "data unavailable" panel.
// To work around CORS in production, add a Vercel API route as a proxy.

const CACHE_TTL_HOURS = 24
const FRED_BASE = 'https://fred.stlouisfed.org/graph/fredgraph.csv'

const SERIES = {
  mortgage30: 'MORTGAGE30US',     // 30-year fixed mortgage rate (weekly)
  fedFunds:   'FEDFUNDS',         // Federal funds rate (monthly)
  caseShiller:'CSUSHPINSA',       // Case-Shiller national home price index (monthly)
  unemployment:'UNRATE',          // US unemployment rate (monthly)
}

// 2026 FOMC meeting dates (announced by the Fed; hardcode is fine for the
// year — we update the source if/when 2027 is needed).
export const FED_MEETINGS_2026 = [
  '2026-01-29',
  '2026-03-19',
  '2026-05-07',
  '2026-06-18',
  '2026-07-30',
  '2026-09-17',
  '2026-10-29',
  '2026-12-10',
]

const cacheKey = (id) => `marketData:${id}`

function readCache(id) {
  try {
    const raw = localStorage.getItem(cacheKey(id))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const ageH = (Date.now() - parsed.fetchedAt) / 3600000
    if (ageH > CACHE_TTL_HOURS) return { ...parsed, stale: true }
    return { ...parsed, stale: false }
  } catch {
    return null
  }
}

function writeCache(id, series) {
  try {
    localStorage.setItem(cacheKey(id), JSON.stringify({
      series,
      fetchedAt: Date.now(),
    }))
  } catch {}
}

// Parse FRED CSV: "DATE,SERIES_ID\n2024-01-04,6.62\n..."
// Skip header + empty values (FRED uses '.' for missing).
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []
  const out = []
  for (let i = 1; i < lines.length; i++) {
    const [date, valueRaw] = lines[i].split(',')
    if (!date) continue
    const value = parseFloat(valueRaw)
    if (Number.isNaN(value)) continue
    out.push({ date, value })
  }
  return out
}

async function fetchSeries(id) {
  const cached = readCache(id)
  // Return cached immediately if fresh
  if (cached && !cached.stale) {
    return { series: cached.series, fromCache: true, error: null }
  }

  try {
    const res = await fetch(`${FRED_BASE}?id=${id}`, { mode: 'cors' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    const series = parseCsv(text)
    if (series.length === 0) throw new Error('Empty series')
    writeCache(id, series)
    return { series, fromCache: false, error: null }
  } catch (e) {
    // Fall back to stale cache if we have one
    if (cached) return { series: cached.series, fromCache: true, error: null }
    return { series: [], fromCache: false, error: e.message || 'unavailable' }
  }
}

export const fetchMortgageRates = () => fetchSeries(SERIES.mortgage30)
export const fetchFedFundsRate  = () => fetchSeries(SERIES.fedFunds)
export const fetchCaseShiller   = () => fetchSeries(SERIES.caseShiller)
export const fetchUnemployment  = () => fetchSeries(SERIES.unemployment)

// ─── Helpers used in the UI ───
export function latest(series) {
  return series && series.length ? series[series.length - 1] : null
}

export function changeFromN(series, n) {
  if (!series || series.length < n + 1) return null
  const cur = series[series.length - 1].value
  const prev = series[series.length - 1 - n].value
  return { from: prev, to: cur, delta: cur - prev, pct: prev !== 0 ? (cur - prev) / prev : 0 }
}

// Find the entry closest to N weeks ago (for MORTGAGE30US)
export function changeWeeksAgo(series, weeks) {
  return changeFromN(series, weeks)
}

// Estimate a 30-year fixed monthly P&I given price, down %, and rate.
// Standard mortgage formula: P * (r(1+r)^n) / ((1+r)^n - 1)
export function monthlyPayment(price, downPct, ratePct) {
  const principal = price * (1 - (downPct || 0) / 100)
  const r = (ratePct || 0) / 100 / 12
  const n = 360
  if (r === 0) return principal / n
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}

// Approximate the purchase price a buyer can afford at a given monthly
// payment. Inverts monthlyPayment given a target monthly. Used for
// "your $X budget supports ~$Y purchase" copy.
export function purchasePowerFromBudget(monthlyBudget, ratePct, downPct = 20) {
  const r = (ratePct || 0) / 100 / 12
  const n = 360
  if (r === 0 || !monthlyBudget) return 0
  const principal = monthlyBudget * ((Math.pow(1 + r, n) - 1) / (r * Math.pow(1 + r, n)))
  return principal / (1 - downPct / 100)
}

export function nextFedMeeting(today = new Date()) {
  const todayStr = today.toISOString().split('T')[0]
  return FED_MEETINGS_2026.find((d) => d >= todayStr) || null
}
