import { MovementsSummary } from '../../services/api'
import { useLanguage } from '../../contexts/LanguageContext'
import { translateCategoryName } from '../../i18n/categories'

interface CategoryChartProps {
  summary: MovementsSummary | null
}

function formatAmount(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

interface DataItem {
  name: string
  shortName: string
  icon: string
  value: number
  color: string
}

// ── Opción 1: Barras horizontales ─────────────────────────────────────────────
function Option1({ data, total }: { data: DataItem[]; total: number }) {
  return (
    <div className="flex flex-col gap-1.5 overflow-y-auto" style={{ maxHeight: 215 }}>
      {data.map((item, i) => {
        const pct = total > 0 ? (item.value / total) * 100 : 0
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="flex-shrink-0" style={{ fontSize: 13 }}>{item.icon}</span>
            <span className="text-xs truncate flex-shrink-0" style={{ color: 'var(--text-secondary)', width: 88 }} title={item.shortName}>
              {item.shortName}
            </span>
            <div className="flex-1 rounded-full overflow-hidden" style={{ height: 7, background: 'var(--bg-tertiary)' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: item.color, borderRadius: 9999 }} />
            </div>
            <span className="text-xs font-mono flex-shrink-0" style={{ color: 'var(--text-muted)', width: 30, textAlign: 'right' }}>
              {pct.toFixed(0)}%
            </span>
            <span className="text-xs font-mono flex-shrink-0" style={{ color: 'var(--text-primary)', width: 50, textAlign: 'right' }}>
              {formatAmount(item.value)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export function CategoryChart({ summary }: CategoryChartProps) {
  const { lang, t } = useLanguage()

  const allCategories = summary?.by_category ?? []

  const data: DataItem[] = allCategories
    .map((c) => ({
      name: `${c.category_icon} ${translateCategoryName(c.category_name, lang)}`,
      shortName: translateCategoryName(c.category_name, lang),
      icon: c.category_icon,
      value: c.expense_total,
      color: c.category_color,
    }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value)

  const total = data.reduce((s, d) => s + d.value, 0)

  if (allCategories.length === 0) {
    return (
      <div
        className="rounded-xl p-5 flex items-center justify-center"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', height: 180 }}
      >
        <span style={{ color: 'var(--text-muted)' }}>{t('chart.noData')}</span>
      </div>
    )
  }

  return (
    <div
      className="rounded-xl p-5 flex flex-col"
      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
    >
      <div className="mb-4">
        <h3 className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t('chart.expByCategory')}</h3>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center" style={{ height: 200, color: 'var(--text-muted)', fontSize: 13 }}>
          {t('chart.noExpenses')}
        </div>
      ) : (
        <Option1 data={data} total={total} />
      )}
    </div>
  )
}
