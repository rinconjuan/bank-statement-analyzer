import { useEffect, useState } from 'react'
import {
  fetchTrends,
  TrendsReport,
  CategoryTrend,
  RecurringCharge,
  SavingsTrendPoint,
} from '../../services/api'
import { HelpModal } from '../help/HelpModal'
import { useLanguage } from '../../contexts/LanguageContext'
import { translateCategoryName } from '../../i18n/categories'

function formatAmount(n: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n)
}

function trendIcon(trend: string): string {
  if (trend === 'up') return '↑'
  if (trend === 'down') return '↓'
  if (trend === 'new') return '★'
  return '→'
}

function trendColor(trend: string): string {
  if (trend === 'up') return 'var(--accent-red)'
  if (trend === 'down') return 'var(--accent-green)'
  return 'var(--text-muted)'
}

// ── Mini sparkline (SVG) ──────────────────────────────────────────────────
function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null
  const max = Math.max(...points) || 1
  const w = 80
  const h = 28
  const step = w / (points.length - 1)
  const ys = points.map((v) => h - (v / max) * (h - 4) - 2)
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={ys.map((y, i) => `${Math.round(i * step)},${Math.round(y)}`).join(' ')} fill="none" stroke="var(--accent-primary)" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

// ── Spending chart variants ───────────────────────────────────────────────
type SpendingPoint = { label: string; value: number; fullLabel: string }

// A: Line + filled area (SVG)
function SpendingLineArea({ data }: { data: SpendingPoint[] }) {
  if (data.length < 2) return null
  const W = 600; const H = 140; const PAD = { t: 16, r: 8, b: 28, l: 8 }
  const iW = W - PAD.l - PAD.r; const iH = H - PAD.t - PAD.b
  const max = Math.max(...data.map(d => d.value)) || 1
  const min = Math.min(...data.map(d => d.value))
  const range = max - min || 1
  const xs = data.map((_, i) => PAD.l + (i / (data.length - 1)) * iW)
  const ys = data.map(d => PAD.t + iH - ((d.value - min) / range) * iH)
  const line = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  const area = `${line} L${xs[xs.length-1].toFixed(1)},${(PAD.t+iH).toFixed(1)} L${xs[0].toFixed(1)},${(PAD.t+iH).toFixed(1)} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 140, overflow: 'visible' }}>
      <defs>
        <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spendGrad)" />
      <path d={line} fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <g key={d.label}>
          <circle cx={xs[i]} cy={ys[i]} r="4" fill="var(--accent-primary)" />
          <title>{d.fullLabel}: {formatAmount(d.value)}</title>
      <text x={xs[i]} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--text-muted)">{d.label}</text>
        </g>
      ))}
    </svg>
  )
}

// ── Savings chart variants ─────────────────────────────────────────────────

// A: Line with annotated points
function SavingsLine({ points }: { points: SavingsTrendPoint[] }) {
  if (points.length < 2) return null
  const W = 600; const H = 150; const PAD = { t: 28, r: 8, b: 28, l: 8 }
  const iW = W - PAD.l - PAD.r; const iH = H - PAD.t - PAD.b
  const values = points.map(p => p.nuevo_saldo)
  const max = Math.max(...values) || 1
  const min = Math.min(...values)
  const range = max - min || 1
  const xs = points.map((_, i) => PAD.l + (i / (points.length - 1)) * iW)
  const ys = points.map(p => PAD.t + iH - ((p.nuevo_saldo - min) / range) * iH)
  const line = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 150, overflow: 'visible' }}>
      <defs>
        <linearGradient id="savGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent-green)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--accent-green)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={`${line} L${xs[xs.length-1].toFixed(1)},${(PAD.t+iH).toFixed(1)} L${xs[0].toFixed(1)},${(PAD.t+iH).toFixed(1)} Z`} fill="url(#savGrad)" />
      <path d={line} fill="none" stroke="var(--accent-green)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => {
        const isGrowth = p.diferencia >= 0
        const fmt = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 }).format(Math.abs(p.diferencia))
        return (
          <g key={p.month}>
            <circle cx={xs[i]} cy={ys[i]} r="5" fill={isGrowth ? 'var(--accent-green)' : 'var(--accent-red)'} />
            {p.diferencia !== 0 && (
              <text
                x={xs[i]} y={ys[i] - 10}
                textAnchor="middle" fontSize="8.5"
                fill={isGrowth ? 'var(--accent-green)' : 'var(--accent-red)'}
                fontWeight="600"
              >
                {isGrowth ? '+' : '-'}{fmt}
              </text>
            )}
            <text x={xs[i]} y={H - 6} textAnchor="middle" fontSize="9" fill="var(--text-muted)">
              {p.label.split(' ')[0].substring(0, 3)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Category trend row ────────────────────────────────────────────────────
function CategoryTrendRow({ cat, t, lang }: { cat: CategoryTrend; t: (k: string) => string; lang: 'es' | 'en' }) {
  const sparkPoints = cat.points.map((p) => p.total)
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
    >
      <span className="text-lg flex-shrink-0">{cat.category_icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
          {translateCategoryName(cat.category_name, lang)}
        </div>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('trends.monthlyAvg')} {formatAmount(cat.avg_monthly)}
        </div>
      </div>
      <Sparkline points={sparkPoints} />
      <div className="text-right flex-shrink-0 w-24">
        <div
          className="text-sm font-semibold"
          style={{ color: trendColor(cat.trend) }}
        >
          {trendIcon(cat.trend)}{' '}
          {cat.trend !== 'new' && cat.trend !== 'stable'
            ? `${Math.abs(cat.change_pct)}%`
            : cat.trend === 'stable' ? t('trends.stable') : t('trends.new')}
        </div>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('trends.monthCount', { n: String(cat.points.filter((p) => p.total > 0).length) })}
        </div>
      </div>
    </div>
  )
}

// ── Recurring charge row ──────────────────────────────────────────────────
function RecurringRow({ charge, t }: { charge: RecurringCharge; t: (k: string) => string }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--border)' }}
    >
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        style={{ background: 'var(--bg-tertiary)' }}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-base flex-shrink-0">🔄</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {charge.description}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {charge.months_seen} {t('trends.monthCount', { n: String(charge.months_seen) }).replace(/\d+\s*/, '')} · {t('trends.monthlyAvg')} {formatAmount(charge.avg_amount)}
            {charge.min_amount !== charge.max_amount
              ? ` (${formatAmount(charge.min_amount)} – ${formatAmount(charge.max_amount)})`
              : ''}
          </div>
        </div>
        <div
          className="text-xs font-semibold flex-shrink-0 flex items-center gap-1"
          style={{ color: trendColor(charge.trend) }}
        >
          {trendIcon(charge.trend)} {charge.trend === 'stable' ? t('trends.stable') : charge.trend === 'up' ? t('trends.sube') : t('trends.baja')}
        </div>
        <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="px-4 py-3 flex flex-col gap-1" style={{ background: 'var(--bg-secondary)' }}>
          {charge.occurrences.map((o) => (
            <div key={`${o.month}-${o.date}`} className="flex items-center justify-between text-xs">
              <span style={{ color: 'var(--text-secondary)' }}>{o.label} — {o.date}</span>
              <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{formatAmount(o.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main TrendsView ───────────────────────────────────────────────────────
export function TrendsView() {
  const [report, setReport] = useState<TrendsReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [catFilter, setCatFilter] = useState<'all' | 'up' | 'down'>('all')
  const [showHelp, setShowHelp] = useState(false)
  const { lang, t } = useLanguage()

  useEffect(() => {
    setLoading(true)
    fetchTrends()
      .then(setReport)
      .catch(() => setReport(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" style={{ color: 'var(--text-muted)' }}>
        {t('trends.loading')}
      </div>
    )
  }

  if (!report || report.months_analyzed < 1) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="text-4xl">📈</div>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {t('trends.notEnough')}
        </p>
      </div>
    )
  }

  const filteredCats = report.category_trends.filter((c) => {
    if (catFilter === 'up') return c.trend === 'up'
    if (catFilter === 'down') return c.trend === 'down'
    return true
  })

  const barData = report.monthly_totals.map((m) => ({
    label: m.label.split(' ')[0].substring(0, 3),
    fullLabel: m.label,
    value: m.total_expenses,
  }))

  // Top 3 categories with the largest spending increase
  const top3Rising = [...report.category_trends]
    .filter((c) => c.trend === 'up')
    .sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct))
    .slice(0, 3)

  const totals = report.monthly_totals.map((m) => m.total_expenses)
  const firstTotal = totals[0] ?? 0
  const lastTotal = totals[totals.length - 1] ?? 0
  const overallChangePct = firstTotal > 0 ? Math.round(((lastTotal - firstTotal) / firstTotal) * 100) : 0
  const overallTrend = overallChangePct > 5 ? 'up' : overallChangePct < -5 ? 'down' : 'stable'

  const upCount = report.category_trends.filter((c) => c.trend === 'up').length

  const nMonths = report.months_analyzed
  const plural = nMonths !== 1 ? 's' : ''
  const basedLabel = t('trends.basedOn', { n: String(nMonths), plural })

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('trends.title')}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {basedLabel}
          </p>
        </div>
        <button
          onClick={() => setShowHelp(true)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          title={t('btn.help')}
        >
          <span>❓</span> {t('btn.help')}
        </button>
      </div>

      {/* ── Row 1: 3 quick-stat cards ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{t('trends.overallTrend')}</div>
          <div className="text-2xl font-display" style={{ color: trendColor(overallTrend) }}>
            {trendIcon(overallTrend)} {Math.abs(overallChangePct)}%
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {overallTrend === 'up' ? t('trends.increasing') : overallTrend === 'down' ? t('trends.decreasing') : t('trends.stableDesc')}
          </div>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{t('trends.risingCats')}</div>
          <div className="text-2xl font-display" style={{ color: 'var(--accent-red)' }}>
            ↑ {upCount}
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {lang === 'es' ? `de ${report.category_trends.length} categorías` : `of ${report.category_trends.length} categories`}
          </div>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{t('trends.recurringCount')}</div>
          <div className="text-2xl font-display" style={{ color: 'var(--accent-primary)' }}>
            🔄 {report.recurring_charges.length}
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('trends.recurringDetected')}</div>
        </div>
      </div>

      {/* ── Row 2: Savings + Spending side by side ── */}
      <div className="grid gap-5" style={{ gridTemplateColumns: report.savings_trend.length >= 1 && barData.length >= 3 ? '1fr 1fr' : '1fr' }}>
      {report.savings_trend.length >= 1 && (() => {
        const pts = report.savings_trend
        const lastPt = pts[pts.length - 1]
        const firstPt = pts[0]
        const overallDiff = lastPt.nuevo_saldo - firstPt.nuevo_saldo
        const overallPct = firstPt.nuevo_saldo > 0
          ? Math.round((overallDiff / firstPt.nuevo_saldo) * 100)
          : 0
        const savingsTrend = overallPct > 5 ? 'up' : overallPct < -5 ? 'down' : 'stable'
        const positiveDiffs = pts.filter((p) => p.diferencia > 0).length
        const negativeDiffs = pts.filter((p) => p.diferencia < 0).length

        return (
          <div className="rounded-xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {t('trends.savingsTrendTitle')}
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {t('trends.savingsSubtitle')}
                </div>
              </div>
              <div className="text-right">
                <div
                  className="text-sm font-semibold"
                  style={{ color: savingsTrend === 'up' ? 'var(--accent-green)' : savingsTrend === 'down' ? 'var(--accent-red)' : 'var(--text-muted)' }}
                >
                  {savingsTrend === 'up' ? '↑' : savingsTrend === 'down' ? '↓' : '→'}{' '}
                  {savingsTrend !== 'stable' ? `${Math.abs(overallPct)}%` : t('trends.stable')}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {lang === 'es'
                    ? `${pts.length} extracto${pts.length !== 1 ? 's' : ''}`
                    : `${pts.length} statement${pts.length !== 1 ? 's' : ''}`}
                </div>
              </div>
            </div>

            <SavingsLine points={pts} />

            <div className="grid grid-cols-3 gap-3 mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
              <div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('trends.currentBalance')}</div>
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {formatAmount(lastPt.nuevo_saldo)}
                </div>
              </div>
              <div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('trends.positiveMonths')}</div>
                <div className="text-sm font-semibold" style={{ color: 'var(--accent-green)' }}>
                  ↑ {positiveDiffs} {lang === 'es' ? `de ${pts.length}` : `of ${pts.length}`}
                </div>
              </div>
              <div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('trends.totalChange')}</div>
                <div
                  className="text-sm font-semibold"
                  style={{ color: overallDiff >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}
                >
                  {overallDiff >= 0 ? '+' : ''}{formatAmount(overallDiff)}
                </div>
              </div>
            </div>

            {negativeDiffs > positiveDiffs && (
              <div className="mt-3 text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--accent-red)' }}>
                {lang === 'es'
                  ? `⚠️ El saldo bajó en ${negativeDiffs} de los ${pts.length} meses analizados.`
                  : `⚠️ Balance dropped in ${negativeDiffs} of the ${pts.length} analyzed months.`}
              </div>
            )}
          </div>
        )
      })()}

      {barData.length >= 3 && (
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('trends.expPerStatement')}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {lang === 'es' ? `${barData.length} extractos` : `${barData.length} statements`}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold" style={{ color: trendColor(overallTrend) }}>
                {trendIcon(overallTrend)} {Math.abs(overallChangePct)}%
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {overallTrend === 'up' ? t('trends.increasing') : overallTrend === 'down' ? t('trends.decreasing') : t('trends.stableDesc')}
              </div>
            </div>
          </div>
          <SpendingLineArea data={barData} />
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
            {barData.map((d) => (
              <div key={d.label} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{d.fullLabel}</span>{' '}
                {formatAmount(d.value)}
              </div>
            ))}
          </div>
        </div>
      )}
      </div>

      {/* ── Row 3: Top 3 categories rising most ── */}
      {top3Rising.length > 0 && (
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <div className="text-sm font-semibold mb-3" style={{ color: 'var(--accent-red)' }}>
            {lang === 'es' ? '↑ Top 3 categorías que más subieron' : '↑ Top 3 fastest-growing categories'}
          </div>
          <div className="flex flex-col gap-2">
            {top3Rising.map((cat, idx) => (
              <div
                key={cat.category_id ?? cat.category_name}
                className="flex items-center gap-3 px-3 py-2 rounded-lg"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
              >
                <span className="text-base font-bold w-5 text-center" style={{ color: 'var(--text-muted)' }}>
                  {idx + 1}
                </span>
                <span className="text-base flex-shrink-0">{cat.category_icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {translateCategoryName(cat.category_name, lang)}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {t('trends.monthlyAvg')} {formatAmount(cat.avg_monthly)}
                  </div>
                </div>
                <div className="text-sm font-bold" style={{ color: 'var(--accent-red)' }}>
                  ↑ {Math.abs(cat.change_pct)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Row 4: Category trends + Recurring charges side by side ── */}
      {(report.category_trends.length > 0 || report.recurring_charges.length > 0) && (
        <div className="grid gap-5" style={{ gridTemplateColumns: report.category_trends.length > 0 && report.recurring_charges.length > 0 ? '1fr 1fr' : '1fr' }}>

          {report.category_trends.length > 0 && (
            <div className="rounded-xl p-5 flex flex-col" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {t('trends.catEvolution')}
                </div>
                <div className="flex gap-2">
                  {(['all', 'up', 'down'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setCatFilter(f)}
                      className="text-xs px-2 py-1 rounded-lg"
                      style={{
                        background: catFilter === f ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                        color: catFilter === f ? '#fff' : 'var(--text-secondary)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {f === 'all' ? t('trends.all') : f === 'up' ? t('trends.upFilter') : t('trends.downFilter')}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2 flex-1">
                {filteredCats.length === 0 ? (
                  <div className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
                    {t('trends.noCats')}
                  </div>
                ) : (
                  filteredCats.map((cat) => (
                    <CategoryTrendRow key={cat.category_id ?? cat.category_name} cat={cat} t={t} lang={lang} />
                  ))
                )}
              </div>
              <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
                {t('trends.legend')}
              </p>
            </div>
          )}

          {report.recurring_charges.length > 0 && (
            <div className="rounded-xl p-5 flex flex-col" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <div className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                {t('trends.recurringTitle')}
              </div>
              <div className="flex flex-col gap-2 flex-1">
                {report.recurring_charges.map((c) => (
                  <RecurringRow key={c.description} charge={c} t={t} />
                ))}
              </div>
              <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
                {t('trends.recurringNote')}
              </p>
            </div>
          )}

        </div>
      )}

      {showHelp && (
        <HelpModal initialTab="tendencias" onClose={() => setShowHelp(false)} />
      )}
    </div>
  )
}
