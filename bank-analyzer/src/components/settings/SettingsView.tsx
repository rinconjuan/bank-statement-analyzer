import { useTheme, THEME_DEFINITIONS } from '../../contexts/ThemeContext'
import { useBalanceStyle } from '../../contexts/BalanceStyleContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { CategoryEditor } from './CategoryEditor'
import { Category } from '../../services/api'

interface Props {
  categories: Category[]
  onCreate: (data: Omit<Category, 'id'>) => Promise<void>
  onUpdate: (id: number, data: Partial<Omit<Category, 'id'>>) => Promise<void>
  onDelete: (id: number, replacementCategoryId?: number) => Promise<void>
}

export function SettingsView({ categories, onCreate, onUpdate, onDelete }: Props) {
  const { theme, setTheme, availableThemes } = useTheme()
  const { balanceStyle, setBalanceStyle } = useBalanceStyle()
  const { t } = useLanguage()

  return (
    <div style={{ maxWidth: 760 }}>
      <h1 className="text-2xl font-semibold mb-8" style={{ color: 'var(--text-primary)' }}>
        ⚙️ {t('settings.title')}
      </h1>

      {/* ── Section 1: Apariencia ─────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
          {t('settings.appearance')}
        </h2>
        <div className="grid grid-cols-2 gap-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {availableThemes.map((item) => {
            const tc = THEME_DEFINITIONS[item.id]
            const isSelected = theme === item.id
            return (
              <button
                key={item.id}
                onClick={() => setTheme(item.id)}
                className="text-left rounded-xl transition-all"
                style={{
                  padding: 12,
                  background: tc.bgSecondary,
                  border: `2px solid ${isSelected ? tc.accentPrimary : tc.border}`,
                  boxShadow: isSelected ? `0 0 0 3px ${tc.accentPrimary}30` : 'none',
                  cursor: 'pointer',
                }}
              >
                {/* Mini app preview */}
                <div
                  className="rounded-lg mb-2.5 overflow-hidden"
                  style={{ background: tc.bgPrimary, padding: '6px 6px 5px 5px' }}
                >
                  <div className="flex gap-1.5">
                    {/* Simulated sidebar */}
                    <div className="flex flex-col gap-1 flex-shrink-0" style={{ width: 14 }}>
                      <div style={{ height: 4, borderRadius: 2, background: tc.accentPrimary }} />
                      <div style={{ height: 3, borderRadius: 2, background: tc.borderSubtle }} />
                      <div style={{ height: 3, borderRadius: 2, background: tc.borderSubtle }} />
                      <div style={{ height: 3, borderRadius: 2, background: tc.borderSubtle }} />
                    </div>
                    {/* Simulated main area */}
                    <div className="flex-1 flex flex-col gap-1.5">
                      {/* 4 KPI tiles row */}
                      <div className="flex gap-1">
                        {([tc.accentPrimary, tc.accentGreen, tc.accentAmber, tc.accentRed] as string[]).map((c, i) => (
                          <div
                            key={i}
                            style={{
                              flex: 1,
                              height: 14,
                              borderRadius: 3,
                              background: tc.bgTertiary,
                              borderTop: `2px solid ${c}`,
                            }}
                          />
                        ))}
                      </div>
                      {/* Simulated table rows */}
                      <div style={{ height: 5, borderRadius: 2, background: tc.bgTertiary }} />
                      <div style={{ height: 5, borderRadius: 2, background: tc.bgTertiary, opacity: 0.6 }} />
                    </div>
                  </div>
                </div>
                {/* Label row */}
                <div className="flex items-center justify-between gap-1">
                  <div>
                    <div className="text-xs font-semibold leading-tight" style={{ color: tc.textPrimary }}>{item.label}</div>
                    <div className="text-xs leading-tight mt-0.5" style={{ color: tc.textMuted }}>{item.description}</div>
                  </div>
                  {isSelected && (
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                      style={{ background: tc.accentPrimary, color: '#fff', fontWeight: 700 }}
                    >
                      ✓
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* ── Section 2: Estilo del panel de balance ────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
          {t('settings.balanceStyle')}
        </h2>
        <div className="flex gap-4">

          {/* KPI option (value 0) */}
          <button
            onClick={() => setBalanceStyle(0)}
            className="flex-1 text-left rounded-xl transition-all"
            style={{
              padding: 16,
              background: 'var(--bg-secondary)',
              border: `2px solid ${balanceStyle === 0 ? 'var(--accent-primary)' : 'var(--border)'}`,
              boxShadow: balanceStyle === 0 ? '0 0 0 3px var(--accent-primary)22' : 'none',
              cursor: 'pointer',
            }}
          >
            {/* Preview: 4 KPI tiles */}
            <div className="flex gap-1.5 mb-3">
              {(['var(--accent-primary)', 'var(--accent-green)', 'var(--accent-amber)', 'var(--accent-red)'] as string[]).map((c, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-lg flex flex-col justify-end"
                  style={{
                    background: 'var(--bg-tertiary)',
                    borderTop: `3px solid ${c}`,
                    padding: '5px 6px',
                    height: 42,
                  }}
                >
                  <div style={{ width: '50%', height: 3, background: c, opacity: 0.3, borderRadius: 2, marginBottom: 3 }} />
                  <div style={{ width: '75%', height: 5, background: c, opacity: 0.5, borderRadius: 2 }} />
                </div>
              ))}
            </div>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-sm font-semibold" style={{ color: balanceStyle === 0 ? 'var(--accent-primary)' : 'var(--text-primary)' }}>KPI</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{t('settings.kpiDesc')}</div>
              </div>
              {balanceStyle === 0 && (
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs"
                  style={{ background: 'var(--accent-primary)', color: '#fff', fontWeight: 700 }}
                >
                  ✓
                </div>
              )}
            </div>
          </button>

          {/* Mínimo option (value 3) */}
          <button
            onClick={() => setBalanceStyle(3)}
            className="flex-1 text-left rounded-xl transition-all"
            style={{
              padding: 16,
              background: 'var(--bg-secondary)',
              border: `2px solid ${balanceStyle === 3 ? 'var(--accent-primary)' : 'var(--border)'}`,
              boxShadow: balanceStyle === 3 ? '0 0 0 3px var(--accent-primary)22' : 'none',
              cursor: 'pointer',
            }}
          >
            {/* Preview: compact single bar */}
            <div
              className="mb-3 rounded-lg"
              style={{
                background: 'var(--bg-tertiary)',
                padding: '8px 10px',
                height: 42,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              {/* Top bar: income | expenses | balance */}
              <div className="flex items-center gap-2">
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-green)' }} />
                  <div style={{ width: 28, height: 4, borderRadius: 2, background: 'var(--accent-green)', opacity: 0.5 }} />
                </div>
                <div style={{ width: 1, height: 12, background: 'var(--border)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-red)' }} />
                  <div style={{ width: 22, height: 4, borderRadius: 2, background: 'var(--accent-red)', opacity: 0.5 }} />
                </div>
                <div style={{ width: 1, height: 12, background: 'var(--border)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-primary)' }} />
                  <div style={{ width: 18, height: 4, borderRadius: 2, background: 'var(--accent-primary)', opacity: 0.5 }} />
                </div>
              </div>
              {/* Bottom detail chips */}
              <div className="flex gap-1.5">
                {[0.8, 0.6, 0.4, 0.3].map((op, i) => (
                  <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--text-muted)', opacity: op }} />
                ))}
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-sm font-semibold" style={{ color: balanceStyle === 3 ? 'var(--accent-primary)' : 'var(--text-primary)' }}>Mínimo</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{t('settings.miniDesc')}</div>
              </div>
              {balanceStyle === 3 && (
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs"
                  style={{ background: 'var(--accent-primary)', color: '#fff', fontWeight: 700 }}
                >
                  ✓
                </div>
              )}
            </div>
          </button>

        </div>
      </section>

      {/* ── Section 3: Categorías ─────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
          {t('settings.categories')}
        </h2>
        <CategoryEditor
          categories={categories}
          onCreate={onCreate}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      </section>
    </div>
  )
}
