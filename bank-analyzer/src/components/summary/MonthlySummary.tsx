import { useEffect, useState } from 'react'
import {
  fetchMonthlySummary, fetchAvailableMonths,
  MonthlySummary as MonthlySummaryType, AvailableMonth,
} from '../../services/api'

function fmt(n: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0,
  }).format(n)
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

function Row({ label, value, color, indent }: { label: string; value: string; color?: string; indent?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1 ${indent ? 'pl-4' : ''}`}>
      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="text-sm font-mono font-semibold" style={{ color: color ?? 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}

function Divider() {
  return <div className="my-2" style={{ borderTop: '1px solid var(--border)' }} />
}

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-lg">{icon}</span>
      <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{title}</span>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
      {children}
    </div>
  )
}

export function MonthlySummaryView() {
  const [availableMonths, setAvailableMonths] = useState<AvailableMonth[]>([])
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const [summary, setSummary] = useState<MonthlySummaryType | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAvailableMonths()
      .then((months) => {
        setAvailableMonths(months)
        if (months.length > 0) {
          setSelectedYear(months[0].year)
          setSelectedMonth(months[0].month)
        }
      })
      .catch(() => setError('No se pudieron cargar los meses disponibles'))
  }, [])

  useEffect(() => {
    if (!selectedYear || !selectedMonth) return
    setLoading(true)
    setError(null)
    fetchMonthlySummary(selectedYear, selectedMonth)
      .then(setSummary)
      .catch(() => {
        setSummary(null)
        setError('No hay datos para este mes. Carga al menos un extracto.')
      })
      .finally(() => setLoading(false))
  }, [selectedYear, selectedMonth])

  return (
    <div className="max-w-2xl space-y-4">
      {/* Header + month selector */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Resumen del Mes
        </h1>
        {availableMonths.length > 0 && (
          <select
            className="text-sm rounded-lg px-3 py-1.5"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
            value={`${selectedYear}-${String(selectedMonth).padStart(2, '0')}`}
            onChange={(e) => {
              const [y, m] = e.target.value.split('-')
              setSelectedYear(parseInt(y))
              setSelectedMonth(parseInt(m))
            }}
          >
            {availableMonths.map((am) => (
              <option key={`${am.year}-${am.month}`} value={`${am.year}-${String(am.month).padStart(2, '0')}`}>
                {am.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading && (
        <div className="text-sm py-8 text-center" style={{ color: 'var(--text-muted)' }}>
          Cargando resumen…
        </div>
      )}

      {error && !loading && (
        <div className="text-sm py-8 text-center rounded-xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          {error}
        </div>
      )}

      {!loading && summary && (
        <>
          {/* Title */}
          <div className="text-center py-2">
            <span className="text-base font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              {summary.month_label}
            </span>
          </div>

          {/* Income section */}
          {summary.has_savings && (
            <Card>
              <SectionTitle icon="💰" title="Ingresos del mes" />
              {summary.salary && (
                <Row
                  label={`Salario (${summary.salary.description.substring(0, 30).trim()})`}
                  value={fmt(summary.salary.amount)}
                  color="var(--accent-green)"
                />
              )}
              {summary.other_income > 0 && (
                <Row label="Otros ingresos" value={fmt(summary.other_income)} />
              )}
              <Divider />
              <Row label="Total ingresos" value={fmt(summary.total_income)} color="var(--accent-green)" />
            </Card>
          )}

          {/* Credit card section */}
          {summary.has_credit && summary.credit_card && (
            <Card>
              <SectionTitle icon="💳" title="Tarjeta de Crédito Falabella" />
              {summary.credit_card.payment_made > 0 && (
                <Row
                  label={
                    summary.credit_card.payment_count > 1
                      ? `Pagaste (${summary.credit_card.payment_count} pagos, entre ${fmtDateShort(summary.credit_card.payment_date)} y ${fmtDateShort(summary.credit_card.payment_date_end)})`
                      : `Pagaste el ${fmtDateShort(summary.credit_card.payment_date)}`
                  }
                  value={fmt(summary.credit_card.payment_made)}
                  color="var(--accent-green)"
                />
              )}
              {summary.credit_card.payment_made > 0 && (
                <div className="text-xs ml-1 mb-1" style={{ color: summary.credit_card.payment_confirmed ? 'var(--accent-green)' : 'var(--accent-yellow, #f59e0b)' }}>
                  {summary.credit_card.payment_confirmed ? '✓ Pago confirmado' : '⚠️ Verificar pago'}
                </div>
              )}
              <Row label="Consumos reales del periodo" value={fmt(summary.credit_card.consumos_periodo)} />
              {summary.credit_card.next_payment_date && (
                <Row label="Fecha límite próximo pago" value={summary.credit_card.next_payment_date} />
              )}
              {summary.credit_card.next_payment_total > 0 && (
                <Row label="Próximo pago total" value={fmt(summary.credit_card.next_payment_total)} color="var(--accent-red)" />
              )}
              {summary.credit_card.next_payment_min > 0 && (
                <Row
                  label="Pago mínimo"
                  value={fmt(summary.credit_card.next_payment_min)}
                  color="var(--text-muted)"
                  indent
                />
              )}
            </Card>
          )}

          {/* Savings account section */}
          {summary.has_savings && summary.savings_account && (
            <Card>
              <SectionTitle icon="🏦" title="Cuenta Davivienda" />
              {summary.savings_account.opening_balance > 0 && (
                <Row label="Saldo inicio del mes" value={fmt(summary.savings_account.opening_balance)} />
              )}
              {summary.savings_account.closing_balance > 0 && (
                <Row label="Saldo fin del mes" value={fmt(summary.savings_account.closing_balance)} />
              )}
              <Row
                label="Otros gastos del mes"
                value={fmt(summary.savings_account.other_expenses)}
                color="var(--accent-red)"
              />
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                (total débitos excl. pago Falabella)
              </div>
            </Card>
          )}

          {/* Balance section */}
          {summary.balance && (
            <Card>
              <SectionTitle icon="📊" title="Balance del mes" />
              <Row
                label="Ingresos"
                value={`+${fmt(summary.balance.income)}`}
                color="var(--accent-green)"
              />
              {summary.balance.card_payment > 0 && (
                <Row
                  label="Pago tarjeta"
                  value={`-${fmt(summary.balance.card_payment)}`}
                  color="var(--accent-red)"
                />
              )}
              {summary.balance.other_expenses > 0 && (
                <Row
                  label="Otros gastos Davivienda"
                  value={`-${fmt(summary.balance.other_expenses)}`}
                  color="var(--accent-red)"
                />
              )}
              <Divider />
              <Row
                label="Diferencia"
                value={(summary.balance.difference >= 0 ? '+' : '') + fmt(summary.balance.difference)}
                color={summary.balance.difference >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}
              />
              {summary.balance.balance_change !== 0 && (
                <>
                  <Row
                    label="Variación saldo cuenta"
                    value={(summary.balance.balance_change >= 0 ? '+' : '') + fmt(summary.balance.balance_change)}
                    color="var(--text-secondary)"
                  />
                  <div className="text-xs mt-1" style={{ color: summary.balance.matches_statement ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                    {summary.balance.matches_statement ? '✓ Cuadra con el extracto' : '(saldo inicio/fin no disponible en PDF)'}
                  </div>
                </>
              )}
            </Card>
          )}

          {/* Partial data notice */}
          {(!summary.has_savings || !summary.has_credit) && (
            <div className="text-xs rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              {!summary.has_savings && !summary.has_credit
                ? '⚠️ No hay extractos cargados para este mes.'
                : !summary.has_savings
                  ? 'ℹ️ No hay extracto de Davivienda para este mes. Carga el PDF para ver el resumen completo.'
                  : 'ℹ️ No hay extracto de Falabella para este mes. Carga el PDF para ver el resumen completo.'
              }
            </div>
          )}
        </>
      )}
    </div>
  )
}
