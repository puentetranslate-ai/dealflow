import { LockIcon, CheckIcon, ArrowRightIcon } from './Icon'
import {
  PRO_CHECKOUT_URL,
  PRO_PRICE_LABEL,
  PRO_PRICE_SUBLINE,
} from '../lib/upgradeLinks'

// Paywall card shown in place of a gated feature for users on a tier
// below Pro. Rendered inline (it's just a card, not a modal) so the
// surrounding chrome — tabs, headers, sidebars — stays visible.
//
// Props:
//   feature     string, required. Name of the locked feature (heading).
//   description string, optional. One-paragraph pitch under the heading.
//                Defaults to a Client-Portal-flavored description.
//   benefits    string[], optional. Bullet list. Defaults to the Pro
//                bundle's headline benefits.
//   ctaLabel    string, optional. Override the CTA text.

const DEFAULT_DESCRIPTION =
  "Give your buyers and sellers a private, branded portal that updates in real time as you move the deal forward. No more 'any updates?' texts."

const DEFAULT_BENEFITS = [
  'Real-time Client Portal — milestone updates without the back-and-forth',
  'Custom checklists per deal — track exactly what you need to close',
  'Document storage with secure share links',
  'Priority email support',
]

export default function UpgradePrompt({
  feature,
  description = DEFAULT_DESCRIPTION,
  benefits = DEFAULT_BENEFITS,
  ctaLabel,
}) {
  const heading = feature || 'Pro feature'

  return (
    <div className="relative max-w-xl mx-auto">
      {/* Gold accent halo */}
      <div className="absolute -inset-1 bg-gradient-to-br from-gold/30 via-transparent to-gold/10 rounded-3xl blur-xl pointer-events-none" />

      <div className="relative bg-white rounded-2xl border border-navy/[0.08] shadow-card overflow-hidden">
        {/* Top accent strip */}
        <div className="h-1 bg-gradient-to-r from-gold/0 via-gold to-gold/0" />

        <div className="p-8 md:p-10">
          {/* Lock + label */}
          <div className="flex flex-col items-center text-center">
            <span className="w-16 h-16 rounded-2xl bg-gold/12 text-gold flex items-center justify-center mb-5">
              <LockIcon className="w-7 h-7" />
            </span>
            <span className="badge-gold mb-3">Pro</span>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-navy leading-tight">
              {heading}
            </h2>
            <p className="text-muted text-sm md:text-[15px] mt-3 leading-relaxed max-w-md">
              {description}
            </p>
          </div>

          {/* Benefits */}
          <ul className="mt-8 space-y-3 max-w-md mx-auto">
            {benefits.map((b, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-gold/15 text-gold-dark flex items-center justify-center shrink-0 mt-0.5">
                  <CheckIcon className="w-3 h-3" />
                </span>
                <span className="text-sm md:text-[15px] text-navy/85 leading-snug">
                  {b}
                </span>
              </li>
            ))}
          </ul>

          {/* CTA */}
          <div className="mt-8 flex flex-col items-center">
            <a
              href={PRO_CHECKOUT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-gold hover:bg-gold-light text-navy font-semibold rounded-xl px-7 h-12 text-[15px] transition-colors shadow-[0_4px_14px_rgba(201,168,76,0.35)]"
            >
              {ctaLabel || `Upgrade to Pro — ${PRO_PRICE_LABEL}`}
              <ArrowRightIcon className="w-4 h-4" />
            </a>
            <p className="text-muted text-xs mt-3">
              {PRO_PRICE_SUBLINE}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
