// Smoke-test endpoint. Hits never touch the network — pure boot-and-respond.
// Use this to confirm Vercel function deployment + routing without depending
// on any upstream service.
//
//   curl https://dealflownow.net/api/test
//   → {"status":"ok","timestamp":"2026-04-29T...Z","runtime":"node","version":"v20..."}

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    runtime: 'node',
    version: typeof process !== 'undefined' ? process.version : 'unknown',
    method: req.method,
  })
}
