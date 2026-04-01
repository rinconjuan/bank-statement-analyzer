import { useEffect, useState } from 'react'
import { fetchCreditSummary, fetchMovements, CreditSummary, MonthWithStats, Movement } from '../../services/api'

function formatAmount(n: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  // dateStr is DD/MM/YYYY
  const parts = dateStr.split('/')
  if (parts.length !== 3) return null
  const day = Number(parts[0])
  const month = Number(parts[1])
  const year = Number(parts[2])
  if (!day || !month || !year || month < 1 || month > 12 || day < 1 || day > 31) return null
  const d = new Date(year, month - 1, day)
  if (isNaN(d.getTime())) return null
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function formatDateShort(dateStr: string): string {
  // DD/MM/YYYY → "15 dic"
  const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const parts = dateStr.split('/')
  if (parts.length !== 3) return dateStr
  const day = parseInt(parts[0], 10)
  const mon = parseInt(parts[1], 10)
  if (!day || !mon || mon < 1 || mon > 12) return dateStr
  return `${day} ${MONTH_SHORT[mon - 1]}`
}

interface Props {
  month: MonthWithStats
}

export function CreditCardSummary({ month }: Props) {
  const [summary, setSummary] = useState<CreditSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDeferidos, setShowDeferidos] = useState(false)
  const [deferidos, setDeferidos] = useState<Movement[]>([])
  const [loadingDeferidos, setLoadingDeferidos] = useState(false)
  const [showCuotaDetail, setShowCuotaDetail] = useState(false)
  const [selectedCuotaMes, setSelectedCuotaMes] = useState<string | null>(null)
  const [cuotaMovements, setCuotaMovements] = useState<Record<string, Movement[]>>({})
  const [loadingCuotaMes, setLoadingCuotaMes] = useState<string | null>(null)

  const monthNameToNumber: Record<string, number> = {
    Enero: 1,
    Febrero: 2,
    Marzo: 3,
    Abril: 4,
    Mayo: 5,
    Junio: 6,
    Julio: 7,
    Agosto: 8,
    Septiembre: 9,
    Octubre: 10,
    Noviembre: 11,
    Diciembre: 12,
  }

  const movementMonthLabel = (dateStr: string) => {
    const p = dateStr.split('/')
    if (p.length !== 3) return ''
    const y = Number(p[2])
    const m = Number(p[1])
    if (!y || !m || m < 1 || m > 12) return ''
    const monthName = Object.keys(monthNameToNumber).find((k) => monthNameToNumber[k] === m)
    return monthName ? `${monthName} ${y}` : ''
  }

  const loadCuotaMovements = async (mesLabel: string) => {
    if (cuotaMovements[mesLabel]) return
    setLoadingCuotaMes(mesLabel)
    try {
      const all = await fetchMovements({ month_id: month.id })
      const selected = all
        .filter((m) => !m.es_pago_tarjeta && m.type === 'Egreso' && movementMonthLabel(m.date) === mesLabel && (m.cuota_mes || 0) > 0)
        .sort((a, b) => {
          const toTs = (d: string) => {
            const p = d.split('/')
            return p.length === 3 ? new Date(+p[2], +p[1] - 1, +p[0]).getTime() : 0
          }
          return toTs(a.date) - toTs(b.date)
        })
      setCuotaMovements((prev) => ({ ...prev, [mesLabel]: selected }))
    } catch {
      setCuotaMovements((prev) => ({ ...prev, [mesLabel]: [] }))
    } finally {
      setLoadingCuotaMes(null)
    }
  }

  const handleDeferidosClick = async () => {
    if (showDeferidos) {
      setShowDeferidos(false)
      return
    }
    if (deferidos.length === 0) {
      setLoadingDeferidos(true)
      try {
        const all = await fetchMovements({ month_id: month.id })
        const statementYm = `${month.year}-${String(month.month).padStart(2, '0')}`
        const movementYm = (date: string) => {
          const p = date.split('/')
          return p.length === 3 ? `${p[2]}-${p[1]}` : ''
        }
        const sorted = all
          .filter(m => m.es_diferido_anterior && movementYm(m.date) < statementYm)
          .sort((a, b) => {
            // DD/MM/YYYY sort
            const toTs = (d: string) => {
              const p = d.split('/')
              return p.length === 3 ? new Date(+p[2], +p[1] - 1, +p[0]).getTime() : 0
            }
            return toTs(a.date) - toTs(b.date)
          })
        setDeferidos(sorted)
      } catch {
        // ignore
      } finally {
        setLoadingDeferidos(false)
      }
    }
    setShowDeferidos(true)
  }

  useEffect(() => {
    setLoading(true)
    setShowCuotaDetail(false)
    setSelectedCuotaMes(null)
    setCuotaMovements({})
    setLoadingCuotaMes(null)
    fetchCreditSummary(month.id)
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoading(false))
  }, [month.id])

  if (loading) {
    return (
      <div className="rounded-xl p-6 text-sm" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
        Cargando resumen tarjeta...
      </div>
    )
  }

  if (!summary) return null

  const diasLimite = daysUntil(summary.fecha_limite)
  const urgente = diasLimite !== null && diasLimite <= 7

  const cupoUsado = summary.cupo_total > 0 ? summary.cupo_total - summary.cupo_disponible : 0
  const cupoUsadoPct = summary.cupo_total > 0 ? Math.round((cupoUsado / summary.cupo_total) * 100) : 0
  const detailMonthOptions = summary.consumos_por_mes.filter((r) => r.total_cuota > 0)

  const toggleCuotaDetail = async () => {
    if (showCuotaDetail) {
      setShowCuotaDetail(false)
      return
    }

    let targetMonth = selectedCuotaMes
    const isCurrentSelectionValid = !!targetMonth && detailMonthOptions.some((m) => m.mes === targetMonth)
    if (!isCurrentSelectionValid) {
      targetMonth = detailMonthOptions[0]?.mes ?? null
      setSelectedCuotaMes(targetMonth)
    }

    setShowCuotaDetail(true)
    if (targetMonth) {
      await loadCuotaMovements(targetMonth)
    }
  }

  const handleDetailMonthChange = async (mesLabel: string) => {
    setSelectedCuotaMes(mesLabel)
    await loadCuotaMovements(mesLabel)
  }

  return (
    <div className="space-y-4">
      {/* ── Row 1: 3 summary cards ── */}
      <div className="grid grid-cols-3 gap-4">
        {/* Card 1: Pagaste */}
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Pagaste</span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--accent-green)' }}>
              ✓
            </div>
          </div>
          {summary.pago_realizado ? (
            <>
              <div className="font-display text-2xl tracking-tight" style={{ color: 'var(--accent-green)' }}>
                {formatAmount(summary.pago_realizado.amount)}
              </div>
              {summary.pago_realizado.count > 1 ? (
                <>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    entre el {formatDateShort(summary.pago_realizado.date)} y {formatDateShort(summary.pago_realizado.date_end ?? summary.pago_realizado.date)}
                  </div>
                  <div className="mt-2 flex flex-col gap-0.5">
                    {summary.pagos_realizados.map((p, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span style={{ color: 'var(--text-muted)' }}>{p.date}</span>
                        <span className="font-mono" style={{ color: 'var(--accent-green)' }}>{formatAmount(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  el {summary.pago_realizado.date}
                </div>
              )}
            </>
          ) : (
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Sin pago registrado</div>
          )}
        </div>

        {/* Card 2: Debes pagar */}
        <div
          className="rounded-xl p-5"
          style={{
            background: 'var(--bg-secondary)',
            border: `1px solid ${urgente ? 'var(--accent-red)' : 'var(--border)'}`,
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm truncate pr-2" style={{ color: 'var(--text-secondary)' }}>
              {summary.fecha_limite ? `Pagar antes del ${summary.fecha_limite}` : 'Pago total'}
            </span>
            {urgente && (
              <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--accent-red)' }}>
                {diasLimite === 0 ? '¡Hoy!' : `${diasLimite}d`}
              </span>
            )}
          </div>
          <div className="font-display text-2xl tracking-tight" style={{ color: 'var(--accent-red)' }}>
            {formatAmount(summary.pago_total)}
          </div>
          {summary.pago_minimo > 0 && (
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Mínimo: {formatAmount(summary.pago_minimo)}
            </div>
          )}
        </div>

        {/* Card 3: Cupo disponible */}
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Cupo disponible</span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: 'rgba(79,127,255,0.12)', color: 'var(--accent-primary)' }}>
              💳
            </div>
          </div>
          <div className="font-display text-2xl tracking-tight" style={{ color: 'var(--accent-primary)' }}>
            {formatAmount(summary.cupo_disponible)}
          </div>
          {summary.cupo_total > 0 && (
            <>
              <div className="mt-2 rounded-full overflow-hidden" style={{ height: 4, background: 'var(--bg-tertiary)' }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${cupoUsadoPct}%`, background: cupoUsadoPct > 80 ? 'var(--accent-red)' : 'var(--accent-primary)' }}
                />
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {cupoUsadoPct}% usado · total {formatAmount(summary.cupo_total)}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Row 2: Consumos por mes + Detalle lateral ── */}
      {summary.consumos_por_mes.length > 0 && (
        <div className="flex gap-4 items-start">
          {/* LEFT: Consumos por mes */}
          <div className="flex-1 min-w-0 rounded-xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-4 gap-3">
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Consumos por mes
              </div>
              <button
                type="button"
                onClick={toggleCuotaDetail}
                disabled={detailMonthOptions.length === 0}
                className="text-xs px-2.5 py-1 rounded-full"
                style={{
                  border: '1px solid var(--border)',
                  background: showCuotaDetail ? 'rgba(79,127,255,0.15)' : 'var(--bg-tertiary)',
                  color: showCuotaDetail ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  opacity: detailMonthOptions.length === 0 ? 0.5 : 1,
                  cursor: detailMonthOptions.length === 0 ? 'not-allowed' : 'pointer',
                }}
                title={detailMonthOptions.length === 0 ? 'No hay meses con cuota para detallar' : 'Mostrar detalle por mes'}
              >
                {showCuotaDetail ? 'Ocultar detalle' : 'Detalle'}
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {summary.consumos_por_mes.map((row) => (
                <div key={row.mes} className="flex items-center gap-3 px-2 py-1.5 rounded-lg">
                  <span className="text-sm w-32 flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>{row.mes}</span>
                  <span className="text-sm font-mono flex-1" style={{ color: 'var(--text-primary)' }}>{formatAmount(row.total_consumos)}</span>
                  <span className="text-xs font-mono w-36 text-right" style={{ color: row.aplica_extracto ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                    cuota: {formatAmount(row.total_cuota)}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{
                      background: row.aplica_extracto ? 'rgba(34,197,94,0.12)' : 'rgba(148,163,184,0.12)',
                      color: row.aplica_extracto ? 'var(--accent-green)' : 'var(--text-muted)',
                    }}
                  >
                    {row.aplica_extracto ? '🟢 Este extracto' : '🔵 Diferido'}
                  </span>
                </div>
              ))}
            </div>
            {/* Totals footer */}
            <div className="mt-4 pt-3 flex flex-col gap-1" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Total consumos reales este mes</span>
                <span className="text-sm font-semibold" style={{ color: 'var(--accent-green)' }}>{formatAmount(summary.total_consumos_nuevos)}</span>
              </div>
              {summary.total_diferidos > 0 && (
                <>
                  <div
                    className="flex items-center justify-between rounded px-1 -mx-1 cursor-pointer"
                    onClick={handleDeferidosClick}
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <span className="text-xs flex items-center gap-1">
                      Diferidos de meses anteriores
                      <span
                        className="text-xs"
                        style={{
                          display: 'inline-block',
                          transform: showDeferidos ? 'rotate(90deg)' : 'rotate(0deg)',
                          transition: 'transform 0.15s',
                          fontSize: '0.55rem',
                        }}
                      >▶</span>
                    </span>
                    <span className="text-sm font-semibold" style={{ textDecoration: 'underline dotted' }}>
                      {formatAmount(summary.total_diferidos)}
                    </span>
                  </div>
                  {showDeferidos && (
                    <div className="mt-2 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                      {loadingDeferidos ? (
                        <div className="text-xs p-3" style={{ color: 'var(--text-muted)' }}>Cargando movimientos...</div>
                      ) : deferidos.length === 0 ? (
                        <div className="text-xs p-3" style={{ color: 'var(--text-muted)' }}>Sin movimientos diferidos</div>
                      ) : (
                        <div className="max-h-52 overflow-auto">
                          <table className="w-full" style={{ fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr>
                                <th className="px-3 py-2 text-left font-medium sticky top-0 z-10" style={{ color: 'var(--text-muted)', background: 'var(--bg-tertiary)' }}>Fecha</th>
                                <th className="px-3 py-2 text-left font-medium sticky top-0 z-10" style={{ color: 'var(--text-muted)', background: 'var(--bg-tertiary)' }}>Descripción</th>
                                <th className="px-3 py-2 text-right font-medium sticky top-0 z-10" style={{ color: 'var(--text-muted)', background: 'var(--bg-tertiary)' }}>Valor</th>
                              </tr>
                            </thead>
                            <tbody>
                              {deferidos.map((m) => (
                                <tr key={m.id} style={{ borderTop: '1px solid var(--border)' }}>
                                  <td className="px-3 py-1.5 font-mono whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{m.date}</td>
                                  <td className="px-3 py-1.5" style={{ color: 'var(--text-primary)' }}>{m.description}</td>
                                  <td className="px-3 py-1.5 font-mono text-right whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{formatAmount(m.amount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* RIGHT: Detalle de cuotas (animated slide-in from right) */}
          <div
            style={{
              flexShrink: 0,
              width: showCuotaDetail ? '45%' : '0',
              overflow: 'hidden',
              opacity: showCuotaDetail ? 1 : 0,
              transform: showCuotaDetail ? 'translateX(0)' : 'translateX(16px)',
              transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease, transform 0.25s ease',
              pointerEvents: showCuotaDetail ? 'auto' : 'none',
            }}
          >
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', minWidth: '280px' }}>
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Detalle de cuotas por mes
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Mes:</label>
                  <select
                    value={selectedCuotaMes ?? ''}
                    onChange={(e) => handleDetailMonthChange(e.target.value)}
                    className="text-xs rounded px-2 py-1"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                  >
                    {detailMonthOptions.map((m) => (
                      <option key={m.mes} value={m.mes}>{m.mes}</option>
                    ))}
                  </select>
                </div>
              </div>

              {!selectedCuotaMes ? (
                <div className="text-xs p-3" style={{ color: 'var(--text-muted)' }}>No hay meses con cuota para detallar.</div>
              ) : loadingCuotaMes === selectedCuotaMes ? (
                <div className="text-xs p-3" style={{ color: 'var(--text-muted)' }}>Cargando movimientos...</div>
              ) : (cuotaMovements[selectedCuotaMes] ?? []).length === 0 ? (
                <div className="text-xs p-3" style={{ color: 'var(--text-muted)' }}>
                  No hay movimientos con cuota en este mes.
                </div>
              ) : (
                <div className="max-h-64 overflow-auto rounded-lg" style={{ border: '1px solid var(--border)' }}>
                  <table className="w-full" style={{ fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th className="px-3 py-2 text-left font-medium sticky top-0 z-10" style={{ color: 'var(--text-muted)', background: 'var(--bg-tertiary)' }}>Fecha</th>
                        <th className="px-3 py-2 text-left font-medium sticky top-0 z-10" style={{ color: 'var(--text-muted)', background: 'var(--bg-tertiary)' }}>Descripción</th>
                        <th className="px-3 py-2 text-right font-medium sticky top-0 z-10" style={{ color: 'var(--text-muted)', background: 'var(--bg-tertiary)' }}>Cuota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(cuotaMovements[selectedCuotaMes] ?? []).map((m) => (
                        <tr key={m.id} style={{ borderTop: '1px solid var(--border)' }}>
                          <td className="px-3 py-1.5 font-mono whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{m.date}</td>
                          <td className="px-3 py-1.5" style={{ color: 'var(--text-primary)' }}>{m.description}</td>
                          <td className="px-3 py-1.5 font-mono text-right whitespace-nowrap" style={{ color: 'var(--accent-green)' }}>
                            {formatAmount(m.cuota_mes || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg-tertiary)' }}>
                        <td className="px-3 py-2 font-semibold" colSpan={2} style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                          Total cuotas {selectedCuotaMes}
                        </td>
                        <td className="px-3 py-2 font-mono font-semibold text-right" style={{ color: 'var(--accent-green)' }}>
                          {formatAmount((cuotaMovements[selectedCuotaMes] ?? []).reduce((sum, m) => sum + (m.cuota_mes || 0), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
