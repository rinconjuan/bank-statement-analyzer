import { useState, useMemo } from 'react'
import { Movement, Category } from '../../services/api'
import { MovementRow } from './MovementRow'

interface MovementsTableProps {
  movements: Movement[]
  categories: Category[]
  onFiltersChange: (f: { category_id?: number; type?: string; search?: string }) => void
  onRefresh: () => void
  loading: boolean
  statementType?: string
}

function formatAmount(n: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}

export function MovementsTable({ movements, categories, onFiltersChange, onRefresh, loading, statementType = 'cuenta_ahorro' }: MovementsTableProps) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [catFilter, setCatFilter] = useState<number | undefined>(undefined)
  const [creditFilter, setCreditFilter] = useState<'all' | 'aplican' | 'diferidos' | 'pagos'>('all')

  const isCreditCard = statementType === 'tarjeta_credito'

  const applyFilters = (s: string, t: string, c: number | undefined) => {
    onFiltersChange({ search: s || undefined, type: t || undefined, category_id: c })
  }

  const handleSearch = (v: string) => { setSearch(v); applyFilters(v, typeFilter, catFilter) }
  const handleType = (v: string) => { setTypeFilter(v); applyFilters(search, v, catFilter) }
  const handleCat = (v: number | undefined) => { setCatFilter(v); applyFilters(search, typeFilter, v) }

  // Apply credit card quick filter on the client side
  const visibleMovements = useMemo(() => {
    if (!isCreditCard || creditFilter === 'all') return movements
    if (creditFilter === 'aplican') return movements.filter(m => m.aplica_este_extracto)
    if (creditFilter === 'diferidos') return movements.filter(m => m.es_diferido_anterior)
    if (creditFilter === 'pagos') return movements.filter(m => m.es_pago_tarjeta)
    return movements
  }, [movements, isCreditCard, creditFilter])

  /** Aggregate totals per category from the currently visible movements, split by type */
  const categoryTotals = useMemo(() => {
    const map = new Map<string, { name: string; icon: string; color: string; income: number; expense: number; count: number }>()
    for (const m of visibleMovements) {
      const key = m.category?.name ?? 'Sin categoría'
      const existing = map.get(key)
      if (existing) {
        if (m.type === 'Ingreso') existing.income += m.amount
        else existing.expense += m.amount
        existing.count += 1
      } else {
        map.set(key, {
          name: key,
          icon: m.category?.icon ?? '📦',
          color: m.category?.color ?? '#94a3b8',
          income: m.type === 'Ingreso' ? m.amount : 0,
          expense: m.type === 'Egreso' ? m.amount : 0,
          count: 1,
        })
      }
    }
    return Array.from(map.values()).sort((a, b) => (b.income + b.expense) - (a.income + a.expense))
  }, [visibleMovements])

  const grandIncome = useMemo(() => visibleMovements.filter(m => m.type === 'Ingreso').reduce((s, m) => s + m.amount, 0), [visibleMovements])
  const grandExpense = useMemo(() => visibleMovements.filter(m => m.type === 'Egreso').reduce((s, m) => s + m.amount, 0), [visibleMovements])

  return (
    <div className="flex gap-4 items-start">
      {/* ── Main table column ── */}
      <div className="flex flex-col gap-3 flex-1 min-w-0">
        {/* ── SECCIÓN 1: Filtrar por ── */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Filtrar por</span>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Buscar movimientos..."
              className="text-sm rounded-lg px-3 py-1.5 flex-1 min-w-48"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)', outline: 'none' }}
            />
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
          </div>
        </div>

        {/* ── SECCIÓN 2: Categorías ── */}
        <div className="flex flex-col gap-1" style={{ borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Categorías</span>
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

        {/* ── SECCIÓN 3: Estado (solo tarjeta de crédito) ── */}
        {isCreditCard && (
          <div className="flex flex-col gap-1" style={{ borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Estado</span>
            <div className="flex gap-2 flex-wrap">
              {(['all', 'aplican', 'diferidos', 'pagos'] as const).map((f) => {
                const labels: Record<string, string> = { all: 'Todos', aplican: 'Aplican este mes', diferidos: 'Diferidos', pagos: 'Pagos' }
                return (
                  <button
                    key={f}
                    onClick={() => setCreditFilter(f)}
                    className="text-xs px-3 py-1.5 rounded-lg transition-all"
                    style={{
                      background: creditFilter === f ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                      color: creditFilter === f ? '#fff' : 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {labels[f]}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Table */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid var(--border)' }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-12" style={{ color: 'var(--text-muted)' }}>
              Cargando movimientos...
            </div>
          ) : visibleMovements.length === 0 ? (
            <div className="flex items-center justify-center py-12" style={{ color: 'var(--text-muted)' }}>
              No hay movimientos
            </div>
          ) : (
            <div className="overflow-auto max-h-[560px]">
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
                  </tr>
                </thead>
                <tbody>
                  {visibleMovements.map((m) => (
                    <MovementRow key={m.id} movement={m} categories={categories} onUpdated={onRefresh} showCuota={isCreditCard} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {visibleMovements.length} movimientos{visibleMovements.length !== movements.length ? ` (de ${movements.length})` : ''}
        </div>
      </div>

      {/* ── Category totals side panel ── */}
      {!loading && movements.length > 0 && (
        <div
          className="rounded-xl p-4 flex-shrink-0"
          style={{
            width: 240,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            position: 'sticky',
            top: 0,
          }}
        >
          <div className="text-xs font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
            Totales por categoría
          </div>
          <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: 420 }}>
            {categoryTotals.map((cat) => (
              <div key={cat.name} className="min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="flex-shrink-0 rounded-full" style={{ width: 7, height: 7, background: cat.color }} />
                  <span className="text-xs truncate flex-1" style={{ color: 'var(--text-secondary)' }} title={cat.name}>
                    {cat.icon} {cat.name}
                  </span>
                </div>
                <div className="flex gap-2 pl-3.5">
                  {cat.income > 0 && (
                    <span className="text-xs font-medium" style={{ color: 'var(--accent-green)' }}>
                      +{formatAmount(cat.income)}
                    </span>
                  )}
                  {cat.expense > 0 && (
                    <span className="text-xs font-medium" style={{ color: 'var(--accent-red)' }}>
                      -{formatAmount(cat.expense)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {/* Totals divider */}
          <div className="mt-3 pt-3 flex flex-col gap-1" style={{ borderTop: '1px solid var(--border)' }}>
            {grandIncome > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>↑ Ingresos</span>
                <span className="text-xs font-semibold" style={{ color: 'var(--accent-green)' }}>
                  {formatAmount(grandIncome)}
                </span>
              </div>
            )}
            {grandExpense > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>↓ Egresos</span>
                <span className="text-xs font-semibold" style={{ color: 'var(--accent-red)' }}>
                  {formatAmount(grandExpense)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Balance</span>
              <span
                className="text-xs font-bold"
                style={{ color: grandIncome - grandExpense >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}
              >
                {formatAmount(grandIncome - grandExpense)}
              </span>
            </div>
          </div>
          <div className="mt-1 text-xs text-right" style={{ color: 'var(--text-muted)' }}>
            {movements.length} movimientos
          </div>
        </div>
      )}
    </div>
  )
}
