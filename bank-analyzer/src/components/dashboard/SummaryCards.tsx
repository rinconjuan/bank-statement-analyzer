import { MovementsSummary } from '../../services/api'

function formatAmount(n: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}

interface SummaryCardsProps {
  summary: MovementsSummary | null
  statementType?: string
}

export function SummaryCards({ summary, statementType = 'cuenta_ahorro' }: SummaryCardsProps) {
  const income = summary?.total_income ?? 0
  const expenses = summary?.total_expenses ?? 0
  const balance = summary?.balance ?? 0

  const isCreditCard = statementType === 'tarjeta_credito'

  const cards = [
    {
      label: isCreditCard ? 'Pagos/Abonos' : 'Ingresos',
      value: income,
      color: 'var(--accent-green)',
      icon: isCreditCard ? '💳' : '↑',
      bg: 'rgba(34,197,94,0.08)',
      hint: isCreditCard ? 'Pagos realizados a la tarjeta' : undefined,
    },
    {
      label: isCreditCard ? 'Consumos' : 'Egresos',
      value: expenses,
      color: 'var(--accent-red)',
      icon: '↓',
      bg: 'rgba(239,68,68,0.08)',
      hint: isCreditCard ? 'Total de compras del período' : undefined,
    },
    {
      label: isCreditCard ? 'Saldo Pendiente' : 'Balance',
      value: balance,
      color: balance >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
      icon: isCreditCard ? '⚖️' : '≈',
      bg: balance >= 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
      hint: isCreditCard ? (balance >= 0 ? 'A favor del titular' : 'Monto por pagar') : undefined,
    },
  ]

  return (
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
        </div>
      ))}
    </div>
  )
}
