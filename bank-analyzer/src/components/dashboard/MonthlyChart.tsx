import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { MonthWithStats } from '../../services/api'
import { useThemeColors } from '../../hooks/useThemeColors'
import { useLanguage } from '../../contexts/LanguageContext'

interface MonthlyChartProps {
  months: MonthWithStats[]
}

function formatK(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return String(Math.round(v))
}

export function MonthlyChart({ months }: MonthlyChartProps) {
  const colors = useThemeColors()
  const { t } = useLanguage()
  const MONTH_NAMES_SHORT = t('months.short').split('|')
  const incomeLabel = t('chart.income')
  const expensesLabel = t('chart.expenses')

  const grouped = months.reduce<Record<string, { year: number; month: number; income: number; expenses: number }>>(
    (acc, m) => {
      const key = `${m.year}-${String(m.month).padStart(2, '0')}`
      if (!acc[key]) {
        acc[key] = { year: m.year, month: m.month, income: 0, expenses: 0 }
      }
      acc[key].income += m.total_income
      acc[key].expenses += m.total_expenses
      return acc
    },
    {},
  )

  const data = Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([, v]) => ({
      name: `${MONTH_NAMES_SHORT[v.month - 1]} ${String(v.year).slice(2)}`,
      [incomeLabel]: v.income,
      [expensesLabel]: v.expenses,
    }))

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
    >
      <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>{t('chart.lastSixMonths')}</h3>
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-48" style={{ color: 'var(--text-muted)' }}>
          {t('chart.noData')}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
            <XAxis dataKey="name" tick={{ fill: colors.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: colors.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={formatK} />
            <Tooltip
              contentStyle={{ background: colors.bgTertiary, border: `1px solid ${colors.border}`, borderRadius: '8px', color: colors.textPrimary }}
              formatter={(value: number) => [`$${formatK(value)}`, '']}
            />
            <Bar dataKey={incomeLabel} fill={colors.accentGreen} radius={[4, 4, 0, 0]} />
            <Bar dataKey={expensesLabel} fill={colors.accentRed} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
