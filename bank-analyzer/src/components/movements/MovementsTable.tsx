import { useState, useMemo } from 'react'
import { Movement, Category } from '../../services/api'
import { MovementRow } from './MovementRow'
import { useLanguage } from '../../contexts/LanguageContext'
import { translateCategoryName } from '../../i18n/categories'

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
  const { lang, t } = useLanguage()
  const [search, setSearch] = useState('')
  const [catFilters, setCatFilters] = useState<number[]>([])
  const [catOpen, setCatOpen] = useState(false)

  const isCreditCard = statementType === 'tarjeta_credito'

  const handleSearch = (v: string) => { setSearch(v); onFiltersChange({ search: v || undefined }) }
  const toggleCat = (id: number) => {
    setCatFilters(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  const clearCats = () => setCatFilters([])

  const visibleMovements = useMemo(() => {
    if (catFilters.length === 0) return movements
    return movements.filter(m => m.category_id != null && catFilters.includes(m.category_id))
  }, [movements, catFilters])

  /** Aggregate totals per category from the currently visible movements, split by type */
  const categoryTotals = useMemo(() => {
    const map = new Map<string, { name: string; icon: string; color: string; income: number; expense: number; count: number }>()
    for (const m of visibleMovements) {
      const key = translateCategoryName(m.category?.name ?? 'Sin categoría', lang)
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


        {/* ── Filtros: búsqueda + categorías desplegables ── */}
        {(() => {
          const activeCats = categories.filter(c => catFilters.includes(c.id))
          return (
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
            >
              {/* Barra principal */}
              <div className="flex items-center gap-2 px-3 py-2.5">
                <input
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder={t('movements.search')}
                  className="text-sm rounded-lg px-3 py-1.5 flex-1"
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)', outline: 'none' }}
                />

                {/* Badges de categorías activas */}
                {activeCats.map(c => (
                  <span
                    key={c.id}
                    className="text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 flex-shrink-0"
                    style={{ background: `${c.color}20`, color: c.color, border: `1px solid ${c.color}50` }}
                  >
                    {c.icon}
                    <button
                      onClick={() => toggleCat(c.id)}
                      className="leading-none hover:opacity-60 transition-opacity"
                      style={{ fontSize: 14 }}
                    >×</button>
                  </span>
                ))}

                {/* Botón desplegable */}
                <button
                  onClick={() => setCatOpen(v => !v)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all flex-shrink-0"
                  style={{
                    background: catOpen || catFilters.length > 0 ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                    color: catOpen || catFilters.length > 0 ? '#fff' : 'var(--text-muted)',
                    border: `1px solid ${catOpen || catFilters.length > 0 ? 'var(--accent-primary)' : 'var(--border)'}`,
                  }}
                >
                  <span>{t('movements.category')}{catFilters.length > 0 ? ` · ${catFilters.length}` : ''}</span>
                  <svg
                    width="10" height="10" viewBox="0 0 10 10" fill="none"
                    style={{ transform: catOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
                  >
                    <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>

              {/* Panel desplegable */}
              {catOpen && (
                <div
                  className="px-3 pb-3"
                  style={{ borderTop: '1px solid var(--border)', paddingTop: '0.625rem' }}
                >
                  <div className="flex flex-wrap gap-1.5">
                    {/* Limpiar todo */}
                    {catFilters.length > 0 && (
                      <button
                        onClick={clearCats}
                        className="text-xs px-3 py-1 rounded-full transition-all"
                        style={{
                          background: 'transparent',
                          color: 'var(--accent-red)',
                          border: '1px solid var(--accent-red)',
                        }}
                      >{t('movements.clear')}</button>
                    )}
                    {categories.map((c) => {
                      const active = catFilters.includes(c.id)
                      return (
                        <button
                          key={c.id}
                          onClick={() => toggleCat(c.id)}
                          className="text-xs px-3 py-1 rounded-full transition-all flex items-center gap-1.5"
                          style={{
                            background: active ? `${c.color}20` : 'transparent',
                            color: active ? c.color : 'var(--text-muted)',
                            border: `1px solid ${active ? `${c.color}60` : 'var(--border)'}`,
                          }}
                        >
                          {active && (
                            <svg width="9" height="9" viewBox="0 0 9 9" fill="none" style={{ flexShrink: 0 }}>
                              <path d="M1.5 4.5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                          {c.icon} {translateCategoryName(c.name, lang)}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* Table */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid var(--border)' }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-12" style={{ color: 'var(--text-muted)' }}>
              {t('movements.loading')}
            </div>
          ) : visibleMovements.length === 0 ? (
            <div className="flex items-center justify-center py-12" style={{ color: 'var(--text-muted)' }}>
              {t('movements.empty')}
            </div>
          ) : (
            <div className="overflow-auto max-h-[560px]">
              <table className="w-full text-left">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th className="px-4 py-2.5 text-xs font-medium sticky top-0 z-10" style={{ color: 'var(--text-muted)', background: 'var(--bg-tertiary)' }}>{t('mesAMes.colDate')}</th>
                    <th className="px-4 py-2.5 text-xs font-medium sticky top-0 z-10" style={{ color: 'var(--text-muted)', background: 'var(--bg-tertiary)' }}>{t('mesAMes.colDesc')}</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-right sticky top-0 z-10" style={{ color: 'var(--text-muted)', background: 'var(--bg-tertiary)' }}>{t('mesAMes.colAmount')}</th>
                    <th className="px-4 py-2.5 text-xs font-medium sticky top-0 z-10" style={{ color: 'var(--text-muted)', background: 'var(--bg-tertiary)' }}>{t('mesAMes.colType')}</th>
                    {isCreditCard && (
                      <th className="px-4 py-2.5 text-xs font-medium text-right sticky top-0 z-10" style={{ color: 'var(--text-muted)', background: 'var(--bg-tertiary)' }}>{t('mesAMes.colInstallment')}</th>
                    )}
                    <th className="px-4 py-2.5 text-xs font-medium sticky top-0 z-10" style={{ color: 'var(--text-muted)', background: 'var(--bg-tertiary)' }}>{t('mesAMes.colCategory')}</th>
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
          {visibleMovements.length !== movements.length
            ? t('movements.countOf', { n: String(visibleMovements.length), total: String(movements.length) })
            : t('movements.count', { n: String(visibleMovements.length) })}
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
            {t('movements.totalsByCat')}
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
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('movements.incomeLabel')}</span>
                <span className="text-xs font-semibold" style={{ color: 'var(--accent-green)' }}>
                  {formatAmount(grandIncome)}
                </span>
              </div>
            )}
            {grandExpense > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('movements.expensesLabel')}</span>
                <span className="text-xs font-semibold" style={{ color: 'var(--accent-red)' }}>
                  {formatAmount(grandExpense)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('movements.balanceLabel')}</span>
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
