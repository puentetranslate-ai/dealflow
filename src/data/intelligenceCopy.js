// Marketing copy for the Intelligence tier ($35/mo). Centralized here
// so the public Pricing page, the in-app upgrade card (when Intelligence
// launches), and any future landing-page tier-detail sections can pull
// from a single source. Frames the tier as "information edge," not
// "AI novelty."
//
// Imported by: src/pages/Pricing.jsx (planned), future Intelligence
// upgrade card. Currently unused — content-only file for now.

export const INTELLIGENCE_COPY = {
  // Hero line for the tier card / landing block.
  headline:
    'The same signals institutional investors pay Bloomberg $25,000 a year for — color-coded and delivered to your phone before your first coffee.',

  // Subhead — the contrast line.
  subhead: 'Most agents gamble on timing. Intelligence tier agents know.',

  // Per-feature framing. Each feature is named neutrally and then
  // reframed in the language of decision-support, not buzzwords.
  features: [
    {
      name: 'Daily Market Briefing',
      framing: 'Red (act now), Yellow (watch), Green (opportunity)',
    },
    {
      name: 'Rate Watch',
      framing: 'Know whether your buyer should lock today or wait until Friday',
    },
    {
      name: 'Neighborhood Watch',
      framing:
        'See inventory drops and price shifts in your farm areas before the MLS email hits',
    },
    {
      name: 'Weekly Market Report',
      framing:
        'One-tap client update that positions you as the most informed agent in the room',
    },
  ],

  // Tier narrative — the positioning statement, used in long-form
  // marketing blocks or the "about this tier" panel.
  narrative:
    'Intelligence is not an AI novelty — it is an information edge. The agent becomes an educated gambler: still taking risks, but with better odds. You stop guessing about timing and start knowing.',

  // Operational facts kept here so a single edit ripples to every
  // surface that displays them.
  price: 35,
  cadence: 'month',
  status: 'Coming Q4 2026',
}
