import { useState } from 'react'
import { MonthWithStats } from '../../services/api'
import { useLanguage } from '../../contexts/LanguageContext'

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
  activeView: 'dashboard' | 'mes_a_mes' | 'tendencias' | 'settings'
  onViewChange: (v: 'dashboard' | 'mes_a_mes' | 'tendencias' | 'settings') => void
}

export function Sidebar({ months, activeMonthId, onSelectMonth, onUploadClick, onDeleteMonth, activeView, onViewChange }: SidebarProps) {
  const { lang, t } = useLanguage()
  const [collapsed, setCollapsed] = useState(false)
  const MONTH_NAMES = lang === 'en'
    ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    : ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

  const NAV_ITEMS = [
    { view: 'dashboard'  as const, icon: '📊', labelKey: 'nav.dashboard'   },
    { view: 'mes_a_mes'  as const, icon: '📅', labelKey: 'nav.mesAMes'     },
    { view: 'tendencias' as const, icon: '📈', labelKey: 'nav.tendencias'  },
    { view: 'settings'   as const, icon: '⚙️', labelKey: 'nav.settings'    },
  ]

  return (
    <aside
      className="flex flex-col h-full flex-shrink-0 transition-all duration-200"
      style={{
        width: collapsed ? 64 : 256,
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* ── Logo / header ── */}
      <div
        className="flex items-center justify-between flex-shrink-0"
        style={{
          padding: collapsed ? '14px 0' : '20px',
          borderBottom: '1px solid var(--border)',
          justifyContent: collapsed ? 'center' : 'space-between',
        }}
      >
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl">🏦</span>
            <div className="min-w-0">
              <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Bank Analyzer</div>
              <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{t('sidebar.tagline')}</div>
            </div>
          </div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(v => !v)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-base transition-all hover:opacity-80 flex-shrink-0"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          title={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      {/* ── Navigation ── */}
      <nav
        className="flex flex-col py-3 flex-shrink-0"
        style={{
          borderBottom: '1px solid var(--border)',
          padding: collapsed ? '12px 0' : '12px',
          alignItems: collapsed ? 'center' : 'stretch',
          gap: 4,
        }}
      >
        {NAV_ITEMS.map(({ view, icon, labelKey }) => (
          <button
            key={view}
            onClick={() => onViewChange(view)}
            title={collapsed ? t(labelKey) : undefined}
            className="flex items-center rounded-lg transition-all"
            style={{
              gap: collapsed ? 0 : 8,
              padding: collapsed ? '10px 0' : '8px 12px',
              width: collapsed ? 44 : '100%',
              height: collapsed ? 44 : undefined,
              justifyContent: collapsed ? 'center' : 'flex-start',
              background: activeView === view ? 'var(--accent-primary)' : 'transparent',
              color: activeView === view ? '#fff' : 'var(--text-secondary)',
            }}
          >
            <span style={{ fontSize: collapsed ? 20 : 16 }}>{icon}</span>
            {!collapsed && <span className="text-sm">{t(labelKey)}</span>}
          </button>
        ))}
      </nav>

      {/* ── Months header ── */}
      {!collapsed && (
        <div className="px-5 py-3 flex items-center justify-between flex-shrink-0">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            {t('sidebar.months')}
          </span>
          <button
            onClick={onUploadClick}
            className="w-6 h-6 rounded flex items-center justify-center text-sm transition-all hover:opacity-80"
            style={{ background: 'var(--accent-primary)', color: '#fff' }}
            title={t('sidebar.uploadTooltip')}
          >
            +
          </button>
        </div>
      )}
      {collapsed && (
        <button
          onClick={onUploadClick}
          className="flex-shrink-0 flex items-center justify-center transition-all hover:opacity-80"
          style={{ height: 44, fontSize: 20, color: 'var(--accent-primary)' }}
          title={t('sidebar.uploadTooltip')}
        >
          +
        </button>
      )}

      {/* ── Months list ── */}
      <div className="flex-1 overflow-y-auto pb-4" style={{ padding: collapsed ? '0 0 16px 0' : undefined }}>
        {months.length === 0 && !collapsed ? (
          <div className="text-center py-8 px-4">
            <div className="text-3xl mb-2">📄</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {t('sidebar.noStatements')}
            </div>
          </div>
        ) : (
          months.map((m) => {
            const isActive = m.id === activeMonthId
            const icon = STATEMENT_TYPE_ICON[m.statement_type] ?? '🏦'
            if (collapsed) {
              return (
                <button
                  key={m.id}
                  onClick={() => onSelectMonth(m.id)}
                  title={`${icon} ${MONTH_NAMES[m.month - 1]} ${m.year}${m.bank_name ? ' · ' + m.bank_name : ''}`}
                  className="w-full flex items-center justify-center transition-all"
                  style={{
                    height: 44,
                    fontSize: 20,
                    background: isActive ? 'rgba(79,127,255,0.15)' : 'transparent',
                    borderLeft: isActive ? '3px solid var(--accent-primary)' : '3px solid transparent',
                  }}
                >
                  {icon}
                </button>
              )
            }
            return (
              <div
                key={m.id}
                onClick={() => onSelectMonth(m.id)}
                className="group relative flex items-center justify-between px-3 py-2 rounded-lg mb-1 cursor-pointer transition-all mx-3"
                style={{
                  background: isActive ? 'rgba(79,127,255,0.15)' : 'transparent',
                  border: isActive ? '1px solid rgba(79,127,255,0.3)' : '1px solid transparent',
                }}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                    {icon} {MONTH_NAMES[m.month - 1]} {m.year}
                  </div>
                  <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    {m.bank_name ? `${m.bank_name} · ` : ''}{m.movements_count} {t('mesAMes.movs')}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteMonth(m.id) }}
                  className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-xs transition-all hover:bg-red-500/20"
                  style={{ color: 'var(--accent-red)' }}
                  title={t('sidebar.confirmDelete')}
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


