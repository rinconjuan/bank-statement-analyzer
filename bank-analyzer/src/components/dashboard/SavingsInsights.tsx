import { MovementsSummary, MonthWithStats } from '../../services/api'
import { useLanguage } from '../../contexts/LanguageContext'

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(Math.round(n / 1_000))}K`
  return `$${Math.round(n)}`
}

interface Insight {
  label: string
  color: string
  bg: string
  dot: string
}

interface SavingsInsightsProps {
  summary: MovementsSummary
  month: MonthWithStats
}

export function SavingsInsights({ summary, month }: SavingsInsightsProps) {
  const { t } = useLanguage()
  const { total_income, total_expenses, balance } = summary
  const saldoAnterior = month.saldo_anterior ?? null
  const nuevoSaldo    = month.nuevo_saldo    ?? null

  const insights: Insight[] = []

  // ── 1. Ahorro del mes ──────────────────────────────────────────────────────
  if (total_income > 0) {
    if (balance >= 0) {
      insights.push({
        label: t('insights.savedMonth', { amount: fmt(balance) }),
        color: '#16a34a',
        bg: 'rgba(22,163,74,0.10)',
        dot: '#16a34a',
      })
    } else {
      insights.push({
        label: t('insights.spentMore', { amount: fmt(Math.abs(balance)) }),
        color: '#dc2626',
        bg: 'rgba(220,38,38,0.10)',
        dot: '#dc2626',
      })
    }
  }

  // ── 2. Nivel de gasto ─────────────────────────────────────────────────────
  if (total_income > 0 && total_expenses > 0) {
    const pct = Math.round((total_expenses / total_income) * 100)
    if (pct > 90) {
      insights.push({
        label: t('insights.spentPct', { pct: String(pct) }),
        color: '#dc2626',
        bg: 'rgba(220,38,38,0.10)',
        dot: '#dc2626',
      })
    } else if (pct > 70) {
      insights.push({
        label: t('insights.spentPct', { pct: String(pct) }),
        color: '#d97706',
        bg: 'rgba(217,119,6,0.10)',
        dot: '#d97706',
      })
    } else {
      insights.push({
        label: t('insights.spentPct', { pct: String(pct) }),
        color: '#16a34a',
        bg: 'rgba(22,163,74,0.10)',
        dot: '#16a34a',
      })
    }
  }

  // ── 3. Cambio de saldo ────────────────────────────────────────────────────
  if (saldoAnterior !== null && nuevoSaldo !== null) {
    const delta = nuevoSaldo - saldoAnterior
    if (delta > 0) {
      insights.push({
        label: t('insights.balanceUp', { amount: fmt(delta) }),
        color: '#16a34a',
        bg: 'rgba(22,163,74,0.10)',
        dot: '#16a34a',
      })
    } else if (delta < 0) {
      insights.push({
        label: t('insights.balanceDown', { amount: fmt(Math.abs(delta)) }),
        color: '#dc2626',
        bg: 'rgba(220,38,38,0.10)',
        dot: '#dc2626',
      })
    }
  }

  if (insights.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {insights.map((insight, i) => (
        <div
          key={i}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
          style={{ background: insight.bg, color: insight.color, border: `1px solid ${insight.color}33` }}
        >
          <span
            className="flex-shrink-0 rounded-full"
            style={{ width: 7, height: 7, background: insight.dot }}
          />
          {insight.label}
        </div>
      ))}
    </div>
  )
}
