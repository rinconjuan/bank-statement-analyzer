import { useState, useEffect, useCallback } from 'react'
import { fetchCalendarMonths, fetchMovements, Movement, Category } from '../../services/api'
import { MovementRow } from '../movements/MovementRow'

const MONTH_NAMES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function calendarMonthLabel(ym: string): string {
  const [year, month] = ym.split('-')
  const m = parseInt(month) - 1
  return `${MONTH_NAMES_ES[m] ?? month} ${year}`
}

function formatAmount(n: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}

interface CalendarMonthViewProps {
  categories: Category[]
}

export function CalendarMonthView({ categories }: CalendarMonthViewProps) {
  const [calMonths, setCalMonths] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(false)

  // Load available calendar months
  useEffect(() => {
    fetchCalendarMonths().then((months) => {
      setCalMonths(months)
      if (months.length > 0) setSelected(months[0])
    }).catch(() => {})
  }, [])

  const loadMovements = useCallback(async (ym: string) => {
    setLoading(true)
    try {
      const movs = await fetchMovements({ calendar_month: ym })
      setMovements(movs)
    } catch {
      setMovements([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selected) loadMovements(selected)
  }, [selected, loadMovements])

  const totalIncome = movements.filter(m => m.type === 'Ingreso').reduce((s, m) => s + m.amount, 0)
  const totalExpense = movements.filter(m => m.type === 'Egreso').reduce((s, m) => s + m.amount, 0)

  if (calMonths.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="text-4xl">📅</div>
        <p style={{ color: 'var(--text-secondary)' }}>No hay movimientos cargados aún.</p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Carga un extracto para ver el historial por mes.</p>
      </div>
    )
  }

  return (
    <div className="flex gap-5 items-start max-w-7xl">
      {/* Month selector column */}
      <div
        className="rounded-xl flex-shrink-0 overflow-hidden"
        style={{ width: 200, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
      >
        <div className="px-4 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
          Meses calendario
        </div>
        <div className="flex flex-col overflow-y-auto" style={{ maxHeight: 480 }}>
          {calMonths.map((ym) => (
            <button
              key={ym}
              onClick={() => setSelected(ym)}
              className="text-left px-4 py-2.5 text-sm transition-all"
              style={{
                background: selected === ym ? 'rgba(79,127,255,0.15)' : 'transparent',
                color: selected === ym ? 'var(--accent-primary)' : 'var(--text-secondary)',
                borderLeft: selected === ym ? '2px solid var(--accent-primary)' : '2px solid transparent',
              }}
            >
              📅 {calendarMonthLabel(ym)}
            </button>
          ))}
        </div>
      </div>

      {/* Movements for selected month */}
      <div className="flex-1 min-w-0">
        {selected && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {calendarMonthLabel(selected)}
              </h2>
              <div className="flex items-center gap-4 text-sm">
                {totalIncome > 0 && (
                  <span style={{ color: 'var(--accent-green)' }}>↑ {formatAmount(totalIncome)}</span>
                )}
                {totalExpense > 0 && (
                  <span style={{ color: 'var(--accent-red)' }}>↓ {formatAmount(totalExpense)}</span>
                )}
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {movements.length} movimientos (de todos los extractos)
                </span>
              </div>
            </div>

            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              {loading ? (
                <div className="flex items-center justify-center py-12" style={{ color: 'var(--text-muted)' }}>
                  Cargando...
                </div>
              ) : movements.length === 0 ? (
                <div className="flex items-center justify-center py-12" style={{ color: 'var(--text-muted)' }}>
                  Sin movimientos para {calendarMonthLabel(selected)}
                </div>
              ) : (
                <div className="overflow-auto max-h-[600px]">
                  <table className="w-full text-left">
                    <thead>
                      <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)' }}>
                        <th className="px-4 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Fecha</th>
                        <th className="px-4 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Descripción</th>
                        <th className="px-4 py-2.5 text-xs font-medium text-right" style={{ color: 'var(--text-muted)' }}>Monto</th>
                        <th className="px-4 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Tipo</th>
                        <th className="px-4 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Categoría</th>
                        <th className="px-4 py-2.5 text-xs font-medium text-center" style={{ color: 'var(--text-muted)' }}>Aplica</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((m) => (
                        <MovementRow
                          key={m.id}
                          movement={m}
                          categories={categories}
                          onUpdated={() => loadMovements(selected)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
