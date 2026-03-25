import { useState } from 'react'
import { Movement, Category, updateMovement } from '../../services/api'

interface MovementRowProps {
  movement: Movement
  categories: Category[]
  onUpdated: () => void
  showCuota?: boolean
}

function formatAmount(n: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}

export function MovementRow({ movement, categories, onUpdated, showCuota = false }: MovementRowProps) {
  const [editing, setEditing] = useState(false)
  const [selectedCat, setSelectedCat] = useState<number | null>(movement.category_id)
  const [note, setNote] = useState(movement.note ?? '')
  const [saving, setSaving] = useState(false)

  const isIncome = movement.type === 'Ingreso'
  const rowBg = isIncome ? 'rgba(34,197,94,0.04)' : 'transparent'

  // Determinar el estado visual del movimiento para tarjeta de crédito
  const isPendingDeferred = showCuota &&
    !movement.es_pago_tarjeta &&
    !movement.es_diferido_anterior &&
    movement.cuota_mes === 0 &&
    movement.type === 'Egreso'
  // → compra que ocurrió este mes pero se cobra después

  const isActiveDeferred = showCuota &&
    movement.es_diferido_anterior
  // → compra de un mes anterior que se cobra ahora

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateMovement(movement.id, { category_id: selectedCat, note: note || null })
      setEditing(false)
      onUpdated()
    } finally {
      setSaving(false)
    }
  }

  const cat = movement.category

  return (
    <tr style={{ background: rowBg, borderBottom: '1px solid var(--border)', opacity: isPendingDeferred ? 0.55 : 1 }}>
      <td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        {movement.date}
      </td>
      <td className="px-4 py-2.5 text-sm max-w-xs">
        <div className="truncate" style={{ color: 'var(--text-primary)' }} title={movement.description}>
          {movement.description}
        </div>
        {movement.note && (
          <div className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{movement.note}</div>
        )}
      </td>
      <td
        className="px-4 py-2.5 text-right text-sm font-mono font-medium"
        style={{
          color: isIncome ? 'var(--accent-green)' : 'var(--accent-red)',
          opacity: isPendingDeferred ? 0.7 : 1,
        }}
        title={
          isPendingDeferred
            ? 'Monto total de la compra — la cuota se cobrará en el siguiente extracto'
            : isActiveDeferred
            ? `Compra original: ${formatAmount(movement.amount)} — cobrada en cuotas`
            : undefined
        }
      >
        {isIncome ? '+' : '-'}{formatAmount(movement.amount)}
      </td>
      <td className="px-4 py-2.5 text-xs">
        <span
          className="px-2 py-0.5 rounded-full text-xs"
          style={{ background: isIncome ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: isIncome ? 'var(--accent-green)' : 'var(--accent-red)' }}
        >
          {movement.type}
        </span>
      </td>
      {showCuota && (
        <td className="px-4 py-2.5 text-right text-xs font-mono whitespace-nowrap">
          {movement.es_pago_tarjeta ? (
            <span
              className="px-2 py-0.5 rounded-full text-xs"
              style={{ background: 'rgba(79,127,255,0.15)', color: 'var(--accent-primary)' }}
            >
              Pago realizado
            </span>
          ) : isPendingDeferred ? (
            // Compra registrada este mes pero cuota se cobra después
            <span
              className="px-2 py-0.5 rounded-full text-xs"
              title="Esta compra se cobrará en el siguiente extracto"
              style={{ background: 'rgba(234,179,8,0.15)', color: '#ca8a04', cursor: 'help' }}
            >
              ⏳ Próximo extracto
            </span>
          ) : isActiveDeferred ? (
            // Compra de mes anterior que se cobra ahora
            <div className="flex flex-col items-end gap-0.5">
              <span
                className="px-2 py-0.5 rounded-full text-xs"
                title={`Compra realizada el ${movement.date}, cobrada en este extracto`}
                style={{ background: 'rgba(148,163,184,0.15)', color: 'var(--text-secondary)', cursor: 'help' }}
              >
                🔄 Diferido
              </span>
              {movement.cuota_mes > 0 && (
                <span style={{ color: 'var(--accent-green)', fontSize: 11 }}>
                  {formatAmount(movement.cuota_mes)}
                </span>
              )}
            </div>
          ) : movement.cuota_mes > 0 ? (
            <span style={{ color: 'var(--accent-green)' }}>
              {formatAmount(movement.cuota_mes)}
            </span>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>—</span>
          )}
        </td>
      )}
      <td className="px-4 py-2.5">
        {editing ? (
          <div className="flex items-center gap-2">
            <select
              value={selectedCat ?? ''}
              onChange={(e) => setSelectedCat(e.target.value ? Number(e.target.value) : null)}
              className="text-xs rounded px-2 py-1 w-32"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            >
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nota..."
              className="text-xs rounded px-2 py-1 w-28"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            />
            <button onClick={handleSave} disabled={saving} className="text-xs px-2 py-1 rounded" style={{ background: 'var(--accent-primary)', color: '#fff' }}>
              {saving ? '...' : '✓'}
            </button>
            <button onClick={() => setEditing(false)} className="text-xs px-2 py-1 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 group"
          >
            {cat ? (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: `${cat.color}20`, color: cat.color, border: `1px solid ${cat.color}40` }}
              >
                {cat.icon} {cat.name}
              </span>
            ) : (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Sin categoría</span>
            )}
            <span className="opacity-0 group-hover:opacity-100 text-xs" style={{ color: 'var(--text-muted)' }}>✏️</span>
          </button>
        )}
      </td>
    </tr>
  )
}
