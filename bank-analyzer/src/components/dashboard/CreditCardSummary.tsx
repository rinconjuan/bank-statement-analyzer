import { useEffect, useState } from 'react'
import { fetchCreditSummary, fetchMovements, CreditSummary, MonthWithStats, Movement } from '../../services/api'
import { useLanguage } from '../../contexts/LanguageContext'

function formatAmount(n: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
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
  const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const parts = dateStr.split('/')
  if (parts.length !== 3) return dateStr
  const day = parseInt(parts[0], 10)
  const mon = parseInt(parts[1], 10)
  if (!day || !mon || mon < 1 || mon > 12) return dateStr
  return `${day} ${MONTH_SHORT[mon - 1]}`
}

function toTimestamp(dateStr: string): number {
  const p = dateStr.split('/')
  return p.length === 3 ? new Date(+p[2], +p[1] - 1, +p[0]).getTime() : 0
}

interface Props {
  month: MonthWithStats
}

export function CreditCardSummary({ month }: Props) {
  const { t } = useLanguage()
  const [summary, setSummary] = useState<CreditSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCuotaMes, setSelectedCuotaMes] = useState<string | null>(null)
  const [cuotaMovements, setCuotaMovements] = useState<Record<string, Movement[]>>({})
  const [loadingCuotas, setLoadingCuotas] = useState(false)

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

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setSelectedCuotaMes(null)
      setCuotaMovements({})
      setLoadingCuotas(true)
      try {
        const s = await fetchCreditSummary(month.id)
        if (cancelled) return
        setSummary(s)

        const all = await fetchMovements({ month_id: month.id })
        if (cancelled) return

        const monthsWithQuota = new Set(s.consumos_por_mes.filter((row) => row.total_cuota > 0).map((row) => row.mes))
        const grouped: Record<string, Movement[]> = {}

        all
          .filter((m) => !m.es_pago_tarjeta && m.type === 'Egreso' && (m.cuota_mes || 0) > 0)
          .forEach((m) => {
            const label = movementMonthLabel(m.date)
            if (!label || !monthsWithQuota.has(label)) return
            if (!grouped[label]) grouped[label] = []
            grouped[label].push(m)
          })

        for (const key of Object.keys(grouped)) {
          grouped[key].sort((a, b) => toTimestamp(a.date) - toTimestamp(b.date))
        }

        setCuotaMovements(grouped)
        const firstMonth = s.consumos_por_mes.find((row) => row.total_cuota > 0)?.mes ?? null
        setSelectedCuotaMes(firstMonth)
      } catch {
        if (!cancelled) setSummary(null)
      } finally {
        if (!cancelled) {
          setLoading(false)
          setLoadingCuotas(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [month.id])

  if (loading) {
    return (
      <div className="rounded-xl p-6 text-sm" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
        {t('creditCard.loading')}
      </div>
    )
  }

  if (!summary) return null

  const diasLimite = daysUntil(summary.fecha_limite)
  const urgente = diasLimite !== null && diasLimite <= 7

  const cupoUsado = summary.cupo_total > 0 ? summary.cupo_total - summary.cupo_disponible : 0
  const cupoUsadoPct = summary.cupo_total > 0 ? Math.round((cupoUsado / summary.cupo_total) * 100) : 0
  const detailMonths = summary.consumos_por_mes.filter((row) => row.total_cuota > 0)
  const activeMonth = selectedCuotaMes ?? detailMonths[0]?.mes ?? null
  const activeMonthSummary = summary.consumos_por_mes.find((row) => row.mes === activeMonth) ?? null
  const activeMonthRows = activeMonth ? (cuotaMovements[activeMonth] ?? []) : []
  const activeMonthLabel = activeMonth ? activeMonth.split(' ')[0] : 'Mes'
  const activeMonthTotalCuota = activeMonthRows.reduce((sum, m) => sum + (m.cuota_mes || 0), 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('creditCard.paid')}</span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--accent-green)' }}>✓</div>
          </div>
          {summary.pago_realizado ? (
            <>
              <div className="font-display text-2xl tracking-tight" style={{ color: 'var(--accent-green)' }}>{formatAmount(summary.pago_realizado.amount)}</div>
              {summary.pago_realizado.count > 1 ? (
                <>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {t('creditCard.between', { from: formatDateShort(summary.pago_realizado.date), to: formatDateShort(summary.pago_realizado.date_end ?? summary.pago_realizado.date) })}
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
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('creditCard.on', { date: summary.pago_realizado.date })}</div>
              )}
            </>
          ) : (
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('creditCard.noPay')}</div>
          )}
        </div>

        <div className="rounded-xl p-5" style={{ background: 'var(--bg-secondary)', border: `1px solid ${urgente ? 'var(--accent-red)' : 'var(--border)'}` }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm truncate pr-2" style={{ color: 'var(--text-secondary)' }}>
              {summary.fecha_limite ? t('creditCard.payBefore', { date: summary.fecha_limite }) : t('creditCard.totalPayment')}
            </span>
            {urgente && (
              <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--accent-red)' }}>
                {diasLimite === 0 ? t('creditCard.today') : `${diasLimite}d`}
              </span>
            )}
          </div>
          <div className="font-display text-2xl tracking-tight" style={{ color: 'var(--accent-red)' }}>{formatAmount(summary.pago_total)}</div>
          {summary.pago_minimo > 0 && (
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('creditCard.minPayment', { amount: formatAmount(summary.pago_minimo) })}</div>
          )}
        </div>

        <div className="rounded-xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('creditCard.creditLimit')}</span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: 'rgba(79,127,255,0.12)', color: 'var(--accent-primary)' }}>💳</div>
          </div>
          <div className="font-display text-2xl tracking-tight" style={{ color: 'var(--accent-primary)' }}>{formatAmount(summary.cupo_disponible)}</div>
          {summary.cupo_total > 0 && (
            <>
              <div className="mt-2 rounded-full overflow-hidden" style={{ height: 4, background: 'var(--bg-tertiary)' }}>
                <div className="h-full rounded-full" style={{ width: `${cupoUsadoPct}%`, background: cupoUsadoPct > 80 ? 'var(--accent-red)' : 'var(--accent-primary)' }} />
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('creditCard.usedPct', { pct: String(cupoUsadoPct), total: formatAmount(summary.cupo_total) })}</div>
            </>
          )}
        </div>
      </div>

      {summary.consumos_por_mes.length > 0 && (
        <div className="grid grid-cols-2 max-[900px]:grid-cols-1 gap-4 items-stretch">
          <div
            className="rounded-xl p-4 w-full min-w-0 flex flex-col"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              minHeight: 180,
              maxHeight: 300,
            }}
          >
            <div className="flex items-center justify-between mb-2 gap-3">
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('creditCard.spendByMonth')}</div>
            </div>

            <div className="rounded-lg overflow-hidden" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
              <div>
                <table className="w-full" style={{ fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold sticky top-0 z-10" style={{ color: 'var(--text-secondary)', background: 'var(--bg-tertiary)' }}>{t('creditCard.colMonth')}</th>
                      <th className="px-3 py-2 text-right font-semibold sticky top-0 z-10" style={{ color: 'var(--text-secondary)', background: 'var(--bg-tertiary)' }}>{t('creditCard.colValue')}</th>
                      <th className="px-3 py-2 text-right font-semibold sticky top-0 z-10" style={{ color: 'var(--text-secondary)', background: 'var(--bg-tertiary)' }}>{t('creditCard.colInstallment')}</th>
                      <th className="px-3 py-2 text-center font-semibold sticky top-0 z-10" style={{ color: 'var(--text-secondary)', background: 'var(--bg-tertiary)' }}>{t('creditCard.colStatus')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.consumos_por_mes.map((row) => {
                      const isSelected = activeMonth === row.mes
                      const hasDetail = row.total_cuota > 0
                      return (
                        <tr
                          key={row.mes}
                          onClick={hasDetail ? () => setSelectedCuotaMes(row.mes) : undefined}
                          style={{
                            borderTop: '1px solid var(--border)',
                            background: isSelected ? 'rgba(79,127,255,0.10)' : 'transparent',
                            cursor: hasDetail ? 'pointer' : 'default',
                          }}
                        >
                          <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{row.mes}</td>
                          <td className="px-3 py-2 font-mono text-right whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{formatAmount(row.total_consumos)}</td>
                          <td className="px-3 py-2 font-mono text-right whitespace-nowrap" style={{ color: row.aplica_extracto ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                            {row.total_cuota > 0 ? formatAmount(row.total_cuota) : '—'}
                          </td>
                          <td className="px-3 py-2 text-center whitespace-nowrap">
                            <span
                              className="text-[11px] px-2 py-0.5 rounded-full"
                              style={{
                                background: row.aplica_extracto ? 'rgba(34,197,94,0.12)' : 'rgba(148,163,184,0.12)',
                                color: row.aplica_extracto ? 'var(--accent-green)' : 'var(--text-muted)',
                              }}
                            >
                              {row.aplica_extracto ? t('creditCard.thisStatement') : t('creditCard.deferred')}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: '12px', lineHeight: '2', color: 'var(--text-muted)' }}>
                <div className="flex items-center justify-between">
                  <span>{t('creditCard.footnoteSpend', { month: activeMonthLabel })}</span>
                  <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{formatAmount(activeMonthSummary?.total_consumos || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t('creditCard.footnoteInstallment', { month: activeMonthLabel })}</span>
                  <span className="font-mono" style={{ color: 'var(--accent-green)' }}>{formatAmount(activeMonthTotalCuota)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t('creditCard.footnotePayment')}</span>
                  <span className="font-mono" style={{ color: 'var(--accent-red)' }}>{formatAmount(summary.pago_total)}</span>
                </div>
              </div>
            </div>
          </div>

          <div
            className="rounded-xl p-4 w-full min-w-0 flex flex-col"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              minHeight: 180,
              maxHeight: 300,
            }}
          >
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Detalle {activeMonth ? `· ${activeMonth}` : ''}
              </div>
            </div>

            <div className="rounded-lg flex-1 min-h-0" style={{ border: '1px solid var(--border)' }}>
              <div
                style={{
                  height: '100%',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                }}
              >
                <table className="w-full" style={{ fontSize: '0.71rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium sticky top-0 z-10" style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)' }}>{t('creditCard.detailColDate')}</th>
                      <th className="px-2 py-1.5 text-left font-medium sticky top-0 z-10" style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)' }}>{t('creditCard.detailColMovement')}</th>
                      <th className="px-2 py-1.5 text-right font-medium sticky top-0 z-10" style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)' }}>{t('creditCard.detailColValue')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingCuotas ? (
                      <tr>
                        <td className="px-2 py-3 text-xs" colSpan={3} style={{ color: 'var(--text-muted)' }}>{t('creditCard.detailLoading')}</td>
                      </tr>
                    ) : activeMonthRows.length === 0 ? (
                      <tr>
                        <td className="px-2 py-3 text-xs" colSpan={3} style={{ color: 'var(--text-muted)' }}>{t('creditCard.detailEmpty')}</td>
                      </tr>
                    ) : (
                      activeMonthRows.map((m) => (
                        <tr key={m.id} style={{ borderTop: '1px solid var(--border)' }}>
                          <td className="px-2 py-1.5 font-mono whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{m.date}</td>
                          <td className="px-2 py-1.5" style={{ color: 'var(--text-primary)' }}>{m.description}</td>
                          <td className="px-2 py-1.5 font-mono text-right whitespace-nowrap" style={{ color: 'var(--accent-green)' }}>{formatAmount(m.cuota_mes || 0)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg-tertiary)' }}>
                      <td className="px-2 py-1.5 font-semibold" colSpan={2} style={{ color: 'var(--text-secondary)', fontSize: '0.68rem' }}>
                        {`Total ${activeMonthLabel}`}
                      </td>
                      <td className="px-2 py-1.5 font-mono font-semibold text-right" style={{ color: 'var(--accent-green)' }}>
                        {formatAmount(activeMonthTotalCuota)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
