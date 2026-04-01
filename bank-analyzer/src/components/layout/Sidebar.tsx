import { useEffect, useRef, useState } from 'react'
import { MonthWithStats } from '../../services/api'
import { useLanguage } from '../../contexts/LanguageContext'
import { useTheme } from '../../contexts/ThemeContext'

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
  const { theme, setTheme, availableThemes } = useTheme()
  const [showThemeMenu, setShowThemeMenu] = useState(false)
  const themeMenuRef = useRef<HTMLDivElement | null>(null)
  const MONTH_NAMES = lang === 'en'
    ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    : ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!themeMenuRef.current) return
      if (!themeMenuRef.current.contains(event.target as Node)) {
        setShowThemeMenu(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [])

  return (
    <aside
      className="flex flex-col h-full w-64 flex-shrink-0"
      style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}
    >
      {/* Logo */}
      <div className="px-5 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏦</span>
            <div>
              <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Bank Analyzer</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('sidebar.tagline')}</div>
            </div>
          </div>

          <div className="relative" ref={themeMenuRef}>
            <button
              onClick={() => setShowThemeMenu((v) => !v)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all hover:opacity-90"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
              title="Tema visual"
              aria-label="Abrir selector de tema"
            >
              ⚙
            </button>

            {showThemeMenu && (
              <div
                className="absolute top-10 right-0 w-44 rounded-xl p-2 z-50"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', boxShadow: '0 12px 24px rgba(0,0,0,0.25)' }}
              >
                <div className="px-2 pb-2 text-xs" style={{ color: 'var(--text-muted)' }}>Tema visual</div>
                <div className="space-y-1">
                  {availableThemes.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setTheme(item.id)
                        setShowThemeMenu(false)
                      }}
                      className="w-full text-left px-2 py-2 rounded-lg text-sm transition-all"
                      style={{
                        background: theme === item.id ? 'var(--accent-primary)' : 'transparent',
                        color: theme === item.id ? '#fff' : 'var(--text-secondary)',
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
          <span>📊</span> {t('nav.dashboard')}
        </button>
        <button
          onClick={() => onViewChange('mes_a_mes')}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all mb-1"
          style={{
            background: activeView === 'mes_a_mes' ? 'var(--accent-primary)' : 'transparent',
            color: activeView === 'mes_a_mes' ? '#fff' : 'var(--text-secondary)',
          }}
        >
          <span>📅</span> {t('nav.mesAMes')}
        </button>
        <button
          onClick={() => onViewChange('tendencias')}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all mb-1"
          style={{
            background: activeView === 'tendencias' ? 'var(--accent-primary)' : 'transparent',
            color: activeView === 'tendencias' ? '#fff' : 'var(--text-secondary)',
          }}
        >
          <span>📈</span> {t('nav.tendencias')}
        </button>
        <button
          onClick={() => onViewChange('settings')}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all"
          style={{
            background: activeView === 'settings' ? 'var(--accent-primary)' : 'transparent',
            color: activeView === 'settings' ? '#fff' : 'var(--text-secondary)',
          }}
        >
          <span>🗂️</span> {t('nav.categorias')}
        </button>
      </nav>

      {/* Months header */}
      <div className="px-5 py-3 flex items-center justify-between">
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

      {/* Months list */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {months.length === 0 ? (
          <div className="text-center py-8 px-4">
            <div className="text-3xl mb-2">📄</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {t('sidebar.noStatements')}
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
