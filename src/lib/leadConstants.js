// Lead temperature/source/interest enums + style maps.
// Kept separate from constants.js so the deal pipeline file stays focused.

export const TEMPERATURES = ['Hot', 'Warm', 'Cold']

export const TEMP_STYLES = {
  Hot: {
    label: 'Hot',
    hex: '#ef4444',
    bg: 'bg-red-100',
    text: 'text-red-700',
    dot: 'bg-red-500',
    border: 'border-red-400',
    accent: 'border-l-red-500',
    soft: 'bg-red-50',
  },
  Warm: {
    label: 'Warm',
    hex: '#f59e0b',
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    border: 'border-amber-400',
    accent: 'border-l-amber-500',
    soft: 'bg-amber-50',
  },
  Cold: {
    label: 'Cold',
    hex: '#3b82f6',
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
    border: 'border-blue-400',
    accent: 'border-l-blue-500',
    soft: 'bg-blue-50',
  },
}

export const TEMP_DESCRIPTIONS = {
  Hot: 'Ready to move soon, actively looking',
  Warm: 'Interested but not urgent',
  Cold: 'Early stage, just exploring',
}

export const INTEREST_TYPES = ['Buying', 'Selling']

export const SOURCES = [
  'Zillow',
  'Realtor.com',
  'Open House',
  'Sign Call',
  'Referral',
  'Social Media',
  'Past Client',
  'Cold Outreach',
  'Walk-in',
  'Other',
]
