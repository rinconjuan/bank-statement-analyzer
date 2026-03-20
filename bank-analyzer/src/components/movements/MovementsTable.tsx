import { useState } from 'react'
import { Movement, Category } from '../../services/api'
import { MovementRow } from './MovementRow'

interface MovementsTableProps {
  movements: Movement[]
  categories: Category[]
  onFiltersChange: (f: { category_id?: number; type?: string; search?: string }) => void
  onRefresh: () => void
  loading: boolean
}

export function MovementsTable({ movements, categories, onFiltersChange, onRefresh, loading }: MovementsTableProps) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [catFilter, setCatFilter] = useState<number | undefined>(undefined)

  const applyFilters = (s: string, t: string, c: number | undefined) => {
    onFiltersChange({ search: s || undefined, type: t || undefined, category_id: c })
  }

  const handleSearch = (v: string) => { setSearch(v); applyFilters(v, typeFilter, catFilter) }
  const handleType = (v: string) => { setTypeFilter(v); applyFilters(search, v, catFilter) }
  const handleCat = (v: number | undefined) => { setCatFilter(v); applyFilters(search, typeFilter, v) }

  return (
    <div className="flex flex-col gap-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar movimientos..."
          className="text-sm rounded-lg px-3 py-1.5 flex-1 min-w-48"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)', outline: 'none' }}
        />
        {/* Type filter */}
        {['', 'Ingreso', 'Egreso'].map((t) => (
          <button
            key={t}
            onClick={() => handleType(t)}
            className="text-xs px-3 py-1.5 rounded-lg transition-all"
            style={{
              background: typeFilter === t ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
              color: typeFilter === t ? '#fff' : 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            {t || 'Todos'}
          </button>
        ))}
        {/* Category pills */}
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => handleCat(undefined)}
            className="text-xs px-2 py-1 rounded-full transition-all"
            style={{
              background: catFilter === undefined ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
              color: catFilter === undefined ? '#fff' : 'var(--text-secondary)',
            }}
          >
            Todas
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => handleCat(c.id === catFilter ? undefined : c.id)}
              className="text-xs px-2 py-1 rounded-full transition-all"
              style={{
                background: catFilter === c.id ? `${c.color}30` : 'var(--bg-tertiary)',
                color: catFilter === c.id ? c.color : 'var(--text-secondary)',
                border: catFilter === c.id ? `1px solid ${c.color}60` : '1px solid var(--border)',
              }}
            >
              {c.icon} {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--border)' }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-12" style={{ color: 'var(--text-muted)' }}>
            Cargando movimientos...
          </div>
        ) : movements.length === 0 ? (
          <div className="flex items-center justify-center py-12" style={{ color: 'var(--text-muted)' }}>
            No hay movimientos
          </div>
        ) : (
          <div className="overflow-auto max-h-96">
            <table className="w-full text-left">
              <thead>
                <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)' }}>
                  <th className="px-4 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Fecha</th>
                  <th className="px-4 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Descripción</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-right" style={{ color: 'var(--text-muted)' }}>Monto</th>
                  <th className="px-4 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Tipo</th>
                  <th className="px-4 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Categoría</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <MovementRow key={m.id} movement={m} categories={categories} onUpdated={onRefresh} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {movements.length} movimientos
      </div>
    </div>
  )
}
