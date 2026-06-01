// Public Terms of Service. Linked from the marketing footer, signup
// page, and any pre-purchase surface that needs to expose the legal
// agreement. Plain English where possible, ordered by topic.
//
// Authored fresh for DealFlow + Puente Translations LLC — not pulled
// from a generic template generator.

import { Link } from 'react-router-dom'

export default function Terms() {
  return (
    <div className="min-h-screen bg-cream text-navy">
      <header className="border-b border-navy/[0.08] bg-cream/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-5 md:px-8 py-5 flex items-center justify-between">
          <Link to="/" className="font-display text-xl font-bold tracking-tight">
            Deal<span className="text-gold">Flow</span>
          </Link>
          <Link
            to="/"
            className="text-sm font-semibold text-muted hover:text-navy transition-colors"
          >
            &larr; Back to site
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 md:px-8 py-12 md:py-16">
        <p className="text-xs uppercase tracking-[0.18em] font-bold text-gold-dark">
          Legal
        </p>
        <h1 className="font-display text-4xl md:text-5xl font-bold mt-2 leading-tight">
          Terms of Service
        </h1>
        <p className="text-muted text-sm mt-3">Last updated: June 1, 2026</p>

        <div className="mt-10 space-y-10 text-sm md:text-[15px] leading-relaxed">
          <Section title="Welcome">
            <p>
              Welcome to DealFlow. By using our service, you agree to these terms. Please read them carefully — they're written in plain English wherever possible.
            </p>
          </Section>

          <Section title="1. Who we are">
            <p>
              DealFlow is operated by <strong>Puente Translations LLC</strong> ("we," "us," "our"), a Florida limited liability company based in Tampa, FL. By creating an account, signing into DealFlow, or using any feature of the service, you ("you," "your") agree to be bound by these Terms of Service.
            </p>
          </Section>

          <Section title="2. What DealFlow is">
            <p>
              DealFlow is a transaction management platform for real estate agents. It lets you manage deals, leads, clients, communications, calendars, commissions, and related workflows from a single account.
            </p>
          </Section>

          <Section title="3. Your account">
            <p>
              You need a valid email address to sign up. You're responsible for keeping your password confidential and for everything that happens under your account. If you suspect unauthorized access, contact us immediately at{' '}
              <a href="mailto:support@dealflownow.net" className="text-gold-dark hover:underline">
                support@dealflownow.net
              </a>
              .
            </p>
          </Section>

          <Section title="4. Subscription and billing">
            <p>
              DealFlow offers tiered subscription plans (Core, Pro, and others as they launch). All paid subscriptions are billed monthly through Stripe. You can cancel any time — your access continues until the end of your current billing period.
            </p>
            <p className="mt-3">
              We do not store or process your credit card information ourselves. All payment data is handled directly by Stripe — the same payment infrastructure used by Apple, Amazon, and Shopify.
            </p>
          </Section>

          <Section title="5. Free trial">
            <p>
              New accounts get 30 days of free access to DealFlow features. No credit card is required to start your trial. At the end of 30 days, you'll be asked to choose a plan to continue using DealFlow. If you don't choose a plan, your access will be paused but your data will remain safe.
            </p>
          </Section>

          <Section title="6. Your data">
            <p>
              Your deals, leads, clients, communications, files, and any other content you upload to DealFlow are yours. You own them, and we don't claim any rights over them. We don't sell your data, share it with advertisers, or use it for marketing purposes.
            </p>
            <p className="mt-3">
              We store your data securely. See our{' '}
              <Link to="/privacy" className="text-gold-dark hover:underline">
                Privacy Policy
              </Link>{' '}
              for the technical details. Each agent's data is completely isolated from every other agent's at the database level — no DealFlow user can see another user's deals, leads, or files.
            </p>
            <p className="mt-3">
              You can export your data at any time and delete your account at any time. When you delete your account, we remove your data within 30 days.
            </p>
          </Section>

          <Section title="7. Acceptable use">
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Use DealFlow for any illegal purpose</li>
              <li>Attempt to reverse-engineer, hack, or compromise the service</li>
              <li>Upload malware, viruses, or harmful content</li>
              <li>Send spam, harassment, or unsolicited commercial messages through the platform</li>
              <li>Share your account credentials with other people (sub-accounts will be available when team tiers launch)</li>
            </ul>
            <p className="mt-3">
              We may suspend or terminate your account if you violate these rules.
            </p>
          </Section>

          <Section title="8. Service availability">
            <p>
              We work hard to keep DealFlow running 24/7, but we can't guarantee uninterrupted service. Servers go down, software has bugs, the internet has bad days. We'll do our best to minimize downtime and respond to issues quickly.
            </p>
          </Section>

          <Section title="9. Disclaimers">
            <p>
              DealFlow is provided "as is." We make no warranties beyond what's required by law. DealFlow is not a substitute for professional legal, tax, or financial advice — please consult appropriate professionals for those decisions.
            </p>
          </Section>

          <Section title="10. Limitation of liability">
            <p>
              To the maximum extent permitted by law, our total liability to you for any claim related to DealFlow is limited to the amount you paid us in the 12 months before the claim arose. We are not liable for indirect, incidental, special, consequential, or punitive damages.
            </p>
          </Section>

          <Section title="11. Dispute resolution">
            <p>
              If we have a dispute, we agree to try to resolve it informally first. Contact us at{' '}
              <a href="mailto:support@dealflownow.net" className="text-gold-dark hover:underline">
                support@dealflownow.net
              </a>{' '}
              and we'll do our best to work it out.
            </p>
            <p className="mt-3">
              If we can't reach an informal resolution, any unresolved dispute will be settled by binding arbitration in Hillsborough County, Florida, under the rules of the American Arbitration Association. Florida law governs these terms.
            </p>
          </Section>

          <Section title="12. Changes to these terms">
            <p>
              We may update these Terms of Service from time to time. If we make material changes, we'll notify you by email at least 30 days before the changes take effect. Continued use of DealFlow after the change date means you accept the new terms.
            </p>
          </Section>

          <Section title="13. Contact">
            <address className="not-italic">
              Puente Translations LLC<br />
              15238 E Pond Woods Dr<br />
              Tampa, FL 33618<br />
              <a href="mailto:support@dealflownow.net" className="text-gold-dark hover:underline">
                support@dealflownow.net
              </a>
            </address>
          </Section>
        </div>
      </main>

      <footer className="bg-navy text-white">
        <div className="max-w-3xl mx-auto px-5 md:px-8 py-8 text-center">
          <p className="font-display text-lg font-bold">
            Deal<span className="text-gold">Flow</span>
          </p>
          <p className="text-white/60 text-xs mt-2">
            &copy; 2026 Puente Translations LLC &middot;{' '}
            <Link to="/privacy" className="text-gold-light hover:text-gold">Privacy</Link>{' '}&middot;{' '}
            <Link to="/pricing" className="text-gold-light hover:text-gold">Pricing</Link>
          </p>
        </div>
      </footer>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="font-display text-xl md:text-2xl font-bold text-navy">{title}</h2>
      <div className="mt-3 text-navy/80">{children}</div>
    </section>
  )
}
