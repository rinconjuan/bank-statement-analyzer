import { useEffect, useState } from 'react'
import {
  fetchTrends,
  TrendsReport,
  CategoryTrend,
  RecurringCharge,
} from '../../services/api'

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

// ── Bar chart (simple HTML) ───────────────────────────────────────────────
function BarChart({ data }: { data: { label: string; value: number; color?: string }[] }) {
  const max = Math.max(...data.map((d) => d.value)) || 1
  return (
    <div className="flex items-end gap-2 w-full" style={{ height: 120 }}>
      {data.map((d) => (
        <div key={d.label} className="flex flex-col items-center flex-1 gap-1 min-w-0">
          <div
            className="w-full rounded-t"
            style={{
              height: Math.max(4, Math.round((d.value / max) * 100)),
              background: d.color ?? 'var(--accent-primary)',
              opacity: 0.85,
            }}
            title={formatAmount(d.value)}
          />
          <span className="text-xs truncate w-full text-center" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
            {d.label}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Category trend row ────────────────────────────────────────────────────
function CategoryTrendRow({ cat }: { cat: CategoryTrend }) {
  const sparkPoints = cat.points.map((p) => p.total)
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
    >
      <span className="text-lg flex-shrink-0">{cat.category_icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
          {cat.category_name}
        </div>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Prom. mensual: {formatAmount(cat.avg_monthly)}
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
            : cat.trend === 'stable' ? 'Estable' : 'Nuevo'}
        </div>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {cat.points.filter((p) => p.total > 0).length} mes(es)
        </div>
      </div>
    </div>
  )
}

// ── Recurring charge row ──────────────────────────────────────────────────
function RecurringRow({ charge }: { charge: RecurringCharge }) {
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
            {charge.months_seen} meses · Prom. {formatAmount(charge.avg_amount)}
            {charge.min_amount !== charge.max_amount
              ? ` (${formatAmount(charge.min_amount)} – ${formatAmount(charge.max_amount)})`
              : ''}
          </div>
        </div>
        <div
          className="text-xs font-semibold flex-shrink-0 flex items-center gap-1"
          style={{ color: trendColor(charge.trend) }}
        >
          {trendIcon(charge.trend)} {charge.trend === 'stable' ? 'Estable' : charge.trend === 'up' ? 'Sube' : 'Baja'}
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
        Calculando tendencias…
      </div>
    )
  }

  if (!report || report.months_analyzed < 1) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="text-4xl">📈</div>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Carga al menos 2 extractos para ver tendencias.
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
    label: m.label.split(' ')[0].substring(0, 3),  // first 3 chars of month name
    value: m.total_expenses,
  }))

  // Compute overall trend for the hero banner
  const totals = report.monthly_totals.map((m) => m.total_expenses)
  const firstTotal = totals[0] ?? 0
  const lastTotal = totals[totals.length - 1] ?? 0
  const overallChangePct = firstTotal > 0 ? Math.round(((lastTotal - firstTotal) / firstTotal) * 100) : 0
  const overallTrend = overallChangePct > 5 ? 'up' : overallChangePct < -5 ? 'down' : 'stable'

  const upCount = report.category_trends.filter((c) => c.trend === 'up').length

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ── Header ── */}
      <div>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          📈 Tendencias de gasto
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Basado en {report.months_analyzed} extracto{report.months_analyzed !== 1 ? 's' : ''} cargado{report.months_analyzed !== 1 ? 's' : ''}
        </p>
      </div>

      {/* ── Row 1: 3 quick-stat cards ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Tendencia general</div>
          <div className="text-2xl font-display" style={{ color: trendColor(overallTrend) }}>
            {trendIcon(overallTrend)} {Math.abs(overallChangePct)}%
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {overallTrend === 'up' ? 'Gasto en aumento' : overallTrend === 'down' ? 'Gasto reduciéndose' : 'Gasto estable'}
          </div>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Categorías en alza</div>
          <div className="text-2xl font-display" style={{ color: 'var(--accent-red)' }}>
            ↑ {upCount}
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>de {report.category_trends.length} categorías</div>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Cargos recurrentes</div>
          <div className="text-2xl font-display" style={{ color: 'var(--accent-primary)' }}>
            🔄 {report.recurring_charges.length}
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>detectados (2+ meses)</div>
        </div>
      </div>

      {/* ── Row 2: Spending bar chart ── */}
      {barData.length >= 2 && (
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <div className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Gastos por extracto
          </div>
          <BarChart data={barData} />
          <div className="flex flex-wrap gap-3 mt-3">
            {report.monthly_totals.map((m) => (
              <div key={m.month} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{m.label}</span>{' '}
                {formatAmount(m.total_expenses)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Row 3: Category trends ── */}
      {report.category_trends.length > 0 && (
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Evolución por categoría
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
                  {f === 'all' ? 'Todas' : f === 'up' ? '↑ Subiendo' : '↓ Bajando'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {filteredCats.length === 0 ? (
              <div className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
                Sin categorías con este filtro
              </div>
            ) : (
              filteredCats.map((cat) => (
                <CategoryTrendRow key={cat.category_id ?? cat.category_name} cat={cat} />
              ))
            )}
          </div>
          <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
            ↑ Sube &gt;10% · ↓ Baja &gt;10% · → Estable · ★ Nuevo (solo en último mes)
          </p>
        </div>
      )}

      {/* ── Row 4: Recurring charges ── */}
      {report.recurring_charges.length > 0 && (
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <div className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            Cargos recurrentes / suscripciones detectadas
          </div>
          <div className="flex flex-col gap-2">
            {report.recurring_charges.map((c) => (
              <RecurringRow key={c.description} charge={c} />
            ))}
          </div>
          <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
            Se detectan transacciones con descripción similar presentes en 2 o más extractos.
          </p>
        </div>
      )}
    </div>
  )
}
