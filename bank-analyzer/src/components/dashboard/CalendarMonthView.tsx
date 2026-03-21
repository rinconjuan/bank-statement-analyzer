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

const STATEMENT_TYPE_META: Record<string, { label: string; icon: string; accentColor: string }> = {
  tarjeta_credito: { label: 'Tarjeta de Crédito', icon: '💳', accentColor: 'var(--accent-primary)' },
  cuenta_ahorro:   { label: 'Cuenta de Ahorros',  icon: '🏦', accentColor: '#22c55e' },
}

function statementMeta(type: string) {
  return STATEMENT_TYPE_META[type] ?? { label: type, icon: '📄', accentColor: 'var(--text-secondary)' }
}

interface StatementSectionProps {
  statementType: string
  movements: Movement[]
  categories: Category[]
  onRefresh: () => void
}

function StatementSection({ statementType, movements, categories, onRefresh }: StatementSectionProps) {
  const meta = statementMeta(statementType)
  const income = movements.filter(m => m.type === 'Ingreso').reduce((s, m) => s + m.amount, 0)
  const expense = movements.filter(m => m.type === 'Egreso').reduce((s, m) => s + m.amount, 0)

  return (
    <div className="mb-6">
      {/* Section header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 rounded-t-xl"
        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderBottom: 'none' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">{meta.icon}</span>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{meta.label}</span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
            {movements.length} mov.
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {income > 0 && (
            <span style={{ color: 'var(--accent-green)' }}>↑ {formatAmount(income)}</span>
          )}
          {expense > 0 && (
            <span style={{ color: 'var(--accent-red)' }}>↓ {formatAmount(expense)}</span>
          )}
        </div>
      </div>

      {/* Movements table */}
      <div className="rounded-b-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <div className="overflow-auto max-h-[480px]">
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
                  onUpdated={onRefresh}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
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

  // Group movements by statement type, preserving a consistent order
  const TYPE_ORDER = ['tarjeta_credito', 'cuenta_ahorro']
  const groupedTypes = TYPE_ORDER.filter(t => movements.some(m => m.statement_type === t))
  // Include any other types not in the static order list
  const otherTypes = [...new Set(movements.map(m => m.statement_type))].filter(t => !TYPE_ORDER.includes(t))
  const orderedTypes = [...groupedTypes, ...otherTypes]

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
            {/* Overall month header */}
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
                  {movements.length} movimientos
                  {orderedTypes.length > 1 && ` · ${orderedTypes.length} tipos de extracto`}
                </span>
              </div>
            </div>

            {loading ? (
              <div
                className="rounded-xl flex items-center justify-center py-12"
                style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}
              >
                Cargando...
              </div>
            ) : movements.length === 0 ? (
              <div
                className="rounded-xl flex items-center justify-center py-12"
                style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}
              >
                Sin movimientos para {calendarMonthLabel(selected)}
              </div>
            ) : orderedTypes.length === 1 ? (
              // Single statement type: render table directly without section header
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
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
              </div>
            ) : (
              // Multiple statement types: render a separate section per type
              orderedTypes.map((type) => (
                <StatementSection
                  key={type}
                  statementType={type}
                  movements={movements.filter(m => m.statement_type === type)}
                  categories={categories}
                  onRefresh={() => loadMovements(selected)}
                />
              ))
            )}
          </>
        )}
      </div>
    </div>
  )
}
