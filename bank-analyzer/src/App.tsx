import { useState, useCallback, useMemo } from 'react'
import { Sidebar } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { SummaryCards } from './components/dashboard/SummaryCards'
import { CategoryChart } from './components/dashboard/CategoryChart'
import { MonthlyChart } from './components/dashboard/MonthlyChart'
import { MovementsTable } from './components/movements/MovementsTable'
import { UploadZone } from './components/upload/UploadZone'
import { CategoryEditor } from './components/settings/CategoryEditor'
import { useMonths } from './hooks/useMonths'
import { useMovements } from './hooks/useMovements'
import { useCategories } from './hooks/useCategories'
import { UploadResponse } from './services/api'

export default function App() {
  const [activeMonthId, setActiveMonthId] = useState<number | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [activeView, setActiveView] = useState<'dashboard' | 'settings'>('dashboard')
  const [filters, setFilters] = useState<{ category_id?: number; type?: string; search?: string }>({})

  const { months, refresh: refreshMonths, remove: removeMonth } = useMonths()
  const { categories, create: createCategory, update: updateCategory, remove: removeCategory } = useCategories()

  const movementFilters = useMemo(() => ({
    month_id: activeMonthId ?? undefined,
    ...filters,
  }), [activeMonthId, filters])

  const { movements, summary, loading: movementsLoading, refresh: refreshMovements } = useMovements(movementFilters)

  const activeMonth = useMemo(() => months.find((m) => m.id === activeMonthId) ?? null, [months, activeMonthId])

  const handleUploaded = useCallback(async (response: UploadResponse) => {
    setShowUpload(false)
    await refreshMonths()
    setActiveMonthId(response.month_id)
    setActiveView('dashboard')
  }, [refreshMonths])

  const handleDeleteMonth = useCallback(async (id: number) => {
    if (!window.confirm('¿Eliminar este mes y todos sus movimientos?')) return
    await removeMonth(id)
    if (activeMonthId === id) setActiveMonthId(null)
  }, [removeMonth, activeMonthId])

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar
        months={months}
        activeMonthId={activeMonthId}
        onSelectMonth={(id) => { setActiveMonthId(id); setActiveView('dashboard') }}
        onUploadClick={() => setShowUpload(true)}
        onDeleteMonth={handleDeleteMonth}
        activeView={activeView}
        onViewChange={setActiveView}
      />

      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar activeMonth={activeMonth} onUploadClick={() => setShowUpload(true)} />

        <main className="flex-1 overflow-y-auto p-6">
          {activeView === 'settings' ? (
            <CategoryEditor
              categories={categories}
              onCreate={createCategory}
              onUpdate={updateCategory}
              onDelete={removeCategory}
            />
          ) : activeMonthId === null ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="text-6xl">🏦</div>
              <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                Bienvenido a Bank Analyzer
              </h2>
              <p style={{ color: 'var(--text-secondary)' }}>
                Carga tu extracto bancario para comenzar
              </p>
              <button
                onClick={() => setShowUpload(true)}
                className="px-6 py-3 rounded-xl font-medium text-sm hover:opacity-90 transition-all"
                style={{ background: 'var(--accent-primary)', color: '#fff' }}
              >
                + Cargar extracto PDF
              </button>
            </div>
          ) : (
            <div className="space-y-6 max-w-6xl">
              <SummaryCards summary={summary} statementType={activeMonth?.statement_type} />
              <div className="grid grid-cols-2 gap-4">
                <CategoryChart summary={summary} />
                <MonthlyChart months={months} />
              </div>
              <MovementsTable
                movements={movements}
                categories={categories}
                onFiltersChange={setFilters}
                onRefresh={refreshMovements}
                loading={movementsLoading}
              />
            </div>
          )}
        </main>
      </div>

      {showUpload && (
        <UploadZone onUploaded={handleUploaded} onCancel={() => setShowUpload(false)} />
      )}
    </div>
  )
}
