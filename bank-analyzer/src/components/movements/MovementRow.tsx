import { useState } from 'react'
import { Movement, Category, updateMovement } from '../../services/api'

interface MovementRowProps {
  movement: Movement
  categories: Category[]
  onUpdated: () => void
}

function formatAmount(n: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}

export function MovementRow({ movement, categories, onUpdated }: MovementRowProps) {
  const [editing, setEditing] = useState(false)
  const [selectedCat, setSelectedCat] = useState<number | null>(movement.category_id)
  const [note, setNote] = useState(movement.note ?? '')
  const [saving, setSaving] = useState(false)
  const [applies, setApplies] = useState<boolean | null>(movement.applies_this_month)

  const isIncome = movement.type === 'Ingreso'
  const rowBg = isIncome ? 'rgba(34,197,94,0.04)' : 'transparent'

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

  const handleAppliesToggle = async () => {
    // Cycle: null → true → false → null
    const next = applies === null ? true : applies === true ? false : null
    setApplies(next)
    try {
      await updateMovement(movement.id, { applies_this_month: next })
    } catch {
      setApplies(applies) // revert on error
    }
  }

  const cat = movement.category

  return (
    <tr style={{ background: rowBg, borderBottom: '1px solid var(--border)' }}>
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
      <td className="px-4 py-2.5 text-right text-sm font-mono font-medium" style={{ color: isIncome ? 'var(--accent-green)' : 'var(--accent-red)' }}>
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
      {/* Aplica este mes toggle */}
      <td className="px-4 py-2.5 text-center">
        <button
          onClick={handleAppliesToggle}
          title={applies === null ? 'Sin definir — click para marcar como aplica' : applies ? 'Aplica este mes — click para marcar como no aplica' : 'No aplica — click para restablecer'}
          className="w-6 h-6 rounded flex items-center justify-center mx-auto transition-all text-sm"
          style={{
            background: applies === true ? 'rgba(34,197,94,0.15)' : applies === false ? 'rgba(239,68,68,0.12)' : 'var(--bg-tertiary)',
            border: `1px solid ${applies === true ? 'rgba(34,197,94,0.4)' : applies === false ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
          }}
        >
          {applies === true ? '✓' : applies === false ? '✗' : '–'}
        </button>
      </td>
    </tr>
  )
}
