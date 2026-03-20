import React from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { MovementsSummary } from '../../services/api'

interface CategoryChartProps {
  summary: MovementsSummary | null
}

function formatAmount(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

export function CategoryChart({ summary }: CategoryChartProps) {
  const data = (summary?.by_category ?? [])
    .filter((c) => c.total > 0)
    .map((c) => ({
      name: `${c.category_icon} ${c.category_name}`,
      value: c.total,
      color: c.category_color,
    }))

  if (data.length === 0) {
    return (
      <div
        className="rounded-xl p-5 flex items-center justify-center"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', height: '280px' }}
      >
        <span style={{ color: 'var(--text-muted)' }}>Sin datos</span>
      </div>
    )
  }

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
    >
      <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>Por Categoría</h3>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
            formatter={(value: number) => [formatAmount(value), '']}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
