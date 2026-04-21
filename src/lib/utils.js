import { format, parseISO, differenceInDays } from 'date-fns'

export const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount || 0)

export const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy')
  } catch {
    return '—'
  }
}

export const formatDateTime = (dateStr) => {
  if (!dateStr) return '—'
  try {
    return format(new Date(dateStr), 'MMM d, yyyy h:mm a')
  } catch {
    return '—'
  }
}

export const daysUntil = (dateStr) => {
  if (!dateStr) return null
  try {
    return differenceInDays(parseISO(dateStr), new Date())
  } catch {
    return null
  }
}

export const daysInPhase = (phaseChangedAt) => {
  if (!phaseChangedAt) return 0
  return Math.abs(differenceInDays(new Date(phaseChangedAt), new Date()))
}

export const isPastDue = (dateStr) => {
  if (!dateStr) return false
  try {
    return differenceInDays(parseISO(dateStr), new Date()) < 0
  } catch {
    return false
  }
}

export const calcCommission = (salePrice, pct) => {
  const price = parseFloat(salePrice)
  const p = parseFloat(pct)
  if (!price || !p) return 0
  return (price * p) / 100
}
