import { MovementsSummary } from '../../services/api'

function formatAmount(n: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}

interface SummaryCardsProps {
  summary: MovementsSummary | null
  statementType?: string
  minPayment?: number | null
  totalPayment?: number | null
  saldoAnterior?: number | null
  nuevoSaldo?: number | null
}

export function SummaryCards({ summary, statementType = 'cuenta_ahorro', minPayment, totalPayment, saldoAnterior, nuevoSaldo }: SummaryCardsProps) {
  const income = summary?.total_income ?? 0
  const expenses = summary?.total_expenses ?? 0
  const balance = summary?.balance ?? 0

  const isCreditCard = statementType === 'tarjeta_credito'

  // Month breakdown comes directly from the backend summary (always consistent with the total)
  const expensesByMonth = summary?.expenses_by_month ?? []

  const cards = [
    {
      label: isCreditCard ? 'Pagos/Abonos' : 'Ingresos',
      value: income,
      color: 'var(--accent-green)',
      icon: isCreditCard ? '💳' : '↑',
      bg: 'rgba(34,197,94,0.08)',
      hint: isCreditCard ? 'Pagos realizados a la tarjeta' : undefined,
      breakdown: false,
    },
    {
      label: isCreditCard ? 'Consumos Totales' : 'Egresos',
      value: expenses,
      color: 'var(--accent-red)',
      icon: '↓',
      bg: 'rgba(239,68,68,0.08)',
      hint: isCreditCard ? 'Total de compras del período' : undefined,
      breakdown: isCreditCard && expensesByMonth.length > 1,
    },
    {
      label: isCreditCard ? 'Saldo Pendiente' : 'Balance',
      value: balance,
      color: balance >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
      icon: isCreditCard ? '⚖️' : '≈',
      bg: balance >= 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
      hint: isCreditCard ? (balance >= 0 ? 'A favor del titular' : 'Monto por pagar') : undefined,
      breakdown: false,
    },
  ]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl p-5"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{card.label}</span>
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                style={{ background: card.bg, color: card.color }}
              >
                {card.icon}
              </div>
            </div>
            <div
              className="font-display text-2xl tracking-tight"
              style={{ color: card.color }}
            >
              {formatAmount(card.value)}
            </div>
            {card.hint && (
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {card.hint}
              </div>
            )}
            {/* Month breakdown for credit card consumos — sourced from backend for accuracy */}
            {card.breakdown && (
              <div className="mt-3 pt-2 flex flex-col gap-1" style={{ borderTop: '1px solid var(--border)' }}>
                {expensesByMonth.map((row) => (
                  <div key={row.month} className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {row.month_label}
                    </span>
                    <span className="text-xs font-semibold" style={{ color: card.color }}>
                      {formatAmount(row.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {/* Saldo anterior / final context — only for savings account Balance card */}
            {card.label === 'Balance' && !isCreditCard && saldoAnterior != null && nuevoSaldo != null && (
              <div className="mt-3 pt-2 flex flex-col gap-1" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="flex justify-between text-xs">
                  <span style={{ color: 'var(--text-muted)' }}>Saldo anterior</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{formatAmount(saldoAnterior)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: 'var(--text-muted)' }}>Saldo final</span>
                  <span style={{ color: nuevoSaldo >= saldoAnterior ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    {formatAmount(nuevoSaldo)}
                    {' '}{'●'}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Credit card payment summary row */}
      {isCreditCard && (totalPayment != null || minPayment != null) && (
        <div className="grid gap-4" style={{ gridTemplateColumns: totalPayment != null && minPayment != null ? '1fr 1fr' : '1fr' }}>
          {totalPayment != null && (
            <div
              className="rounded-xl p-4 flex items-center gap-4"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--accent-red)' }}
              >
                💰
              </div>
              <div>
                <div className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Pago total del período</div>
                <div className="text-xl font-semibold tracking-tight" style={{ color: 'var(--accent-red)' }}>
                  {formatAmount(totalPayment)}
                </div>
              </div>
            </div>
          )}
          {minPayment != null && (
            <div
              className="rounded-xl p-4 flex items-center gap-4"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                style={{ background: 'rgba(234,179,8,0.12)', color: '#ca8a04' }}
              >
                📋
              </div>
              <div>
                <div className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Pago mínimo</div>
                <div className="text-xl font-semibold tracking-tight" style={{ color: '#ca8a04' }}>
                  {formatAmount(minPayment)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
