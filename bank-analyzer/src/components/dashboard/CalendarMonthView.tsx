import { useState, useEffect, useCallback } from 'react'
import { fetchCalendarMonths, fetchMovements, fetchMonths, Movement, Category, MonthWithStats } from '../../services/api'
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
  bankName?: string | null
  extractoLabel?: string | null
  movements: Movement[]
  categories: Category[]
  onRefresh: () => void
}

function StatementSection({ statementType, bankName, extractoLabel, movements, categories, onRefresh }: StatementSectionProps) {
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
          {bankName && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize" style={{ background: 'var(--bg-primary)', color: 'var(--accent-primary)' }}>
              {bankName}
            </span>
          )}
          {extractoLabel && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(79,127,255,0.12)', color: 'var(--accent-primary)', border: '1px solid rgba(79,127,255,0.3)' }}>
              Extracto {extractoLabel}
            </span>
          )}
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
  const [allMonths, setAllMonths] = useState<MonthWithStats[]>([])
  const [loading, setLoading] = useState(false)

  // Load available calendar months and all statement months (for bank name lookup)
  useEffect(() => {
    fetchCalendarMonths().then((months) => {
      setCalMonths(months)
      if (months.length > 0) setSelected(months[0])
    }).catch(() => {})
    fetchMonths().then(setAllMonths).catch(() => {})
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

  // Build a lookup map from month_id to MonthWithStats (for bank name + statement type)
  const monthIdToStats = new Map(allMonths.map(m => [m.id, m]))

  // Group movements by month_id — each represents a distinct statement (bank account)
  const TYPE_ORDER = ['tarjeta_credito', 'cuenta_ahorro']
  const uniqueMonthIds = [...new Set(movements.map(m => m.month_id))]
  const orderedMonthIds = [...uniqueMonthIds].sort((a, b) => {
    const typeA = monthIdToStats.get(a)?.statement_type ?? movements.find(m => m.month_id === a)?.statement_type ?? ''
    const typeB = monthIdToStats.get(b)?.statement_type ?? movements.find(m => m.month_id === b)?.statement_type ?? ''
    const ia = TYPE_ORDER.includes(typeA) ? TYPE_ORDER.indexOf(typeA) : 99
    const ib = TYPE_ORDER.includes(typeB) ? TYPE_ORDER.indexOf(typeB) : 99
    return ia - ib
  })

  // Detect if multiple credit card statements contribute movements to the selected calendar month
  const creditMonthIds = uniqueMonthIds.filter(id => {
    const st = monthIdToStats.get(id)?.statement_type ?? movements.find(m => m.month_id === id)?.statement_type
    return st === 'tarjeta_credito'
  })
  const showMultiStatementBanner = creditMonthIds.length > 1

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
            {/* Month header — shows month name only; per-table totals are in each section */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {calendarMonthLabel(selected)}
              </h2>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {movements.length} movimientos
              </span>
            </div>

            {/* Multi-statement banner for credit cards */}
            {showMultiStatementBanner && (
              <div
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-4 text-sm"
                style={{ background: 'rgba(234,179,8,0.10)', border: '1px solid rgba(234,179,8,0.30)', color: '#ca8a04' }}
              >
                <span>⚠️</span>
                <span>
                  Tienes movimientos de {calendarMonthLabel(selected)} en{' '}
                  <strong>{creditMonthIds.length} extractos diferentes</strong>. Mostrando todos consolidados.
                </span>
              </div>
            )}

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
            ) : (
              // Render a separate section per statement (month_id = one bank account/card)
              orderedMonthIds.map((monthId) => {
                const stats = monthIdToStats.get(monthId)
                const movsForMonth = movements.filter(m => m.month_id === monthId)
                const statementType = stats?.statement_type ?? movsForMonth[0]?.statement_type ?? ''
                // Show extracto label only when multiple credit card statements are present
                const extractoLabel = showMultiStatementBanner && statementType === 'tarjeta_credito' && stats
                  ? MONTH_NAMES_ES[(stats.month - 1)] + ' ' + stats.year
                  : null
                return (
                  <StatementSection
                    key={monthId}
                    statementType={statementType}
                    bankName={stats?.bank_name}
                    extractoLabel={extractoLabel}
                    movements={movsForMonth}
                    categories={categories}
                    onRefresh={() => loadMovements(selected)}
                  />
                )
              })
            )}
          </>
        )}
      </div>
    </div>
  )
}
