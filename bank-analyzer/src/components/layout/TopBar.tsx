import { MonthWithStats } from '../../services/api'
import { getExportUrl } from '../../services/api'
import { useLanguage } from '../../contexts/LanguageContext'

const MONTH_NAMES_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const MONTH_NAMES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

interface TopBarProps {
  activeMonth: MonthWithStats | null
  onUploadClick: () => void
}

export function TopBar({ activeMonth, onUploadClick }: TopBarProps) {
  const { lang, setLang, t } = useLanguage()
  const MONTH_NAMES = lang === 'en' ? MONTH_NAMES_EN : MONTH_NAMES_ES

  const handleExport = (type: 'csv' | 'excel' | 'report') => {
    if (!activeMonth) return
    const url = getExportUrl(type, activeMonth.id)
    window.open(url, '_blank')
  }

  return (
    <header
      className="flex items-center justify-between px-6 py-3 flex-shrink-0"
      style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', height: '56px' }}
    >
      <div>
        {activeMonth ? (
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {MONTH_NAMES[activeMonth.month - 1]} {activeMonth.year}
            </h1>
            {activeMonth.bank_name && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
              >
                {activeMonth.bank_name}
              </span>
            )}
          </div>
        ) : (
          <h1 className="text-base font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {t('topBar.selectMonth')}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Language toggle */}
        <button
          onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
          className="text-xs px-2.5 py-1.5 rounded-lg transition-all hover:opacity-80 font-semibold"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          title={lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
        >
          🌐 {lang === 'es' ? 'ES' : 'EN'}
        </button>

        {activeMonth && (
          <>
            <button
              onClick={() => handleExport('csv')}
              className="text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              📥 CSV
            </button>
            <button
              onClick={() => handleExport('excel')}
              className="text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              📊 Excel
            </button>
            <button
              onClick={() => handleExport('report')}
              className="text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              📄 {lang === 'es' ? 'Reporte' : 'Report'}
            </button>
          </>
        )}
        <button
          onClick={onUploadClick}
          className="text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-80 font-medium"
          style={{ background: 'var(--accent-primary)', color: '#fff' }}
        >
          {t('topBar.newStatement')}
        </button>
      </div>
    </header>
  )
}
