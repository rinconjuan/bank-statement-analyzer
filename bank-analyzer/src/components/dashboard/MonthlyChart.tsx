import React from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { MonthWithStats } from '../../services/api'

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

interface MonthlyChartProps {
  months: MonthWithStats[]
}

function formatK(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return String(Math.round(v))
}

export function MonthlyChart({ months }: MonthlyChartProps) {
  const last6 = [...months].reverse().slice(-6)
  const data = last6.map((m) => ({
    name: `${MONTH_NAMES[m.month - 1]} ${String(m.year).slice(2)}`,
    Ingresos: m.total_income,
    Egresos: m.total_expenses,
  }))

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
    >
      <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>Últimos 6 Meses</h3>
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-48" style={{ color: 'var(--text-muted)' }}>
          Sin datos históricos
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={formatK} />
            <Tooltip
              contentStyle={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
              formatter={(value: number) => [`$${formatK(value)}`, '']}
            />
            <Bar dataKey="Ingresos" fill="var(--accent-green)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Egresos" fill="var(--accent-red)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
