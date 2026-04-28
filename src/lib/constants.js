// Unified, ordered list of every transaction phase the app knows about.
// Used for: pipeline bar buckets, phase badges, deal phase dropdown,
// checklist groupings, deal timeline.
export const PHASES = [
  'Listed',
  'Showing Period',
  'Offer Received',
  'Searching',
  'Offer Made',
  'Offer Accepted',
  'Inspection',
  'Appraisal',
  'Title',
  'Clear to Close',
  'Closed',
]

// Phases vary by which side of the deal the agent is on. The deal phase
// dropdown on the form, the checklist grouping on the deal detail page,
// and the right-rail timeline all key off this map.
export const PHASES_BY_ROLE = {
  buyer: [
    'Searching',
    'Offer Made',
    'Offer Accepted',
    'Inspection',
    'Appraisal',
    'Title',
    'Clear to Close',
    'Closed',
  ],
  seller: [
    'Listed',
    'Showing Period',
    'Offer Received',
    'Offer Accepted',
    'Inspection',
    'Appraisal',
    'Title',
    'Clear to Close',
    'Closed',
  ],
}

export const getPhasesForRole = (role) =>
  PHASES_BY_ROLE[role] || PHASES_BY_ROLE.buyer

// Default starting phase the form should pick when the role flips and the
// previously-chosen phase is no longer valid.
export const getDefaultPhaseForRole = (role) =>
  getPhasesForRole(role)[0]

// Tailwind class triples for each phase. Pre-offer phases use new tones
// (slate/indigo/sky); the post-offer flow keeps the existing brand colors.
export const PHASE_STYLES = {
  'Listed':         { bg: 'bg-slate-100',  text: 'text-slate-700',  dot: 'bg-slate-500' },
  'Showing Period': { bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  'Offer Received': { bg: 'bg-sky-100',    text: 'text-sky-700',    dot: 'bg-sky-500' },
  'Searching':      { bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  'Offer Made':     { bg: 'bg-sky-100',    text: 'text-sky-700',    dot: 'bg-sky-500' },
  'Offer Accepted': { bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500' },
  'Inspection':     { bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  'Appraisal':      { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
  'Title':          { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
  'Clear to Close': { bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500' },
  'Closed':         { bg: 'bg-gray-100',   text: 'text-gray-500',   dot: 'bg-gray-400' },
}

export const LOG_TYPES = ['Call', 'Text', 'Email', 'In-Person', 'Note']

// Pre-built checklists per role. New deals seed only the items that match
// the agent's side of the transaction.
const SHARED_POST_OFFER_CHECKLIST = {
  'Offer Accepted': [
    'Signed purchase agreement received',
    'Earnest money deposit confirmed',
    'Title company selected and opened',
    "Homeowner's insurance initiated",
  ],
  'Inspection': [
    'Inspection scheduled',
    'Inspection completed — report received',
    'Repair requests submitted to seller',
    'Repair addendum signed (if applicable)',
  ],
  'Appraisal': [
    'Appraisal ordered by lender',
    'Appraisal completed',
    'Value confirmed at or above contract price',
    'Any appraisal gap addressed',
  ],
  'Title': [
    'Title search ordered',
    'Title commitment received',
    'Title issues resolved (if any)',
    'Closing date confirmed with title company',
  ],
  'Clear to Close': [
    'Clear to close issued by lender',
    'Final walkthrough scheduled',
    'Final walkthrough completed',
    'Closing disclosure reviewed and signed',
  ],
}

export const DEFAULT_CHECKLIST_BUYER = {
  'Searching': [
    'Buyer pre-approval letter received',
    'Search criteria confirmed with buyer',
    'Property alerts set up in MLS',
    'Buyer consultation completed',
  ],
  'Offer Made': [
    'Comparable sales reviewed with buyer',
    'Offer price and terms agreed',
    'Offer submitted to listing agent',
    'Awaiting seller response',
  ],
  ...SHARED_POST_OFFER_CHECKLIST,
}

export const DEFAULT_CHECKLIST_SELLER = {
  'Listed': [
    'Property photos completed',
    'Listing entered in MLS',
    'For sale sign installed',
    'Lockbox installed',
    'Seller disclosure form completed',
    'Listing agreement signed',
  ],
  'Showing Period': [
    'Showing instructions sent to agents',
    'Property cleaned and staged',
    'Lockbox code distributed',
    'Feedback collected from showings',
  ],
  'Offer Received': [
    'Offer reviewed with seller',
    'Counter offer or acceptance prepared',
    'Response deadline noted',
    'Multiple offer situation managed if applicable',
  ],
  ...SHARED_POST_OFFER_CHECKLIST,
}

// Combined map for legacy code paths that still iterate every phase.
// Newer code should pick by role via getDefaultChecklist.
export const DEFAULT_CHECKLIST = {
  ...DEFAULT_CHECKLIST_SELLER,
  ...DEFAULT_CHECKLIST_BUYER,
}

export const getDefaultChecklist = (role) =>
  role === 'seller' ? DEFAULT_CHECKLIST_SELLER : DEFAULT_CHECKLIST_BUYER
