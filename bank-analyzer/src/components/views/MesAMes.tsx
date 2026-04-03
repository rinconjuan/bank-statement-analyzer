import { useState, useEffect, useCallback } from 'react'
import {
  fetchCalendarMonths, fetchMovements, fetchMonths, fetchMonthlySummary,
  Movement, Category, MonthWithStats, MonthlySummary,
} from '../../services/api'
import { MovementsTable } from '../movements/MovementsTable'
import { HelpModal } from '../help/HelpModal'
import { useLanguage } from '../../contexts/LanguageContext'
import { useBalanceStyle } from '../../contexts/BalanceStyleContext'

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function calendarMonthLabel(ym: string, monthNames: string[]): string {
  const [year, month] = ym.split('-')
  return `${monthNames[parseInt(month) - 1] ?? month} ${year}`
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

const STATEMENT_TYPE_META: Record<string, { labelKey: string; icon: string }> = {
  tarjeta_credito: { labelKey: 'mesAMes.stmtTypeCredit', icon: '💳' },
  cuenta_ahorro:   { labelKey: 'mesAMes.stmtTypeSavings', icon: '🏦' },
}

function statementMeta(type: string, t: (k: string) => string) {
  const meta = STATEMENT_TYPE_META[type]
  if (!meta) return { label: type, icon: '📄' }
  return { label: t(meta.labelKey), icon: meta.icon }
}

// Keywords identifying internal bolsillo/pocket movements — mirrors backend _INTERNAL_MOVEMENT_KEYWORDS.
// 'rendimientos financieros' is intentionally NOT listed: those are real income.
const BOLSILLO_KEYWORDS = [
  'bolsillo',               // catches every variant (débito/abono/transferencia al bolsillo, etc.)
  'traslado rendimientos',
  'abono rendimientos netos',
]

function isInternalMovement(description: string): boolean {
  const lower = description.toLowerCase()
  return BOLSILLO_KEYWORDS.some(kw => lower.includes(kw))
}

// ── Month status badge ────────────────────────────────────────────────────────

const STATUS_META: Record<string, { bg: string; color: string; dot: string; key: string }> = {
  CERRADO:  { bg: 'rgba(34,197,94,0.15)',   color: '#16a34a', dot: '✅', key: 'mesAMes.statusClosed'  },
  ACTIVO:   { bg: 'rgba(234,179,8,0.15)',   color: '#ca8a04', dot: '🔄', key: 'mesAMes.statusActive'  },
  PARCIAL:  { bg: 'rgba(148,163,184,0.15)', color: '#64748b', dot: '⏳', key: 'mesAMes.statusPartial' },
}

const STATUS_COLOR: Record<string, string> = {
  CERRADO: '#16a34a',
  ACTIVO:  '#ca8a04',
  PARCIAL: '#64748b',
}
const STATUS_LABEL: Record<string, string> = {
  CERRADO: 'Cerrado',
  ACTIVO:  'Activo',
  PARCIAL: 'Parcial',
}
const STATUS_BG: Record<string, string> = {
  CERRADO: 'rgba(22,163,74,0.12)',
  ACTIVO:  'rgba(202,138,4,0.12)',
  PARCIAL: 'rgba(100,116,139,0.10)',
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useLanguage()
  const meta = STATUS_META[status] ?? STATUS_META['PARCIAL']
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: meta.bg, color: meta.color }}
    >
      {meta.dot} {t(meta.key)}
    </span>
  )
}

// ── Semaphore indicators ─────────────────────────────────────────────────────

interface SemaphoreChip {
  label: string
  icon: string
  color: string
  bg: string
}

function SemaphorePanel({ summary }: { summary: MonthlySummary }) {
  const { t } = useLanguage()
  const chips: SemaphoreChip[] = []

  const { balance, total_income, cc_payment_from_savings, savings_account,
    prev_total_expenses, prev_nuevo_saldo, has_savings } = summary

  // 1. Spending vs income this month
  if (balance && total_income > 0) {
    const totalOut = balance.card_payment + balance.other_expenses
    if (totalOut > total_income) {
      chips.push({ icon: '🔴', label: t('semaphore.spentMore'), color: '#dc2626', bg: 'rgba(220,38,38,0.1)' })
    } else {
      const pct = Math.round(((total_income - totalOut) / total_income) * 100)
      chips.push({ icon: '🟢', label: t('semaphore.saving', { pct: String(pct) }), color: '#16a34a', bg: 'rgba(22,163,74,0.1)' })
    }
  }

  // 2. Spending vs previous month
  if (prev_total_expenses != null && balance) {
    const totalOut = balance.card_payment + balance.other_expenses
    if (prev_total_expenses > 0) {
      const changePct = Math.round(((totalOut - prev_total_expenses) / prev_total_expenses) * 100)
      if (changePct > 10) {
        chips.push({ icon: '🟡', label: t('semaphore.spentUp', { pct: String(changePct) }), color: '#d97706', bg: 'rgba(217,119,6,0.1)' })
      } else if (changePct < -5) {
        chips.push({ icon: '🟢', label: t('semaphore.spentDown', { pct: String(changePct) }), color: '#16a34a', bg: 'rgba(22,163,74,0.1)' })
      } else {
        chips.push({ icon: '⚪', label: t('semaphore.spentStable'), color: 'var(--text-muted)', bg: 'rgba(100,116,139,0.1)' })
      }
    }
  }

  // 3. Savings balance improved
  if (has_savings && savings_account && savings_account.nuevo_saldo > 0) {
    if (prev_nuevo_saldo != null && prev_nuevo_saldo > 0) {
      if (savings_account.nuevo_saldo > prev_nuevo_saldo) {
        chips.push({ icon: '🟢', label: t('semaphore.balanceUp'), color: '#16a34a', bg: 'rgba(22,163,74,0.1)' })
      } else {
        chips.push({ icon: '🔴', label: t('semaphore.balanceDown'), color: '#dc2626', bg: 'rgba(220,38,38,0.1)' })
      }
    } else if (savings_account.nuevo_saldo < savings_account.saldo_anterior) {
      chips.push({ icon: '🔴', label: t('semaphore.balanceLow'), color: '#dc2626', bg: 'rgba(220,38,38,0.1)' })
    }
  }

  // 4. CC payment as % of income
  if (cc_payment_from_savings > 0 && total_income > 0) {
    const pct = Math.round((cc_payment_from_savings / total_income) * 100)
    if (pct > 50) {
      chips.push({ icon: '🟡', label: t('semaphore.ccHighPct', { pct: String(pct) }), color: '#d97706', bg: 'rgba(217,119,6,0.1)' })
    }
  }

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {chips.map((chip, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
          style={{ background: chip.bg, color: chip.color, border: `1px solid ${chip.color}33` }}
        >
          {chip.icon} {chip.label}
        </span>
      ))}
    </div>
  )
}

// ── CC↔Savings cross-check panel ─────────────────────────────────────────────

function CCCrossCheck({ summary }: { summary: MonthlySummary }) {
  const { t } = useLanguage()
  const { cc_payment_from_savings, cc_payment_cross_confirmed, cc_payment_cross_diff,
    credit_card, has_savings, has_credit, credit_bank_name, savings_bank_name } = summary

  if (!has_savings || !has_credit || !credit_card || cc_payment_from_savings <= 0) return null

  const savingsSide = cc_payment_from_savings
  const creditSide = credit_card.payment_made
  const savingsLabel = savings_bank_name ?? 'Cuenta'
  const creditLabel = credit_bank_name ?? 'Tarjeta'

  return (
    <div
      className="mt-3 pt-3 rounded-lg p-3"
      style={{
        borderTop: '1px dashed var(--border)',
        background: cc_payment_cross_confirmed ? 'rgba(22,163,74,0.06)' : 'rgba(217,119,6,0.06)',
        border: `1px solid ${cc_payment_cross_confirmed ? 'rgba(22,163,74,0.25)' : 'rgba(217,119,6,0.25)'}`,
      }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {t('crossCheck.title')}
          </span>
          {cc_payment_cross_confirmed
            ? <span className="text-xs font-semibold" style={{ color: '#16a34a' }}>{t('crossCheck.confirmed')}</span>
            : <span className="text-xs font-semibold" style={{ color: '#d97706' }}>{t('crossCheck.diff')}</span>
        }
      </div>
      <div className="flex items-center justify-between text-xs py-0.5">
        <span style={{ color: 'var(--text-muted)' }}>{t('crossCheck.debited', { bank: savingsLabel })}</span>
        <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{fmt(savingsSide)}</span>
      </div>
      <div className="flex items-center justify-between text-xs py-0.5">
        <span style={{ color: 'var(--text-muted)' }}>{t('crossCheck.recorded', { bank: creditLabel })}</span>
        <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{fmt(creditSide)}</span>
      </div>
      {!cc_payment_cross_confirmed && Math.abs(cc_payment_cross_diff) > 1 && (
        <div className="flex items-center justify-between text-xs py-0.5 mt-1 pt-1" style={{ borderTop: '1px solid rgba(217,119,6,0.2)' }}>
          <span style={{ color: '#d97706' }}>{t('crossCheck.diffLabel')}</span>
          <span className="font-mono font-medium" style={{ color: '#d97706' }}>
            {cc_payment_cross_diff >= 0 ? '+' : ''}{fmt(Math.abs(cc_payment_cross_diff))}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Balance card ─────────────────────────────────────────────────────────────

interface BalanceCardProps {
  summary: MonthlySummary
  userHasCreditCards: boolean
  balanceStyle: 0|3
}

function BalanceCard({ summary, userHasCreditCards, balanceStyle }: BalanceCardProps) {
  const { t } = useLanguage()
  const style = balanceStyle
  const [detailOpen, setDetailOpen] = useState(false)

  const {
    salary, other_income, total_income, credit_card, savings_account, balance,
    has_savings, has_credit, patrimonio_davivienda, patrimonio_neto,
    month_status, expense_breakdown,
    next_payment_confirmed, next_payment_confirmation_date,
    next_payment_confirmation_amount, ahorro_real,
  } = summary

  if (!has_savings && !has_credit) return null

  const savingsBankName = summary.savings_bank_name ?? 'Cuenta de ahorros'
  const creditBankName  = summary.credit_bank_name  ?? 'Tarjeta de crédito'
  const hasPatrimonio   = savings_account != null && (savings_account.nuevo_saldo > 0 || savings_account.saldo_bolsillo > 0)
  const deudaFalabella  = patrimonio_davivienda - patrimonio_neto
  const totalOut        = balance ? balance.card_payment + balance.other_expenses : 0
  const diff            = balance?.difference ?? 0
  const diffColor       = diff >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'

  // ── shared sub-components ──────────────────────────────────────────────────

  const PartialNotice = () => (!has_savings || (!has_credit && userHasCreditCards)) ? (
    <div className="text-xs mt-3 pt-3" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>
      {!has_savings
        ? t('mesAMes.noStatement', { bank: savingsBankName })
        : t('mesAMes.noStatement', { bank: creditBankName })}
    </div>
  ) : null

  const NextPaymentRow = () => {
    if (has_credit && credit_card && credit_card.next_payment_total > 0 && !next_payment_confirmed) {
      return (
        <div className="flex items-center justify-between text-xs pt-2 mt-2" style={{ borderTop: '1px dashed var(--border)' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            {t('mesAMes.nextPayment', { bank: creditBankName })}
            {credit_card.next_payment_date && <span className="ml-1">{t('mesAMes.beforeDate', { date: credit_card.next_payment_date })}</span>}
          </span>
          <span className="font-mono font-semibold" style={{ color: 'var(--accent-red)' }}>
            -{fmt(credit_card.next_payment_total)}
          </span>
        </div>
      )
    }
    if (next_payment_confirmed && next_payment_confirmation_amount > 0) {
      return (
        <div className="flex items-center justify-between text-xs pt-2 mt-2" style={{ borderTop: '1px dashed var(--border)' }}>
          <span style={{ color: 'var(--accent-green)' }}>
            {t('mesAMes.confirmedPayment', { bank: creditBankName })}
            {next_payment_confirmation_date && <span className="ml-1" style={{ color: 'var(--text-muted)' }}>· {fmtDateShort(next_payment_confirmation_date)}</span>}
          </span>
          <span className="font-mono font-semibold" style={{ color: 'var(--accent-red)' }}>
            -{fmt(next_payment_confirmation_amount)}
          </span>
        </div>
      )
    }
    return null
  }

  const PatrimonioDetail = () => !hasPatrimonio || !savings_account ? null : (
    <div className="flex flex-col gap-0.5 text-xs">
      <div className="flex justify-between">
        <span style={{ color: 'var(--text-muted)' }}>🏦 {savingsBankName}</span>
        <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{fmt(savings_account.nuevo_saldo)}</span>
      </div>
      {deudaFalabella > 0 && (
        <div className="flex justify-between">
          <span style={{ color: 'var(--text-muted)' }}>💳 Deuda {creditBankName}</span>
          <span className="font-mono" style={{ color: 'var(--accent-red)' }}>-{fmt(deudaFalabella)}</span>
        </div>
      )}
      <div className="flex justify-between pt-1 mt-0.5 font-semibold" style={{ borderTop: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--text-secondary)' }}>Patrimonio neto</span>
        <span className="font-mono" style={{ color: patrimonio_neto >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
          {patrimonio_neto >= 0 ? '+' : ''}{fmt(patrimonio_neto)}
        </span>
      </div>
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════════
  // OPCIÓN A — KPI: 4 tarjetas grandes en fila, un número por tarjeta
  // ══════════════════════════════════════════════════════════════════════════
  if (style === 0) {
    const cards = [
      { label: 'Ingresos',  value: total_income,   color: 'var(--accent-green)', sign: '+', show: has_savings },
      { label: 'Egresos',   value: totalOut,        color: 'var(--accent-red)',   sign: '-', show: has_savings },
      { label: 'Diferencia',value: Math.abs(diff),  color: diffColor,             sign: diff >= 0 ? '+' : '-', show: balance != null },
      { label: 'Patrimonio',value: Math.abs(patrimonio_neto), color: patrimonio_neto >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', sign: patrimonio_neto >= 0 ? '+' : '-', show: hasPatrimonio },
    ].filter(c => c.show)

    return (
      <div className="mb-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('mesAMes.balanceTitle')}</span>
          <StatusBadge status={month_status} />
        </div>

        {/* KPI row */}
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cards.length}, 1fr)` }}>
          {cards.map((c) => (
            <div
              key={c.label}
              className="rounded-xl p-4"
              style={{ background: 'var(--bg-secondary)', border: `1px solid var(--border)`, borderTop: `3px solid ${c.color}` }}
            >
              <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{c.label}</div>
              <div className="text-xl font-bold font-mono" style={{ color: c.color }}>
                {c.sign}{fmt(c.value)}
              </div>
            </div>
          ))}
        </div>

        {/* Expense detail + next payment */}
        {has_savings && expense_breakdown.length > 0 && (
          <div className="mt-3 rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Detalle de egresos</div>
            <div className="flex flex-col gap-1">
              {expense_breakdown.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--text-secondary)' }}>{item.icon} {item.label}</span>
                  <span className="font-mono" style={{ color: 'var(--accent-red)' }}>-{fmt(item.amount)}</span>
                </div>
              ))}
            </div>
            <NextPaymentRow />
          </div>
        )}
        <PartialNotice />
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // OPCIÓN D — Mínimo: header con número grande + detalle expandible
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="rounded-xl mb-6 overflow-hidden" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
      {/* Header always visible */}
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('mesAMes.balanceTitle')}</span>
            <StatusBadge status={month_status} />
          </div>
          <div className="text-2xl font-bold font-mono" style={{ color: diffColor }}>
            {diff >= 0 ? '+' : ''}{fmt(diff)}
          </div>
        </div>

        {/* Quick stats */}
        {has_savings && (
          <div className="flex gap-5 flex-shrink-0">
            <div className="text-right">
              <div className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>{t('mesAMes.ingresos')}</div>
              <div className="text-sm font-mono font-semibold" style={{ color: 'var(--accent-green)' }}>+{fmt(total_income)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>{t('mesAMes.egresos')}</div>
              <div className="text-sm font-mono font-semibold" style={{ color: 'var(--accent-red)' }}>-{fmt(totalOut)}</div>
            </div>
            {hasPatrimonio && (
              <div className="text-right">
                <div className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>{t('mesAMes.patrimonio')}</div>
                <div className="text-sm font-mono font-semibold" style={{ color: patrimonio_neto >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                  {patrimonio_neto >= 0 ? '+' : ''}{fmt(patrimonio_neto)}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setDetailOpen(v => !v)}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-all"
            style={{
              background: detailOpen ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
              color: detailOpen ? '#fff' : 'var(--text-muted)',
              border: `1px solid ${detailOpen ? 'var(--accent-primary)' : 'var(--border)'}`,
            }}
          >
            Ver detalle
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
              style={{ transform: detailOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
            >
              <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expandable detail */}
      {detailOpen && (
        <div className="px-5 pb-4 pt-3 flex flex-col gap-3" style={{ borderTop: '1px solid var(--border)' }}>
          {has_savings && expense_breakdown.length > 0 && (
            <div>
              <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Detalle de egresos</div>
              <div className="flex flex-col gap-1">
                {salary && (
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: 'var(--text-secondary)' }}>💰 {t('mesAMes.salary')}</span>
                    <span className="font-mono" style={{ color: 'var(--accent-green)' }}>+{fmt(salary.amount)}</span>
                  </div>
                )}
                {expense_breakdown.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span style={{ color: 'var(--text-secondary)' }}>{item.icon} {item.label}</span>
                    <span className="font-mono" style={{ color: 'var(--accent-red)' }}>-{fmt(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <NextPaymentRow />
          {hasPatrimonio && (
            <div className="pt-3" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>🏛️ Patrimonio</div>
              <PatrimonioDetail />
            </div>
          )}
          <CCCrossCheck summary={summary} />
          <PartialNotice />
        </div>
      )}
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
  const [showHelp, setShowHelp] = useState(false)
  const [monthStatuses, setMonthStatuses] = useState<Record<string, string>>({})
  const { lang, t } = useLanguage()
  const MONTH_NAMES = lang === 'en' ? MONTH_NAMES_EN : MONTH_NAMES_ES

  // ── Balance panel style (from shared context) ───────────────────────────
  const { balanceStyle, setBalanceStyle: setBalanceStyleCtx } = useBalanceStyle()
  const [stylePickerOpen, setStylePickerOpen] = useState(false)
  const setBalanceStyle = (v: 0|3) => {
    setBalanceStyleCtx(v)
    setStylePickerOpen(false)
  }
  const BALANCE_STYLE_OPTIONS: { value: 0|3; label: string; desc: string }[] = [
    { value: 0, label: 'KPI',    desc: 'Cuatro tarjetas con número grande' },
    { value: 3, label: 'Mínimo', desc: 'Cabecera compacta con detalle expandible' },
  ]
  const BalancePicker = () => (
    <div className="relative">
      <button
        onClick={() => setStylePickerOpen(v => !v)}
        title="Cambiar estilo del panel de balance"
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
        Estilo
      </button>
      {stylePickerOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setStylePickerOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1.5 z-20 rounded-xl shadow-xl flex flex-col overflow-hidden"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', minWidth: 220 }}
          >
            <div className="px-3 py-2 text-xs font-semibold" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
              Estilo del panel de balance
            </div>
            {BALANCE_STYLE_OPTIONS.map(({ value, label, desc }) => (
              <button
                key={value}
                onClick={() => setBalanceStyle(value)}
                className="flex items-start gap-3 px-3 py-2.5 text-left w-full transition-all"
                style={{
                  background: balanceStyle === value ? 'rgba(99,102,241,0.08)' : 'transparent',
                  borderLeft: `3px solid ${balanceStyle === value ? 'var(--accent-primary)' : 'transparent'}`,
                }}
              >
                <span className="mt-0.5 text-xs font-mono font-bold w-12 flex-shrink-0" style={{ color: balanceStyle === value ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                  {label}
                </span>
                <span className="text-xs leading-snug" style={{ color: balanceStyle === value ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  {desc}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )

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

  const handleFiltersChange = useCallback((f: { category_id?: number; type?: string; search?: string }) => {
    if (!selected) return
    setLoadingMovements(true)
    fetchMovements({ calendar_month: selected, ...f })
      .then(setMovements)
      .catch(() => setMovements([]))
      .finally(() => setLoadingMovements(false))
  }, [selected])

  useEffect(() => {
    if (selected) loadData(selected)
  }, [selected, loadData])

  // Build lookup map: month_id → MonthWithStats
  const monthIdToStats = new Map(allMonths.map(m => [m.id, m]))

  // True if the user has ever uploaded at least one credit card statement
  const userHasCreditCards = allMonths.some(m => m.statement_type === 'tarjeta_credito')

  const uniqueMonthIds = [...new Set(movements.map(m => m.month_id))]
  const creditMonthIds = uniqueMonthIds.filter(id => {
    const st = monthIdToStats.get(id)?.statement_type ?? movements.find(m => m.month_id === id)?.statement_type
    return st === 'tarjeta_credito'
  })
  const showMultiStatementBanner = creditMonthIds.length > 1

  if (calMonths.length === 0 && !loadingMovements && !loadingSummary) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="text-4xl">📅</div>
        <p style={{ color: 'var(--text-secondary)' }}>{lang === 'es' ? 'No hay movimientos cargados aún.' : 'No movements loaded yet.'}</p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{lang === 'es' ? 'Carga un extracto para ver el historial mes a mes.' : 'Upload a statement to see the month-by-month history.'}</p>
      </div>
    )
  }

  return (
    <>
      {/* ── Horizontal Timeline ── */}
      <div
        className="rounded-xl mb-5"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
      >
        <div
          className="px-5 py-2.5 text-xs font-semibold uppercase tracking-widest"
          style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}
        >
          {t('mesAMes.calendarMonths')}
        </div>
        <div className="px-4 py-5" style={{ overflowX: 'auto' }}>
          <div className="relative flex items-start" style={{ minWidth: 'max-content' }}>
            {/* Connecting line through circle centers */}
            {calMonths.length > 1 && (
              <div
                style={{
                  position: 'absolute',
                  top: 13,
                  left: 60,
                  width: 'calc(100% - 120px)',
                  height: 1,
                  background: 'var(--border)',
                  zIndex: 0,
                }}
              />
            )}
            {calMonths.map((ym) => {
              const status = monthStatuses[ym] ?? 'PARCIAL'
              const isSelected = selected === ym
              const color = STATUS_COLOR[status] ?? '#64748b'
              return (
                <button
                  key={ym}
                  onClick={() => setSelected(ym)}
                  className="relative z-10 flex flex-col items-center transition-all hover:opacity-90"
                  style={{ minWidth: 120, padding: '0 8px' }}
                >
                  {/* Circle node */}
                  <div
                    className="w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all mb-2 flex-shrink-0"
                    style={{
                      borderColor: color,
                      background: isSelected ? color : 'var(--bg-secondary)',
                      boxShadow: isSelected ? `0 0 0 4px ${color}2a` : 'none',
                    }}
                  >
                    {isSelected && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  {/* Month label */}
                  <div
                    className="text-xs font-semibold text-center leading-tight"
                    style={{ color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                  >
                    {calendarMonthLabel(ym, MONTH_NAMES)}
                  </div>
                  {/* Status */}
                  <div className="text-xs mt-0.5 text-center" style={{ color }}>
                    {STATUS_META[status]?.dot} {STATUS_LABEL[status] ?? status}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Full-width content ── */}
      <div className="w-full">
        {selected && (
          <>
            {/* Month title + actions */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold uppercase tracking-wide" style={{ color: 'var(--text-primary)' }}>
                {calendarMonthLabel(selected, MONTH_NAMES)}
              </h2>
              <div className="flex items-center gap-2">
                <BalancePicker />
                <button
                  onClick={() => setShowHelp(true)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                  title={t('app.helpTooltip')}
                >
                  <span>❓</span> {t('btn.help')}
                </button>
              </div>
            </div>
            {/* Semaphore indicators below the title */}
            {summary && <SemaphorePanel summary={summary} />}

            {/* Balance section */}
            {loadingSummary ? (
              <div
                className="rounded-xl flex items-center justify-center py-8 mb-6"
                style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}
              >
                {t('mesAMes.loadingBalance')}
              </div>
            ) : summary ? (
              <BalanceCard summary={summary} userHasCreditCards={userHasCreditCards} balanceStyle={balanceStyle} />
            ) : null}

            {/* Multi-statement banner */}
            {showMultiStatementBanner && (
              <div
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-4 text-sm"
                style={{ background: 'rgba(234,179,8,0.10)', border: '1px solid rgba(234,179,8,0.30)', color: '#ca8a04' }}
              >
                <span>⚠️</span>
                <span>
                  Tienes movimientos de {calendarMonthLabel(selected, MONTH_NAMES)} en{' '}
                  <strong>{creditMonthIds.length} extractos diferentes</strong>. Mostrando todos consolidados.
                </span>
              </div>
            )}

            {/* Movements */}
            <MovementsTable
              key={selected}
              movements={movements}
              categories={categories}
              onFiltersChange={handleFiltersChange}
              onRefresh={() => loadData(selected)}
              loading={loadingMovements}
              statementType={movements.some(m => m.statement_type === 'tarjeta_credito') ? 'tarjeta_credito' : 'cuenta_ahorro'}
            />
          </>
        )}
      </div>
      {showHelp && <HelpModal initialTab="mes_a_mes" onClose={() => setShowHelp(false)} />}
    </>
  )
}
