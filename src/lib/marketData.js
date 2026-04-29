// Fetches free-tier FRED economic series via our Vercel serverless proxy
// at /api/fred?series={id}. The proxy fetches FRED's public CSV graph
// endpoint server-side, parses it, and returns JSON — sidestepping CORS.
//
// The proxy always responds with JSON of shape { series, data, error? }.
// Empty data + error field means the upstream fetch failed; we handle
// that as a graceful "data unavailable" path.
//
// Caches every series in localStorage for 24 hours. Always returns
// { series: [{date, value}], stale: false } or { error } — never throws.

const CACHE_TTL_HOURS = 24
const PROXY_URL = '/api/fred'

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

// Hard ceiling on how long we wait for the proxy. Without a timeout, a
// hanging fetch leaves the Promise pending forever and the Market tab
// spinner never resolves. The proxy itself uses a 20s upstream timeout,
// so 25s here gives the proxy room to time out gracefully first.
const FETCH_TIMEOUT_MS = 25000

async function fetchSeries(id) {
  const cached = readCache(id)
  // Return cached immediately if fresh
  if (cached && !cached.stale) {
    return { series: cached.series, fromCache: true, error: null }
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    : null

  try {
    const res = await fetch(`${PROXY_URL}?series=${encodeURIComponent(id)}`, {
      signal: controller?.signal,
    })
    if (timeoutId) clearTimeout(timeoutId)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()

    // Proxy responds with { series, data, error? } regardless of upstream
    // health. An error field with empty data means upstream failed — treat
    // that as a graceful failure, not a crash.
    if (json.error && (!json.data || json.data.length === 0)) {
      throw new Error(json.error)
    }

    const series = json.data || []
    if (series.length === 0) throw new Error('Empty series')
    writeCache(id, series)
    return { series, fromCache: false, error: null }
  } catch (e) {
    if (timeoutId) clearTimeout(timeoutId)
    // Fall back to stale cache if we have one
    if (cached) return { series: cached.series, fromCache: true, error: null }
    const reason = e?.name === 'AbortError' ? 'timeout' : (e?.message || 'unavailable')
    return { series: [], fromCache: false, error: reason }
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
