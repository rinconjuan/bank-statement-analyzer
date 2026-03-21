import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { MovementsSummary } from '../../services/api'

interface CategoryChartProps {
  summary: MovementsSummary | null
}

function formatAmount(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

type Tab = 'expense' | 'income'

export function CategoryChart({ summary }: CategoryChartProps) {
  const [tab, setTab] = useState<Tab>('expense')

  const allCategories = summary?.by_category ?? []

  const data = allCategories
    .map((c) => ({
      name: `${c.category_icon} ${c.category_name}`,
      shortName: c.category_name,
      icon: c.category_icon,
      value: tab === 'expense' ? c.expense_total : c.income_total,
      color: c.category_color,
    }))
    .filter((c) => c.value > 0)

  if (data.length === 0 && allCategories.length === 0) {
    return (
      <div
        className="rounded-xl p-5 flex items-center justify-center"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', height: '340px' }}
      >
        <span style={{ color: 'var(--text-muted)' }}>Sin datos</span>
      </div>
    )
  }

  const total = data.reduce((s, d) => s + d.value, 0)
  const tabIncome = summary?.total_income ?? 0
  const tabExpense = summary?.total_expenses ?? 0

  return (
    <div
      className="rounded-xl p-5 flex flex-col"
      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
    >
      {/* Header + toggle */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Por Categoría</h3>
        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <button
            onClick={() => setTab('expense')}
            className="px-3 py-1 text-xs font-medium transition-all"
            style={{
              background: tab === 'expense' ? 'var(--accent-red)' : 'var(--bg-tertiary)',
              color: tab === 'expense' ? '#fff' : 'var(--text-muted)',
            }}
          >
            ↓ Egresos {formatAmount(tabExpense)}
          </button>
          <button
            onClick={() => setTab('income')}
            className="px-3 py-1 text-xs font-medium transition-all"
            style={{
              background: tab === 'income' ? 'var(--accent-green)' : 'var(--bg-tertiary)',
              color: tab === 'income' ? '#fff' : 'var(--text-muted)',
            }}
          >
            ↑ Ingresos {formatAmount(tabIncome)}
          </button>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center flex-1" style={{ height: 200, color: 'var(--text-muted)', fontSize: 13 }}>
          Sin {tab === 'expense' ? 'egresos' : 'ingresos'} categorizados
        </div>
      ) : (
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Donut chart */}
          <div className="flex-shrink-0" style={{ width: 200, height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {data.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                  }}
                  formatter={(value: number, _name: string, props: { payload?: { name: string } }) => [
                    `${formatAmount(value)} (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`,
                    props.payload?.name ?? '',
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex-1 min-w-0 overflow-y-auto" style={{ maxHeight: 200 }}>
            <div className="flex flex-col gap-1">
              {data.map((entry, i) => {
                const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0'
                return (
                  <div key={i} className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="flex-shrink-0 rounded-full"
                      style={{ width: 8, height: 8, background: entry.color }}
                    />
                    <span
                      className="text-xs truncate flex-1"
                      style={{ color: 'var(--text-secondary)' }}
                      title={entry.name}
                    >
                      {entry.icon} {entry.shortName}
                    </span>
                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                      {pct}%
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
