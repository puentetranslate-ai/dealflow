// Public Privacy Policy. Companion to Terms.jsx. Plain English account
// of what we collect, where it lives, who can see it, and what we
// explicitly do not do.

import { Link } from 'react-router-dom'

export default function Privacy() {
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
          Privacy Policy
        </h1>
        <p className="text-muted text-sm mt-3">Last updated: June 1, 2026</p>

        <div className="mt-10 space-y-10 text-sm md:text-[15px] leading-relaxed">
          <Section title="Welcome">
            <p>
              This Privacy Policy explains what data DealFlow collects, how we use it, and what you can do about it.
            </p>
            <p className="mt-3">
              DealFlow is operated by <strong>Puente Translations LLC</strong>, a Florida limited liability company. This policy applies to dealflownow.net and any associated services.
            </p>
          </Section>

          <Section title="What data we collect">
            <p>When you use DealFlow, you create and upload:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Deal information (addresses, prices, parties, deadlines)</li>
              <li>Lead information (contacts, sources, follow-up dates)</li>
              <li>Client information (names, emails, phone numbers)</li>
              <li>Communications (call logs, text logs, email logs you enter)</li>
              <li>Files (contracts, inspection reports, photos you upload)</li>
              <li>Calendar events (showings, closings, deadlines)</li>
            </ul>
            <p className="mt-3">
              We also collect minimal account information needed to operate the service:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Your email address (for sign-in and notifications)</li>
              <li>Your full name (for display in the app)</li>
              <li>Your subscription status (for billing)</li>
            </ul>
            <p className="mt-3">We do NOT collect:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Browsing history outside DealFlow</li>
              <li>Information about other apps you use</li>
              <li>Your physical location (beyond what's in your deal addresses)</li>
              <li>Your contacts' data unless you've manually added them as leads or clients</li>
            </ul>
          </Section>

          <Section title="Where we store it">
            <p>Your data is stored on infrastructure operated by:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Supabase</strong> — structured data (deals, leads, clients, etc.). Hosted in AWS US-East.</li>
              <li><strong>AWS S3</strong> (via Supabase Storage) — files you upload.</li>
              <li><strong>Vercel</strong> — the DealFlow web application itself.</li>
              <li><strong>Stripe</strong> — payment information (we never see or store card details).</li>
              <li><strong>Resend</strong> — transactional and marketing emails we send you.</li>
            </ul>
            <p className="mt-3">
              All of these are SOC 2 / GDPR-compliant providers used by thousands of other production businesses.
            </p>
          </Section>

          <Section title="Who can see your data">
            <p><strong>You</strong> can see your own data. That's the point of the product.</p>
            <p className="mt-3">
              <strong>We</strong> (Puente Translations LLC employees and contractors) can see your data only when investigating a support issue you've raised, debugging a problem affecting service quality, or complying with a legal request.
            </p>
            <p className="mt-3">
              <strong>Other DealFlow agents cannot see your data, ever.</strong> Your data is isolated at the database level via row-level security policies. There is no shared bucket of user data — every row in our database is tagged with a single user ID and access is enforced before any read.
            </p>
            <p className="mt-3">
              <strong>Your clients</strong> can see only the specific information you choose to share with them through the Client Portal (when you create one — Pro tier and above).
            </p>
            <p className="mt-3">
              <strong>Stripe</strong> sees the subscription billing information you enter when you subscribe. Their privacy policy is at stripe.com/privacy.
            </p>
          </Section>

          <Section title="What we don't do">
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>We don't sell your data.</li>
              <li>We don't share your data with advertisers.</li>
              <li>We don't use your data to train AI models.</li>
              <li>We don't show ads inside DealFlow.</li>
              <li>We don't sell or rent your email address.</li>
            </ul>
          </Section>

          <Section title="Payment information">
            <p>
              We never receive, store, or process credit card numbers ourselves. When you subscribe, you enter your card details directly with Stripe, who handles all of it. We only receive a customer reference ID and subscription status from Stripe — nothing else.
            </p>
          </Section>

          <Section title="Encryption">
            <p>Your data is encrypted in two ways:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>In transit</strong> — TLS 1.3 between your browser and our servers. Anyone intercepting the connection sees encrypted gibberish.</li>
              <li><strong>At rest</strong> — AES-256 encryption on Supabase's storage. Even if the underlying hardware were stolen, the data would be unreadable.</li>
            </ul>
          </Section>

          <Section title="Cookies and analytics">
            <p>
              DealFlow uses cookies for authentication (to keep you signed in) and basic technical operation. We don't use third-party advertising cookies. We do not track you across other websites.
            </p>
          </Section>

          <Section title="Your rights">
            <p>You can:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                <strong>Export your data</strong> at any time by emailing{' '}
                <a href="mailto:support@dealflownow.net" className="text-gold-dark hover:underline">
                  support@dealflownow.net
                </a>
                . We'll send you a JSON file containing everything we have about you within 7 days.
              </li>
              <li>
                <strong>Delete your account</strong> at any time. When you delete, your data is permanently removed within 30 days. Anything we retain for compliance purposes is anonymized.
              </li>
              <li>
                <strong>Correct your data</strong> by editing it directly in the app or by emailing us.
              </li>
            </ul>
            <p className="mt-3">
              If you're in the European Union or California, you may have additional rights under GDPR or CCPA. Email us and we'll honor them.
            </p>
          </Section>

          <Section title="Children">
            <p>
              DealFlow is intended for use by real estate professionals. We don't knowingly collect information from anyone under 18. If you believe a child has created an account, email us and we'll remove it.
            </p>
          </Section>

          <Section title="Changes to this policy">
            <p>
              We'll update this policy as the service evolves. If we make material changes, we'll notify you by email at least 30 days before the changes take effect.
            </p>
          </Section>

          <Section title="Contact">
            <p>Questions about your data, this policy, or anything privacy-related:</p>
            <address className="not-italic mt-3">
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
            <Link to="/terms" className="text-gold-light hover:text-gold">Terms</Link>{' '}&middot;{' '}
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
