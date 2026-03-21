import { MonthWithStats } from '../../services/api'

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const STATEMENT_TYPE_ICON: Record<string, string> = {
  cuenta_ahorro: '🏦',
  tarjeta_credito: '💳',
}

interface SidebarProps {
  months: MonthWithStats[]
  activeMonthId: number | null
  onSelectMonth: (id: number) => void
  onUploadClick: () => void
  onDeleteMonth: (id: number) => void
  activeView: 'dashboard' | 'por_mes' | 'tendencias' | 'resumen' | 'settings'
  onViewChange: (v: 'dashboard' | 'por_mes' | 'tendencias' | 'resumen' | 'settings') => void
}

export function Sidebar({ months, activeMonthId, onSelectMonth, onUploadClick, onDeleteMonth, activeView, onViewChange }: SidebarProps) {
  return (
    <aside
      className="flex flex-col h-full w-64 flex-shrink-0"
      style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}
    >
      {/* Logo */}
      <div className="px-5 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏦</span>
          <div>
            <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Bank Analyzer</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Análisis financiero</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="px-3 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={() => onViewChange('dashboard')}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all mb-1"
          style={{
            background: activeView === 'dashboard' ? 'var(--accent-primary)' : 'transparent',
            color: activeView === 'dashboard' ? '#fff' : 'var(--text-secondary)',
          }}
        >
          <span>📊</span> Dashboard
        </button>
        <button
          onClick={() => onViewChange('por_mes')}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all mb-1"
          style={{
            background: activeView === 'por_mes' ? 'var(--accent-primary)' : 'transparent',
            color: activeView === 'por_mes' ? '#fff' : 'var(--text-secondary)',
          }}
        >
          <span>📅</span> Por Mes
        </button>
        <button
          onClick={() => onViewChange('tendencias')}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all mb-1"
          style={{
            background: activeView === 'tendencias' ? 'var(--accent-primary)' : 'transparent',
            color: activeView === 'tendencias' ? '#fff' : 'var(--text-secondary)',
          }}
        >
          <span>📈</span> Tendencias
        </button>
        <button
          onClick={() => onViewChange('resumen')}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all mb-1"
          style={{
            background: activeView === 'resumen' ? 'var(--accent-primary)' : 'transparent',
            color: activeView === 'resumen' ? '#fff' : 'var(--text-secondary)',
          }}
        >
          <span>🗂️</span> Resumen
        </button>
        <button
          onClick={() => onViewChange('settings')}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all"
          style={{
            background: activeView === 'settings' ? 'var(--accent-primary)' : 'transparent',
            color: activeView === 'settings' ? '#fff' : 'var(--text-secondary)',
          }}
        >
          <span>⚙️</span> Categorías
        </button>
      </nav>

      {/* Months header */}
      <div className="px-5 py-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          Meses
        </span>
        <button
          onClick={onUploadClick}
          className="w-6 h-6 rounded flex items-center justify-center text-sm transition-all hover:opacity-80"
          style={{ background: 'var(--accent-primary)', color: '#fff' }}
          title="Cargar nuevo extracto"
        >
          +
        </button>
      </div>

      {/* Months list */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {months.length === 0 ? (
          <div className="text-center py-8 px-4">
            <div className="text-3xl mb-2">📄</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Carga tu primer extracto bancario
            </div>
          </div>
        ) : (
          months.map((m) => {
            const isActive = m.id === activeMonthId
            return (
              <div
                key={m.id}
                onClick={() => onSelectMonth(m.id)}
                className="group relative flex items-center justify-between px-3 py-2 rounded-lg mb-1 cursor-pointer transition-all"
                style={{
                  background: isActive ? 'rgba(79,127,255,0.15)' : 'transparent',
                  border: isActive ? '1px solid rgba(79,127,255,0.3)' : '1px solid transparent',
                }}
              >
                <div className="min-w-0">
                  <div
                    className="text-sm font-medium truncate"
                    style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)' }}
                  >
                    {STATEMENT_TYPE_ICON[m.statement_type] ?? '🏦'} {MONTH_NAMES[m.month - 1]} {m.year}
                  </div>
                  <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    {m.bank_name ? `${m.bank_name} · ` : ''}{m.movements_count} movs
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteMonth(m.id) }}
                  className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-xs transition-all hover:bg-red-500/20"
                  style={{ color: 'var(--accent-red)' }}
                  title="Eliminar mes"
                >
                  ×
                </button>
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}
