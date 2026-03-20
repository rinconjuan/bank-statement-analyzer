import { useState, useRef, useCallback } from 'react'
import { uploadStatement, UploadResponse } from '../../services/api'

interface UploadZoneProps {
  onUploaded: (response: UploadResponse) => void
  onCancel: () => void
}

const STATEMENT_TYPES = [
  { value: 'cuenta_ahorro',   label: 'Cuenta de Ahorro',  icon: '🏦' },
  { value: 'tarjeta_credito', label: 'Tarjeta de Crédito', icon: '💳' },
  { value: 'tarjeta_debito',  label: 'Tarjeta Débito',    icon: '💴' },
]

export function UploadZone({ onUploaded, onCancel }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<UploadResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [statementType, setStatementType] = useState('cuenta_ahorro')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Solo se aceptan archivos PDF')
      return
    }
    setUploading(true)
    setError(null)
    try {
      const result = await uploadStatement(file, statementType)
      setPreview(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar el archivo')
    } finally {
      setUploading(false)
    }
  }, [statementType])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

  const selectedType = STATEMENT_TYPES.find(t => t.value === statementType)!

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div
        className="rounded-2xl p-6 w-full max-w-lg mx-4 relative"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
      >
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-lg"
          style={{ color: 'var(--text-muted)', background: 'var(--bg-tertiary)' }}
        >
          ×
        </button>

        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          Cargar extracto bancario
        </h2>

        {!preview ? (
          <>
            {/* Statement type selector */}
            <div className="mb-4">
              <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Tipo de extracto
              </div>
              <div className="flex gap-2">
                {STATEMENT_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setStatementType(t.value)}
                    className="flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-xs font-medium transition-all"
                    style={{
                      background: statementType === t.value ? 'rgba(79,127,255,0.15)' : 'var(--bg-tertiary)',
                      border: statementType === t.value ? '1px solid rgba(79,127,255,0.5)' : '1px solid var(--border)',
                      color: statementType === t.value ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    }}
                  >
                    <span className="text-base">{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all"
              style={{
                borderColor: dragging ? 'var(--accent-primary)' : 'var(--border-subtle)',
                background: dragging ? 'rgba(79,127,255,0.05)' : 'var(--bg-tertiary)',
              }}
            >
              <div className="text-4xl mb-3">{uploading ? '⏳' : selectedType.icon}</div>
              <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                {uploading ? 'Procesando...' : 'Arrastra tu PDF aquí'}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {uploading ? '' : `${selectedType.label} · haz clic para seleccionar`}
              </div>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            {error && (
              <div className="mt-3 text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--accent-red)' }}>
                {error}
              </div>
            )}
          </>
        ) : (
          <div>
            <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="text-2xl">✅</div>
                <div>
                  <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                    {MONTH_NAMES[preview.month - 1]} {preview.year}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {preview.movements_count} movimientos encontrados · {selectedType.icon} {selectedType.label}
                  </div>
                </div>
              </div>
              <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Vista previa:</div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {preview.preview.map((m) => (
                  <div key={m.id} className="flex justify-between text-xs py-1" style={{ borderBottom: '1px solid var(--border)' }}>
                    <span className="truncate flex-1 mr-2" style={{ color: 'var(--text-secondary)' }}>{m.description}</span>
                    <span style={{ color: m.type === 'Ingreso' ? 'var(--accent-green)' : 'var(--accent-red)', whiteSpace: 'nowrap' }}>
                      {m.type === 'Ingreso' ? '+' : '-'}${m.amount.toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onUploaded(preview)}
                className="flex-1 py-2.5 rounded-xl font-medium text-sm transition-all hover:opacity-90"
                style={{ background: 'var(--accent-primary)', color: '#fff' }}
              >
                Confirmar y ver dashboard
              </button>
              <button
                onClick={() => { setPreview(null); setError(null) }}
                className="px-4 py-2.5 rounded-xl text-sm"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
              >
                Cargar otro
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
