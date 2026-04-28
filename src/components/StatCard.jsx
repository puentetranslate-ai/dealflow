// Generic KPI card. The label sits at the top, the value below it,
// and an optional trend/sub line at the bottom.
//
// `tone` controls the value color: navy (default), gold, green, orange.
// `variant`: 'card' (white) or 'navy' (filled navy with gold accents).
// `onClick` makes the card interactive (renders as a button with hover lift).

const TONE = {
  navy: 'text-navy',
  gold: 'text-gold-dark',
  green: 'text-green-600',
  orange: 'text-orange-500',
  red: 'text-red-500',
}

export default function StatCard({
  label,
  value,
  trend,
  trendTone = 'green',
  icon,
  tone = 'navy',
  variant = 'card',
  children,
  onClick,
}) {
  const isNavy = variant === 'navy'
  const interactive = Boolean(onClick)
  const Tag = interactive ? 'button' : 'div'

  const base = `relative rounded-2xl p-5 w-full text-left ${
    isNavy
      ? 'bg-navy text-white shadow-pop overflow-hidden'
      : 'card'
  }`
  const hover = interactive
    ? 'cursor-pointer hover:scale-[1.02] hover:shadow-pop transition-all duration-200 group'
    : ''

  return (
    <Tag
      onClick={onClick}
      type={interactive ? 'button' : undefined}
      className={`${base} ${hover}`}
    >
      {isNavy && (
        <div className="absolute top-0 right-0 w-24 h-24 bg-gold/10 rounded-full -translate-y-8 translate-x-8 pointer-events-none" />
      )}
      <div className="relative flex items-start justify-between gap-2">
        <p className={`text-xs font-semibold uppercase tracking-[0.12em] ${
          isNavy ? 'text-gold' : 'text-muted'
        }`}>
          {label}
        </p>
        {icon && (
          <span className={`shrink-0 ${isNavy ? 'text-gold' : 'text-muted'}`}>
            {icon}
          </span>
        )}
      </div>

      <p className={`relative font-display text-3xl font-bold mt-2 leading-none ${
        isNavy ? 'text-white' : TONE[tone] || TONE.navy
      }`}>
        {value}
      </p>

      {(trend || children) && (
        <div className="relative mt-3 text-xs">
          {trend && (
            <span
              className={`font-semibold ${
                isNavy
                  ? 'text-gold-light'
                  : trendTone === 'green'
                  ? 'text-green-600'
                  : trendTone === 'orange'
                  ? 'text-orange-500'
                  : 'text-muted'
              }`}
            >
              {trend}
            </span>
          )}
          {children && <div className={isNavy ? 'text-white/70' : 'text-muted'}>{children}</div>}
        </div>
      )}
    </Tag>
  )
}
