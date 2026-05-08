// Single source of truth for paywall + subscription-management URLs.
//
// PRO_CHECKOUT_URL is the live Stripe Payment Link for the $20/mo Pro
// subscription. Imported by the Sidebar upgrade card, the Settings
// subscription card, and the UpgradePrompt component, so swapping the
// URL here propagates to every CTA in one edit.

export const PRO_CHECKOUT_URL = 'https://buy.stripe.com/6oUaEY1Gz5oj7n95VT3F603'

// Stripe-hosted Customer Portal — once a user is on Pro they manage
// payment method / cancel from there. Set this to the Customer Portal
// link from Stripe Dashboard → Settings → Billing → Customer Portal.
export const STRIPE_CUSTOMER_PORTAL_URL = 'https://billing.stripe.com/p/login/PLACEHOLDER_CUSTOMER_PORTAL'

// Pricing copy — keep in sync with the Stripe price configuration so
// the paywall numbers don't drift from what the user actually pays.
export const PRO_PRICE_LABEL = '$20/month'
export const PRO_PRICE_SUBLINE = '30-day free trial included. Cancel anytime.'
