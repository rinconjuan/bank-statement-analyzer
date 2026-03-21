import { useState, useEffect, useCallback } from 'react'
import {
  fetchCalendarMonths, fetchMovements, fetchMonths, fetchMonthlySummary,
  Movement, Category, MonthWithStats, MonthlySummary,
} from '../../services/api'
import { MovementRow } from '../movements/MovementRow'

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function calendarMonthLabel(ym: string): string {
  const [year, month] = ym.split('-')
  return `${MONTH_NAMES_ES[parseInt(month) - 1] ?? month} ${year}`
}

function fmt(n: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}

function fmtDateShort(d: string | null | undefined): string {
  if (!d) return '—'
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const parts = d.split('/')
  if (parts.length !== 3) return d
  const day = parseInt(parts[0], 10)
  const mon = parseInt(parts[1], 10)
  if (!day || !mon || mon < 1 || mon > 12) return d
  return `${day} ${MONTHS[mon - 1]}`
}

const SALARY_DESC_MAX_LEN = 40

const STATEMENT_TYPE_META: Record<string, { label: string; icon: string }> = {
  tarjeta_credito: { label: 'Tarjeta de Crédito', icon: '💳' },
  cuenta_ahorro:   { label: 'Cuenta de Ahorros',  icon: '🏦' },
}

function statementMeta(type: string) {
  return STATEMENT_TYPE_META[type] ?? { label: type, icon: '📄' }
}

// Keywords identifying internal bolsillo movements (must match backend list)
const BOLSILLO_KEYWORDS = [
  'bolsillo',
  'transferencia de dinero a bolsillo',
  'debito automatico al bolsillo',
  'débito automático al bolsillo',
  'abono automatico a bolsillo',
  'abono automático a bolsillo',
  'traslado rendimientos a bolsillo',
  'traslado rendimientos',
  'transferencia desde cuenta a bolsillo',
  'transferencia de bolsillo a cuenta',
  'abono de bolsillo a cuenta',
  'abono rendimientos netos desde cuenta',
  'rendimientos financieros',
]

function isInternalMovement(description: string): boolean {
  const lower = description.toLowerCase()
  return BOLSILLO_KEYWORDS.some(kw => lower.includes(kw))
}

// ── Month status badge ────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  CERRADO:  { label: 'Cerrado',  bg: 'rgba(34,197,94,0.15)',  color: '#16a34a', dot: '✅' },
  ACTIVO:   { label: 'Activo',   bg: 'rgba(234,179,8,0.15)',  color: '#ca8a04', dot: '🔄' },
  PARCIAL:  { label: 'Parcial',  bg: 'rgba(148,163,184,0.15)', color: '#64748b', dot: '⏳' },
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META['PARCIAL']
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: meta.bg, color: meta.color }}
    >
      {meta.dot} {meta.label}
    </span>
  )
}

// ── Balance card ─────────────────────────────────────────────────────────────

interface BalanceCardProps {
  summary: MonthlySummary
}

function BalanceCard({ summary }: BalanceCardProps) {
  const {
    salary, other_income, total_income, credit_card, savings_account, balance,
    has_savings, has_credit, patrimonio_davivienda, patrimonio_neto,
    month_status, expense_breakdown,
    next_payment_confirmed, next_payment_confirmation_date,
    next_payment_confirmation_amount, ahorro_real,
  } = summary

  if (!has_savings && !has_credit) return null

  const hasPatrimonio = savings_account != null && (savings_account.nuevo_saldo > 0 || savings_account.saldo_bolsillo > 0)
  const deudaFalabella = patrimonio_davivienda - patrimonio_neto

  return (
    <div className="rounded-xl p-5 mb-6" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>

      {/* ── Header: Balance del mes + status badge ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-base">📊</span>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Balance del mes</span>
        </div>
        <StatusBadge status={month_status} />
      </div>

      {/* ════ QUÉ ENTRÓ ════ */}
      {has_savings && (
        <>
          <div className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>
            QUÉ ENTRÓ
          </div>

          {salary && (
            <div className="flex items-start justify-between py-1.5">
              <div>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  💰 Salario
                </span>
                <div className="text-xs mt-0.5 pl-5" style={{ color: 'var(--text-muted)' }}>
                  {salary.description.substring(0, SALARY_DESC_MAX_LEN).trim()}, {fmtDateShort(salary.date)}
                </div>
              </div>
              <span className="text-sm font-mono font-semibold ml-4 flex-shrink-0" style={{ color: 'var(--accent-green)' }}>
                + {fmt(salary.amount)}
              </span>
            </div>
          )}

          {other_income > 0 && (
            <div className="flex items-center justify-between py-1">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Otros ingresos</span>
              <span className="text-sm font-mono font-semibold" style={{ color: 'var(--accent-green)' }}>
                + {fmt(other_income)}
              </span>
            </div>
          )}

          {/* Total ingresos */}
          <div
            className="flex items-center justify-between py-1 mt-1"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Total ingresos</span>
            <span className="text-xs font-mono font-semibold" style={{ color: 'var(--accent-green)' }}>
              + {fmt(total_income)}
            </span>
          </div>
        </>
      )}

      {/* ════ QUÉ SALIÓ ════ */}
      {has_savings && expense_breakdown.length > 0 && (
        <>
          <div className="text-xs font-semibold uppercase tracking-widest mt-4 mb-1.5" style={{ color: 'var(--text-muted)' }}>
            QUÉ SALIÓ
          </div>

          {expense_breakdown.map((item, i) => (
            <div key={i} className="flex items-start justify-between py-1.5">
              <div>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {item.icon} {item.label}
                  {item.count > 1 && (
                    <span className="ml-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      ({item.count} pagos)
                    </span>
                  )}
                </span>
                {item.tooltip && (
                  <div className="text-xs mt-0.5 pl-5 italic" style={{ color: 'var(--text-muted)' }}>
                    {item.tooltip}
                  </div>
                )}
              </div>
              <span className="text-sm font-mono font-semibold ml-4 flex-shrink-0" style={{ color: 'var(--accent-red)' }}>
                - {fmt(item.amount)}
              </span>
            </div>
          ))}

          {/* Total salidas */}
          {balance && (
            <div
              className="flex items-center justify-between py-1 mt-1"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Total salidas</span>
              <span className="text-xs font-mono font-semibold" style={{ color: 'var(--accent-red)' }}>
                - {fmt(balance.card_payment + balance.other_expenses)}
              </span>
            </div>
          )}
        </>
      )}

      {/* ════ RESULTADO ════ */}
      {balance && (
        <>
          <div className="my-3" style={{ borderTop: '1px solid var(--border)' }} />
          <div className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>
            RESULTADO
          </div>

          <div className="flex items-center justify-between py-1">
            <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Diferencia del mes</span>
            <span
              className="text-sm font-mono font-bold"
              style={{ color: balance.difference >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}
            >
              {(balance.difference >= 0 ? '+' : '') + fmt(balance.difference)}
            </span>
          </div>

          {/* Next Falabella payment (ACTIVO/PARCIAL with credit) */}
          {has_credit && credit_card && credit_card.next_payment_total > 0 && !next_payment_confirmed && (
            <>
              <div className="mt-3 pt-3" style={{ borderTop: '1px dashed var(--border)' }}>
                <div className="flex items-start justify-between py-1">
                  <div>
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      ⏳ Próximo pago Falabella
                    </span>
                    {credit_card.next_payment_date && (
                      <div className="text-xs mt-0.5 pl-5" style={{ color: 'var(--text-muted)' }}>
                        antes del {credit_card.next_payment_date}
                      </div>
                    )}
                    <div className="text-xs mt-0.5 pl-5 italic" style={{ color: 'var(--text-muted)' }}>
                      Todavía no reflejado en cuenta
                    </div>
                  </div>
                  <span className="text-sm font-mono font-semibold ml-4 flex-shrink-0" style={{ color: 'var(--accent-red)' }}>
                    - {fmt(credit_card.next_payment_total)}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Confirmed payment (CERRADO) */}
          {next_payment_confirmed && next_payment_confirmation_amount > 0 && (
            <>
              <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between py-1">
                  <div>
                    <span className="text-sm" style={{ color: 'var(--accent-green)' }}>
                      ✅ Pago Falabella confirmado
                    </span>
                    {next_payment_confirmation_date && (
                      <div className="text-xs mt-0.5 pl-5" style={{ color: 'var(--text-muted)' }}>
                        el {fmtDateShort(next_payment_confirmation_date)}
                      </div>
                    )}
                  </div>
                  <span className="text-sm font-mono font-semibold ml-4 flex-shrink-0" style={{ color: 'var(--accent-red)' }}>
                    - {fmt(next_payment_confirmation_amount)}
                  </span>
                </div>
                {ahorro_real != null && (
                  <div
                    className="flex items-center justify-between py-1 mt-1"
                    style={{ borderTop: '1px solid var(--border)' }}
                  >
                    <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Ahorro real del mes</span>
                    <span
                      className="text-sm font-mono font-bold"
                      style={{ color: ahorro_real >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}
                    >
                      {(ahorro_real >= 0 ? '+' : '') + fmt(ahorro_real)}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Partial data notice */}
      {(!has_savings || !has_credit) && (
        <div className="text-xs mt-3 pt-3" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          {!has_savings
            ? 'ℹ️ Sin extracto Davivienda para este mes. Carga el PDF para ver el resumen completo.'
            : 'ℹ️ Sin extracto Falabella para este mes. Carga el PDF para ver el resumen completo.'}
        </div>
      )}

      {/* Patrimonio section — only shown when saldo data is available */}
      {hasPatrimonio && savings_account && (
        <>
          <div className="mt-4 pt-4" style={{ borderTop: '2px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">🏛️</span>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Patrimonio</span>
            </div>

            {/* Davivienda — total then breakdown */}
            <div className="flex items-center justify-between py-0.5">
              <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>🏦 Davivienda</span>
              <span className="text-xs font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {fmt(savings_account.nuevo_saldo)}
              </span>
            </div>
            {savings_account.saldo_bolsillo > 0 && (
              <>
                <div className="flex items-center justify-between py-0.5 pl-4">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>💰 En bolsillo (ahorro)</span>
                  <span className="text-xs font-mono" style={{ color: 'var(--accent-green)' }}>
                    {fmt(savings_account.saldo_bolsillo)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-0.5 pl-4">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>💵 Disponible en cuenta</span>
                  <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                    {fmt(Math.max(0, savings_account.nuevo_saldo - savings_account.saldo_bolsillo))}
                  </span>
                </div>
              </>
            )}
            {savings_account.ahorro_mes > 0 && (
              <div className="flex items-center justify-between py-0.5 pl-4">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>📈 Ahorrado este mes</span>
                <span className="text-xs font-mono" style={{ color: 'var(--accent-green)' }}>
                  +{fmt(savings_account.ahorro_mes)}
                </span>
              </div>
            )}

            {/* Falabella debt */}
            {deudaFalabella > 0 && (
              <div className="flex items-center justify-between py-0.5 mt-1">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>💳 Deuda Falabella</span>
                <span className="text-xs font-mono" style={{ color: 'var(--accent-red)' }}>
                  -{fmt(deudaFalabella)}
                </span>
              </div>
            )}

            {/* Patrimonio neto */}
            <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
              <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Patrimonio neto</span>
              <span
                className="text-sm font-mono font-bold"
                style={{ color: patrimonio_neto >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}
              >
                {(patrimonio_neto >= 0 ? '+' : '') + fmt(patrimonio_neto)}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Movements section per statement ──────────────────────────────────────────

interface StatementSectionProps {
  statementType: string
  bankName?: string | null
  extractoLabel?: string | null
  movements: Movement[]
  categories: Category[]
  onRefresh: () => void
}

function StatementSection({
  statementType, bankName, extractoLabel, movements, categories, onRefresh,
}: StatementSectionProps) {
  const meta = statementMeta(statementType)
  // Exclude internal bolsillo movements from header totals
  const realMovements = movements.filter(m => !isInternalMovement(m.description))
  const income = realMovements.filter(m => m.type === 'Ingreso').reduce((s, m) => s + m.amount, 0)
  const expense = realMovements.filter(m => m.type === 'Egreso').reduce((s, m) => s + m.amount, 0)
  const isCreditCard = statementType === 'tarjeta_credito'

  return (
    <div className="mb-6">
      <div
        className="flex items-center justify-between px-4 py-2.5 rounded-t-xl"
        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderBottom: 'none' }}
      >
        <div className="flex items-center gap-2 flex-wrap">
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
        <div className="flex items-center gap-4 text-sm flex-shrink-0">
          {income > 0 && <span style={{ color: 'var(--accent-green)' }}>↑ {fmt(income)}</span>}
          {expense > 0 && <span style={{ color: 'var(--accent-red)' }}>↓ {fmt(expense)}</span>}
        </div>
      </div>

      <div className="rounded-b-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <div className="overflow-auto max-h-[480px]">
          <table className="w-full text-left">
            <thead>
              <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)' }}>
                <th className="px-4 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Fecha</th>
                <th className="px-4 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Descripción</th>
                <th className="px-4 py-2.5 text-xs font-medium text-right" style={{ color: 'var(--text-muted)' }}>Monto</th>
                <th className="px-4 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Tipo</th>
                {isCreditCard && (
                  <th className="px-4 py-2.5 text-xs font-medium text-right" style={{ color: 'var(--text-muted)' }}>Cuota este mes</th>
                )}
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
                  showCuota={isCreditCard}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface MesAMesProps {
  categories: Category[]
}

export function MesAMes({ categories }: MesAMesProps) {
  const [calMonths, setCalMonths] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [movements, setMovements] = useState<Movement[]>([])
  const [allMonths, setAllMonths] = useState<MonthWithStats[]>([])
  const [summary, setSummary] = useState<MonthlySummary | null>(null)
  const [loadingMovements, setLoadingMovements] = useState(false)
  const [loadingSummary, setLoadingSummary] = useState(false)
  // Cache of month statuses per calendar month key (e.g. '2026-02')
  const [monthStatuses, setMonthStatuses] = useState<Record<string, string>>({})

  // Load available calendar months and all statement months (for bank name lookup)
  useEffect(() => {
    fetchCalendarMonths().then((months) => {
      setCalMonths(months)
      if (months.length > 0) setSelected(months[0])
      // Pre-fetch summaries to populate status badges in sidebar
      months.forEach((ym) => {
        const [yearStr, monthStr] = ym.split('-')
        fetchMonthlySummary(parseInt(yearStr, 10), parseInt(monthStr, 10))
          .then((s) => setMonthStatuses(prev => ({ ...prev, [ym]: s.month_status })))
          .catch(() => {})
      })
    }).catch(() => {})
    fetchMonths().then(setAllMonths).catch(() => {})
  }, [])

  const loadData = useCallback(async (ym: string) => {
    const [yearStr, monthStr] = ym.split('-')
    const year = parseInt(yearStr, 10)
    const month = parseInt(monthStr, 10)

    setLoadingMovements(true)
    setLoadingSummary(true)

    fetchMovements({ calendar_month: ym })
      .then(setMovements)
      .catch(() => setMovements([]))
      .finally(() => setLoadingMovements(false))

    fetchMonthlySummary(year, month)
      .then((s) => {
        setSummary(s)
        setMonthStatuses(prev => ({ ...prev, [ym]: s.month_status }))
      })
      .catch(() => setSummary(null))
      .finally(() => setLoadingSummary(false))
  }, [])

  useEffect(() => {
    if (selected) loadData(selected)
  }, [selected, loadData])

  // Build lookup map: month_id → MonthWithStats (for bank name + statement type)
  const monthIdToStats = new Map(allMonths.map(m => [m.id, m]))

  // Group and order: tarjeta_credito first, then cuenta_ahorro
  const TYPE_ORDER = ['tarjeta_credito', 'cuenta_ahorro']
  const uniqueMonthIds = [...new Set(movements.map(m => m.month_id))]
  const orderedMonthIds = [...uniqueMonthIds].sort((a, b) => {
    const typeA = monthIdToStats.get(a)?.statement_type ?? movements.find(m => m.month_id === a)?.statement_type ?? ''
    const typeB = monthIdToStats.get(b)?.statement_type ?? movements.find(m => m.month_id === b)?.statement_type ?? ''
    const ia = TYPE_ORDER.includes(typeA) ? TYPE_ORDER.indexOf(typeA) : 99
    const ib = TYPE_ORDER.includes(typeB) ? TYPE_ORDER.indexOf(typeB) : 99
    return ia - ib
  })

  const creditMonthIds = uniqueMonthIds.filter(id => {
    const st = monthIdToStats.get(id)?.statement_type ?? movements.find(m => m.month_id === id)?.statement_type
    return st === 'tarjeta_credito'
  })
  const showMultiStatementBanner = creditMonthIds.length > 1

  if (calMonths.length === 0 && !loadingMovements && !loadingSummary) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="text-4xl">📅</div>
        <p style={{ color: 'var(--text-secondary)' }}>No hay movimientos cargados aún.</p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Carga un extracto para ver el historial mes a mes.</p>
      </div>
    )
  }

  return (
    <div className="flex gap-5 items-start max-w-7xl">
      {/* ── Month selector sidebar ── */}
      <div
        className="rounded-xl flex-shrink-0 overflow-hidden"
        style={{ width: 220, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
      >
        <div
          className="px-4 py-3 text-xs font-semibold uppercase tracking-widest"
          style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}
        >
          Meses calendario
        </div>
        <div className="flex flex-col overflow-y-auto" style={{ maxHeight: 480 }}>
          {calMonths.map((ym) => {
            const status = monthStatuses[ym]
            const statusDot = status ? (STATUS_META[status]?.dot ?? null) : null
            return (
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
                <div className="flex items-center justify-between gap-1">
                  <span>📅 {calendarMonthLabel(ym)}</span>
                  {statusDot && (
                    <span className="text-xs flex-shrink-0" title={status}>{statusDot}</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Right content ── */}
      <div className="flex-1 min-w-0">
        {selected && (
          <>
            {/* Month title */}
            <h2 className="text-xl font-bold uppercase tracking-wide mb-5" style={{ color: 'var(--text-primary)' }}>
              {calendarMonthLabel(selected)}
            </h2>

            {/* ── BALANCE section ── */}
            {loadingSummary ? (
              <div
                className="rounded-xl flex items-center justify-center py-8 mb-6"
                style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}
              >
                Cargando balance…
              </div>
            ) : summary ? (
              <BalanceCard summary={summary} />
            ) : null}

            {/* ── MOVIMIENTOS section ── */}
            {loadingMovements ? (
              <div
                className="rounded-xl flex items-center justify-center py-12"
                style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}
              >
                Cargando movimientos…
              </div>
            ) : movements.length === 0 && !loadingSummary && summary === null ? (
              <div
                className="rounded-xl flex items-center justify-center py-12"
                style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}
              >
                No hay extractos para {calendarMonthLabel(selected)}
              </div>
            ) : movements.length === 0 && !loadingMovements ? (
              <div
                className="rounded-xl flex items-center justify-center py-8"
                style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}
              >
                Sin movimientos para {calendarMonthLabel(selected)}
              </div>
            ) : (
              <>
                <div
                  className="flex items-center justify-between mb-4"
                  style={{ paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}
                >
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    Movimientos del mes
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {movements.length} movimientos
                  </span>
                </div>

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

                {orderedMonthIds.map((monthId) => {
                  const stats = monthIdToStats.get(monthId)
                  const movsForMonth = movements.filter(m => m.month_id === monthId)
                  const statementType = stats?.statement_type ?? movsForMonth[0]?.statement_type ?? ''
                  const extractoLabel = showMultiStatementBanner && statementType === 'tarjeta_credito' && stats
                    ? MONTH_NAMES_ES[stats.month - 1] + ' ' + stats.year
                    : null
                  return (
                    <StatementSection
                      key={monthId}
                      statementType={statementType}
                      bankName={stats?.bank_name}
                      extractoLabel={extractoLabel}
                      movements={movsForMonth}
                      categories={categories}
                      onRefresh={() => loadData(selected)}
                    />
                  )
                })}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
