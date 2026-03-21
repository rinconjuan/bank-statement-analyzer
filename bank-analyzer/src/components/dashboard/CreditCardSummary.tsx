import { useEffect, useState } from 'react'
import { fetchCreditSummary, CreditSummary, MonthWithStats } from '../../services/api'

function formatAmount(n: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  // dateStr is DD/MM/YYYY
  const parts = dateStr.split('/')
  if (parts.length !== 3) return null
  const day = Number(parts[0])
  const month = Number(parts[1])
  const year = Number(parts[2])
  if (!day || !month || !year || month < 1 || month > 12 || day < 1 || day > 31) return null
  const d = new Date(year, month - 1, day)
  if (isNaN(d.getTime())) return null
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

interface Props {
  month: MonthWithStats
}

export function CreditCardSummary({ month }: Props) {
  const [summary, setSummary] = useState<CreditSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchCreditSummary(month.id)
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoading(false))
  }, [month.id])

  if (loading) {
    return (
      <div className="rounded-xl p-6 text-sm" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
        Cargando resumen tarjeta...
      </div>
    )
  }

  if (!summary) return null

  const diasLimite = daysUntil(summary.fecha_limite)
  const urgente = diasLimite !== null && diasLimite <= 7

  const cupoUsado = summary.cupo_total > 0 ? summary.cupo_total - summary.cupo_disponible : 0
  const cupoUsadoPct = summary.cupo_total > 0 ? Math.round((cupoUsado / summary.cupo_total) * 100) : 0

  return (
    <div className="space-y-4">
      {/* ── Row 1: 3 summary cards ── */}
      <div className="grid grid-cols-3 gap-4">
        {/* Card 1: Pagaste */}
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Pagaste</span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--accent-green)' }}>
              ✓
            </div>
          </div>
          {summary.pago_realizado ? (
            <>
              <div className="font-display text-2xl tracking-tight" style={{ color: 'var(--accent-green)' }}>
                {formatAmount(summary.pago_realizado.amount)}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                el {summary.pago_realizado.date}
              </div>
            </>
          ) : (
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Sin pago registrado</div>
          )}
        </div>

        {/* Card 2: Debes pagar */}
        <div
          className="rounded-xl p-5"
          style={{
            background: 'var(--bg-secondary)',
            border: `1px solid ${urgente ? 'var(--accent-red)' : 'var(--border)'}`,
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm truncate pr-2" style={{ color: 'var(--text-secondary)' }}>
              {summary.fecha_limite ? `Pagar antes del ${summary.fecha_limite}` : 'Pago total'}
            </span>
            {urgente && (
              <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--accent-red)' }}>
                {diasLimite === 0 ? '¡Hoy!' : `${diasLimite}d`}
              </span>
            )}
          </div>
          <div className="font-display text-2xl tracking-tight" style={{ color: 'var(--accent-red)' }}>
            {formatAmount(summary.pago_total)}
          </div>
          {summary.pago_minimo > 0 && (
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Mínimo: {formatAmount(summary.pago_minimo)}
            </div>
          )}
        </div>

        {/* Card 3: Cupo disponible */}
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Cupo disponible</span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: 'rgba(79,127,255,0.12)', color: 'var(--accent-primary)' }}>
              💳
            </div>
          </div>
          <div className="font-display text-2xl tracking-tight" style={{ color: 'var(--accent-primary)' }}>
            {formatAmount(summary.cupo_disponible)}
          </div>
          {summary.cupo_total > 0 && (
            <>
              <div className="mt-2 rounded-full overflow-hidden" style={{ height: 4, background: 'var(--bg-tertiary)' }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${cupoUsadoPct}%`, background: cupoUsadoPct > 80 ? 'var(--accent-red)' : 'var(--accent-primary)' }}
                />
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {cupoUsadoPct}% usado · total {formatAmount(summary.cupo_total)}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Row 2: Consumos por mes ── */}
      {summary.consumos_por_mes.length > 0 && (
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <div className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Consumos por mes
          </div>
          <div className="flex flex-col gap-2">
            {summary.consumos_por_mes.map((row) => (
              <div key={row.mes} className="flex items-center gap-3">
                <span className="text-sm w-32 flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>{row.mes}</span>
                <span className="text-sm font-mono flex-1" style={{ color: 'var(--text-primary)' }}>{formatAmount(row.total_consumos)}</span>
                <span className="text-xs font-mono w-36 text-right" style={{ color: row.aplica_extracto ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                  cuota: {formatAmount(row.total_cuota)}
                </span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{
                    background: row.aplica_extracto ? 'rgba(34,197,94,0.12)' : 'rgba(148,163,184,0.12)',
                    color: row.aplica_extracto ? 'var(--accent-green)' : 'var(--text-muted)',
                  }}
                >
                  {row.aplica_extracto ? '🟢 Este extracto' : '🔵 Diferido'}
                </span>
              </div>
            ))}
          </div>
          {/* Totals footer */}
          <div className="mt-4 pt-3 flex flex-col gap-1" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Total consumos reales este mes</span>
              <span className="text-sm font-semibold" style={{ color: 'var(--accent-green)' }}>{formatAmount(summary.total_consumos_nuevos)}</span>
            </div>
            {summary.total_diferidos > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Diferidos de meses anteriores</span>
                <span className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>{formatAmount(summary.total_diferidos)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
