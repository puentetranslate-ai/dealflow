// Single source of truth for paywall + subscription-management URLs.
//
// Each *_CHECKOUT_URL is a Stripe Payment Link. The TrialGate (shown
// when the 30-day app trial expires) renders these as tier cards;
// each card sends the user straight to Stripe to enter payment for
// their chosen plan. Imported by Sidebar / Settings / UpgradePrompt
// / TrialGate so swapping a URL here propagates everywhere at once.

export const CORE_CHECKOUT_URL = 'https://buy.stripe.com/cNiaEYgBtaIDePBac93F602'
export const PRO_CHECKOUT_URL  = 'https://buy.stripe.com/6oUaEY1Gz5oj7n95VT3F603'
// Pro+ and Intelligence Payment Links don't exist yet — when they
// ship in Stripe, add the URLs here and the TrialGate will pick them
// up automatically (it already references these constants).
// export const PRO_PLUS_CHECKOUT_URL     = '...'
// export const INTELLIGENCE_CHECKOUT_URL = '...'

// Stripe-hosted Customer Portal — once a user is paid they manage
// their card / cancel from there. Set this to the Customer Portal
// link from Stripe Dashboard → Settings → Billing → Customer Portal.
export const STRIPE_CUSTOMER_PORTAL_URL = 'https://billing.stripe.com/p/login/PLACEHOLDER_CUSTOMER_PORTAL'

// Pricing copy — keep in sync with the Stripe price configuration so
// the paywall numbers don't drift from what the user actually pays.
export const CORE_PRICE_LABEL = '$15/month'
export const PRO_PRICE_LABEL  = '$20/month'
export const PRO_PRICE_SUBLINE = 'Cancel anytime. No long-term commitment.'
