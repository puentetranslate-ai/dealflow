// Single source of truth for paywall + subscription-management URLs.
//
// PLACEHOLDER_PRO_URL is a placeholder — swap it for the actual Stripe
// Payment Link / Checkout URL once the Pro product is live in Stripe.
// Imported by the Sidebar upgrade card, the Settings subscription card,
// and the UpgradePrompt component so a single edit propagates everywhere.

export const PLACEHOLDER_PRO_URL = 'https://buy.stripe.com/PLACEHOLDER_PRO_URL'

// Stripe-hosted Customer Portal — once a user is on Pro they manage
// payment method / cancel from there. Set this to the Customer Portal
// link from Stripe Dashboard → Settings → Billing → Customer Portal.
export const STRIPE_CUSTOMER_PORTAL_URL = 'https://billing.stripe.com/p/login/PLACEHOLDER_CUSTOMER_PORTAL'

// Pricing copy — keep in sync with the Stripe price configuration so
// the paywall numbers don't drift from what the user actually pays.
export const PRO_PRICE_LABEL = '$20/month'
export const PRO_PRICE_SUBLINE = '30-day free trial included. Cancel anytime.'
