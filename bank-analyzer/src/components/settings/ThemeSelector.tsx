import { useTheme, type ThemeName } from '../../contexts/ThemeContext'

export function ThemeSelector() {
  const { theme, setTheme, availableThemes } = useTheme()

  return (
    <div
      className="rounded-xl p-6 mb-6"
      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
    >
      <div className="mb-4">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          🎨 Tema Visual
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Elige tu tema visual preferido
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {availableThemes.map((t) => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id as ThemeName)}
            className="relative rounded-lg p-4 transition-all text-left"
            style={{
              background: theme === t.id ? 'var(--accent-primary)' : 'var(--bg-secondary)',
              border: theme === t.id ? '2px solid var(--accent-primary)' : '1px solid var(--border)',
              opacity: theme === t.id ? 1 : 0.7,
            }}
          >
            <div style={{ color: theme === t.id ? '#fff' : 'var(--text-primary)' }}>
              <div className="font-semibold text-sm">{t.label}</div>
              <div className="text-xs mt-1" style={{ color: theme === t.id ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)' }}>
                {t.description}
              </div>
            </div>
            {theme === t.id && (
              <div
                className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ background: 'rgba(255,255,255,0.3)' }}
              >
                ✓
              </div>
            )}
          </button>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          <p>
            <strong>Dark:</strong> Tema oscuro clásico
          </p>
          <p className="mt-1">
            <strong>Light:</strong> Tema claro minimalista
          </p>
          <p className="mt-1">
            <strong>Ocean:</strong> Tema moderno en tonos cian
          </p>
          <p className="mt-1">
            <strong>Sunset:</strong> Tema cálido con tonos naranja
          </p>
        </div>
      </div>
    </div>
  )
}
