// Three-step welcome wizard shown to brand-new users on their first
// dashboard visit. Renders as a centered modal on desktop and a bottom
// sheet on mobile (items-end on small screens, items-center on md+).
//
// State is driven entirely by useOnboarding — the wizard never reads
// or writes localStorage directly. Parent (Dashboard) decides when to
// render and handles completion via the onComplete / onSkip callbacks.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function OnboardingWizard({ onComplete, onSkip }) {
  const [step, setStep] = useState(0)
  const navigate = useNavigate()

  // Each step has its own CTA + action. Step 0 navigates straight to
  // /deals/new so the user starts adding a deal immediately (the wizard
  // is hidden by the route change). Step 1 is the Quick Log tour stop.
  // Step 2 marks completion via the parent-provided callback.
  const steps = [
    {
      title: 'Welcome to DealFlow',
      body: 'Add your first deal in under 2 minutes. Your entire real estate business on one screen.',
      ctaLabel: 'Add my first deal',
      action: () => {
        onComplete()
        navigate('/deals/new')
      },
    },
    {
      title: 'Log your first communication',
      body: 'Quick Log lets you capture a call, text, or email in 15 seconds — from any screen. Tap, type, save. No menus to navigate, no friction to fight.',
      ctaLabel: 'Got it — next',
      action: () => setStep(2),
    },
    {
      title: "You're set up",
      body: 'Your dashboard will fill up as you add deals. Need help? Email support@dealflownow.net — we respond within 24 hours.',
      ctaLabel: 'Go to Dashboard',
      action: onComplete,
    },
  ]

  const current = steps[step]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className="fixed inset-0 z-[90] flex items-end md:items-center justify-center bg-navy/80 backdrop-blur-sm p-0 md:p-4"
    >
      <div className="bg-cream w-full md:w-[460px] md:max-w-[92vw] rounded-t-3xl md:rounded-3xl shadow-pop animate-fade-in pb-safe md:pb-7 max-h-[90vh] overflow-y-auto">
        <div className="px-6 pt-6 pb-7 md:px-8 md:pt-8">
          {/* Progress dots */}
          <div className="flex justify-center gap-2 mb-6" aria-hidden="true">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === step ? 'bg-gold' : 'bg-navy/15'
                }`}
              />
            ))}
          </div>

          {/* Step content */}
          <h2
            id="onboarding-title"
            className="font-display text-2xl md:text-3xl font-bold text-navy text-center leading-tight"
          >
            {current.title}
          </h2>
          <p className="text-navy/70 text-sm md:text-base text-center mt-4 leading-relaxed">
            {current.body}
          </p>

          {/* Primary CTA */}
          <button
            onClick={current.action}
            className="btn-primary w-full mt-7"
          >
            {current.ctaLabel}
          </button>

          {/* Skip — visible on every step */}
          <button
            onClick={onSkip}
            className="block mx-auto mt-3 text-muted hover:text-navy text-xs font-semibold transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}
