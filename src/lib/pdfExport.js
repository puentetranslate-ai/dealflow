// Client-side PDF export for a single deal. Uses jsPDF with default fonts
// (Helvetica) — embedding Playfair Display + DM Sans would cost ~300 KB
// of font binaries; layout + brand colors carry the DealFlow visual identity.
//
// The dynamic `import('jspdf')` inside `exportDealPdf` keeps jsPDF out of
// the initial bundle. It only downloads on first export click.

import { format, parseISO } from 'date-fns'
import { calcCommission, formatCurrency, formatDate, daysUntil } from './utils'
import { PHASES_BY_ROLE, PHASE_STYLES } from './constants'

// Brand palette as RGB triples (jsPDF wants integers, not hex strings).
const NAVY  = [12, 30, 53]
const GOLD  = [201, 168, 76]
const CREAM = [247, 243, 236]
const MUTED = [138, 154, 181]
const WHITE = [255, 255, 255]
const GREEN = [34, 197, 94]
const RED   = [220, 38, 38]
const RULE  = [232, 230, 226] // light divider

// Letter-size landscape coordinates: width 612, height 792.
const PAGE_W = 612
const PAGE_H = 792
const MARGIN = 40

// Sanitize the address into a filesystem-friendly filename component.
function safeFilename(address) {
  if (!address) return 'deal'
  return address
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 60)
}

export async function exportDealPdf(deal, checklistItems = []) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })

  // ─── Header band ───
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, PAGE_W, 80, 'F')

  // "DealFlow" wordmark — left-aligned in header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...WHITE)
  doc.text('Deal', MARGIN, 50)
  const dealW = doc.getTextWidth('Deal')
  doc.setTextColor(...GOLD)
  doc.text('Flow', MARGIN + dealW, 50)

  // Right-aligned eyebrow
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.text('TRANSACTION SUMMARY', PAGE_W - MARGIN, 50, { align: 'right' })

  // ─── Body content ───
  let y = 120

  // Property address — wraps if long
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...NAVY)
  const addressText = deal.address || 'No address on file'
  const addressLines = doc.splitTextToSize(addressText, PAGE_W - 2 * MARGIN)
  doc.text(addressLines, MARGIN, y)
  y += addressLines.length * 24

  // Phase pill
  const phase = deal.phase || 'Unknown'
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  const phaseTextW = doc.getTextWidth(phase.toUpperCase())
  const pillW = phaseTextW + 18
  const pillH = 18
  doc.setFillColor(...GOLD)
  doc.roundedRect(MARGIN, y - 4, pillW, pillH, 9, 9, 'F')
  doc.setTextColor(...NAVY)
  doc.text(phase.toUpperCase(), MARGIN + 9, y + 8)

  y += 36

  // ─── Transaction Summary section ───
  y = section(doc, 'TRANSACTION SUMMARY', y)
  y += 6

  const commission = calcCommission(deal.sale_price, deal.commission_pct)
  const closingDays = deal.closing_date ? daysUntil(deal.closing_date) : null
  const role = deal.agent_role === 'buyer' ? "Buyer's Agent" : 'Listing Agent'

  // 2-column grid of label/value pairs
  const stats = [
    ['Sale Price',    deal.sale_price ? formatCurrency(deal.sale_price) : '—'],
    ['Commission',    `${formatCurrency(commission)} (${deal.commission_pct ?? 0}%)`],
    ['Agent Role',    role],
    ['Phase',         phase],
    ['Offer Date',    formatDate(deal.offer_date)],
    ['Closing Date',  deal.closing_date
      ? `${formatDate(deal.closing_date)}${closingDays != null && closingDays >= 0 ? ` · ${closingDays}d remaining` : ''}`
      : '—'],
  ]
  y = renderTwoColumnGrid(doc, stats, y, MARGIN, PAGE_W - 2 * MARGIN)
  y += 14

  // ─── Contacts section ───
  y = ensureRoom(doc, y, 120)
  y = section(doc, 'CONTACTS', y)
  y += 6

  const colW = (PAGE_W - 2 * MARGIN - 16) / 2
  const buyerY = renderContactCard(
    doc, 'Buyer', deal.buyer_name, deal.buyer_phone, deal.buyer_email,
    MARGIN, y, colW
  )
  const sellerY = renderContactCard(
    doc, 'Seller', deal.seller_name, deal.seller_phone, deal.seller_email,
    MARGIN + colW + 16, y, colW
  )
  y = Math.max(buyerY, sellerY) + 14

  // ─── Checklist section ───
  if (checklistItems && checklistItems.length > 0) {
    y = ensureRoom(doc, y, 100)
    y = section(doc, 'CHECKLIST PROGRESS', y)
    y += 4

    const phasesForRole = PHASES_BY_ROLE[deal.agent_role] || PHASES_BY_ROLE.buyer
    const orderedPhases = phasesForRole.filter((p) => p !== 'Closed')

    for (const phaseName of orderedPhases) {
      const items = checklistItems.filter((i) => i.phase === phaseName)
      if (items.length === 0) continue
      const done = items.filter((i) => i.is_checked).length

      y = ensureRoom(doc, y, 60)

      // Phase header
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(...NAVY)
      doc.text(phaseName, MARGIN, y)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...MUTED)
      doc.text(`${done}/${items.length}`, PAGE_W - MARGIN, y, { align: 'right' })
      y += 6

      // Progress bar
      const barW = PAGE_W - 2 * MARGIN
      const barH = 4
      doc.setFillColor(...RULE)
      doc.roundedRect(MARGIN, y, barW, barH, 2, 2, 'F')
      const fillW = items.length > 0 ? (done / items.length) * barW : 0
      doc.setFillColor(...GOLD)
      doc.roundedRect(MARGIN, y, fillW, barH, 2, 2, 'F')
      y += 14

      // Items
      for (const item of items) {
        y = ensureRoom(doc, y, 20)
        renderChecklistRow(doc, item, MARGIN, y)
        y += 14
      }
      y += 8
    }
  } else {
    y = ensureRoom(doc, y, 60)
    y = section(doc, 'CHECKLIST PROGRESS', y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...MUTED)
    doc.text('No checklist items.', MARGIN, y + 6)
    y += 20
  }

  // ─── Notes (if any) ───
  if (deal.notes && deal.notes.trim()) {
    y = ensureRoom(doc, y, 80)
    y = section(doc, 'NOTES', y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...NAVY)
    const noteLines = doc.splitTextToSize(deal.notes, PAGE_W - 2 * MARGIN)
    for (const line of noteLines) {
      y = ensureRoom(doc, y, 14)
      doc.text(line, MARGIN, y)
      y += 14
    }
  }

  // ─── Footer on every page ───
  const totalPages = doc.internal.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    drawFooter(doc, p, totalPages)
  }

  const filename = `DealFlow_${safeFilename(deal.address)}_${format(new Date(), 'yyyy-MM-dd')}.pdf`
  doc.save(filename)
}

// ─────────────────────────── Helpers ───────────────────────────

// Section heading: gold uppercase eyebrow + thin gold rule.
function section(doc, label, y) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...GOLD)
  doc.text(label, MARGIN, y)
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.6)
  doc.line(MARGIN, y + 4, PAGE_W - MARGIN, y + 4)
  return y + 18
}

// Two-column grid of [label, value] pairs.
function renderTwoColumnGrid(doc, pairs, startY, x, width) {
  const colW = (width - 16) / 2
  let y = startY
  let col = 0

  for (const [label, value] of pairs) {
    const cx = x + col * (colW + 16)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(label.toUpperCase(), cx, y)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...NAVY)
    const valueStr = String(value || '—')
    const lines = doc.splitTextToSize(valueStr, colW)
    doc.text(lines[0] || '—', cx, y + 14)

    if (col === 1) {
      y += 38
      col = 0
    } else {
      col = 1
    }
  }
  // If we ended on col 1 (odd count), advance y to clear the row
  if (col === 1) y += 38
  return y
}

// Single contact card (buyer or seller). Returns the bottom y so the caller
// can compute the max of the buyer/seller pair.
function renderContactCard(doc, role, name, phone, email, x, y, w) {
  // Background panel
  doc.setFillColor(...CREAM)
  doc.roundedRect(x, y, w, 90, 6, 6, 'F')

  // Eyebrow
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...GOLD)
  doc.text(role.toUpperCase(), x + 14, y + 18)

  // Name
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...NAVY)
  doc.text(name || '—', x + 14, y + 38)

  // Phone / email
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...NAVY)
  doc.text(`Phone: ${phone || '—'}`, x + 14, y + 58)
  const emailLine = `Email: ${email || '—'}`
  const wrapped = doc.splitTextToSize(emailLine, w - 28)
  doc.text(wrapped[0] || emailLine, x + 14, y + 76)

  return y + 90
}

// One checklist row — checkmark/dash + label + optional due date.
function renderChecklistRow(doc, item, x, y) {
  // Status indicator (filled green box + check, or empty box)
  const boxSize = 9
  const boxY = y - 7
  doc.setLineWidth(0.6)
  if (item.is_checked) {
    doc.setFillColor(...GREEN)
    doc.setDrawColor(...GREEN)
    doc.roundedRect(x, boxY, boxSize, boxSize, 1.5, 1.5, 'FD')
    // Checkmark glyph (cheap: a thick line)
    doc.setDrawColor(...WHITE)
    doc.setLineWidth(1.2)
    doc.line(x + 2, boxY + 5, x + 4, boxY + 7)
    doc.line(x + 4, boxY + 7, x + 7.5, boxY + 2.5)
  } else {
    doc.setDrawColor(...MUTED)
    doc.setFillColor(...WHITE)
    doc.roundedRect(x, boxY, boxSize, boxSize, 1.5, 1.5, 'FD')
  }

  // Label
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(item.is_checked ? MUTED : NAVY)
  const labelText = item.is_checked ? `${item.label}` : item.label
  const labelW = PAGE_W - 2 * MARGIN - boxSize - 70
  const lines = doc.splitTextToSize(labelText, labelW)
  doc.text(lines[0] || '', x + boxSize + 8, y)

  // Due date (right-aligned)
  if (item.due_date) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...MUTED)
    doc.text(`Due ${formatDate(item.due_date)}`, PAGE_W - MARGIN, y, { align: 'right' })
  }
}

// If the next chunk won't fit on the current page, start a new one.
function ensureRoom(doc, y, neededHeight) {
  if (y + neededHeight > PAGE_H - 60) {
    doc.addPage()
    return 60
  }
  return y
}

function drawFooter(doc, page, totalPages) {
  const footerY = PAGE_H - 30
  doc.setDrawColor(...RULE)
  doc.setLineWidth(0.5)
  doc.line(MARGIN, footerY - 12, PAGE_W - MARGIN, footerY - 12)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)

  const generated = `Generated ${format(new Date(), "MMM d, yyyy 'at' h:mm a")}`
  doc.text(generated, MARGIN, footerY)

  doc.text('DealFlow · dealflownow.net', PAGE_W / 2, footerY, { align: 'center' })

  if (totalPages > 1) {
    doc.text(`Page ${page} of ${totalPages}`, PAGE_W - MARGIN, footerY, { align: 'right' })
  }
}
