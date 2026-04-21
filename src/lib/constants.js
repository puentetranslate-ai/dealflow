export const PHASES = [
  'Offer Accepted',
  'Inspection',
  'Appraisal',
  'Title',
  'Clear to Close',
  'Closed',
]

export const PHASE_STYLES = {
  'Offer Accepted': { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
  'Inspection':     { bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  'Appraisal':      { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
  'Title':          { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
  'Clear to Close': { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  'Closed':         { bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400' },
}

export const LOG_TYPES = ['Call', 'Text', 'Email', 'In-Person', 'Note']

export const DEFAULT_CHECKLIST = {
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
