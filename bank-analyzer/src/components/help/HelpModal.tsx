import { useState } from 'react'

type HelpTab = 'dashboard' | 'mes_a_mes'

interface HelpModalProps {
  /** Which tab to open initially */
  initialTab?: HelpTab
  onClose: () => void
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div className="flex items-start justify-between py-1.5 px-3 rounded-lg mb-1"
      style={{ background: 'var(--bg-tertiary)' }}>
      <div>
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</div>
        {sub && <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
      </div>
      <span className="text-sm font-mono font-semibold ml-4 flex-shrink-0"
        style={{ color: color ?? 'var(--text-primary)' }}>
        {value}
      </span>
    </div>
  )
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg px-3 py-2.5 text-xs mb-4"
      style={{ background: 'rgba(79,127,255,0.1)', color: 'var(--accent-primary)', border: '1px solid rgba(79,127,255,0.2)' }}>
      {children}
    </div>
  )
}

function Formula({ text }: { text: string }) {
  return (
    <div className="rounded-lg px-3 py-2 text-xs font-mono mb-3"
      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
      {text}
    </div>
  )
}

function Divider() {
  return <div className="my-4" style={{ borderTop: '1px solid var(--border)' }} />
}

// ── Dashboard help content ────────────────────────────────────────────────────

function DashboardHelp() {
  return (
    <div>
      <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
        El Dashboard muestra un resumen rápido del mes seleccionado en la barra lateral. Las tarjetas y gráficas cambian según si el extracto es de una cuenta de ahorros o una tarjeta de crédito.
      </p>

      {/* ── Cuenta de ahorros ── */}
      <Section title="Cuenta de ahorros — Tarjetas de resumen">
        <Callout>
          💡 Ejemplo: en enero entraron <strong>$5.200.000</strong> (salario + otros) y salieron <strong>$3.800.000</strong> en gastos.
        </Callout>

        <Row
          label="↑ Ingresos"
          value={fmt(5_200_000)}
          color="var(--accent-green)"
          sub="Suma de todos los movimientos de tipo Ingreso del extracto."
        />
        <Row
          label="↓ Egresos"
          value={fmt(3_800_000)}
          color="var(--accent-red)"
          sub="Suma de todos los movimientos de tipo Egreso del extracto. Los traslados al Bolsillo no se cuentan para evitar duplicados."
        />
        <Row
          label="≈ Balance"
          value={fmt(1_400_000)}
          color="var(--accent-green)"
          sub="Diferencia entre Ingresos y Egresos del mes."
        />
        <Formula text="Balance = Ingresos − Egresos = $5.200.000 − $3.800.000 = $1.400.000" />

        <div className="mt-3 mb-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
          Saldo anterior y Saldo final (tarjeta Balance)
        </div>
        <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
          Estos valores se extraen directamente del encabezado del PDF del extracto. Representan el saldo real de la cuenta antes y después del período.
        </p>
        <Row label="Saldo anterior" value={fmt(3_200_000)} sub="Saldo al inicio del período, según el extracto." />
        <Row label="Saldo final" value={fmt(4_600_000)} color="var(--accent-green)" sub="Saldo al cierre del período. Verde si creció, rojo si bajó." />
      </Section>

      <Divider />

      {/* ── Tarjeta de crédito ── */}
      <Section title="Tarjeta de crédito — Tarjetas de resumen">
        <Callout>
          💡 Ejemplo: en el período se consumió <strong>$1.800.000</strong> y se abonaron <strong>$2.000.000</strong>.
        </Callout>

        <Row
          label="💳 Pagos/Abonos"
          value={fmt(2_000_000)}
          color="var(--accent-green)"
          sub="Total de pagos realizados a la tarjeta durante el período."
        />
        <Row
          label="↓ Consumos Totales"
          value={fmt(1_800_000)}
          color="var(--accent-red)"
          sub="Suma de todas las compras y consumos del período. Si abarca dos meses calendario, se muestra el desglose por mes."
        />
        <Row
          label="⚖️ Saldo Pendiente"
          value={fmt(200_000)}
          color="var(--accent-green)"
          sub="Pagos − Consumos. Verde ('A favor') si pagaste más de lo que consumiste; rojo ('Monto por pagar') en caso contrario."
        />
        <Formula text="Saldo Pendiente = Pagos − Consumos = $2.000.000 − $1.800.000 = +$200.000" />
        <Row
          label="💰 Pago total del período"
          value={fmt(1_800_000)}
          color="var(--accent-red)"
          sub="Valor para pagar el total de la deuda sin intereses, según el extracto."
        />
        <Row
          label="📋 Pago mínimo"
          value={fmt(270_000)}
          color="#ca8a04"
          sub="Monto mínimo requerido para no entrar en mora. Pagar solo el mínimo genera intereses sobre el resto."
        />
      </Section>

      <Divider />

      {/* ── Gráficas ── */}
      <Section title="Gráficas">
        <div className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
          <strong>🥧 Categorías:</strong> muestra el porcentaje que representa cada categoría de gasto sobre el total de egresos del mes activo.
        </div>
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          <strong>📊 Meses:</strong> compara los egresos de todos los extractos cargados para ver la evolución del gasto a lo largo del tiempo.
        </div>
      </Section>
    </div>
  )
}

// ── Mes a Mes help content ────────────────────────────────────────────────────

function MesAMesHelp() {
  return (
    <div>
      <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
        El Mes a Mes consolida todos los extractos (ahorros + tarjeta de crédito) que correspondan al mismo mes calendario para darte una visión completa de ese período.
      </p>

      {/* ── Estados ── */}
      <Section title="Estados del mes">
        <div className="flex flex-col gap-2 mb-3">
          {[
            { dot: '✅', label: 'Cerrado', desc: 'El mes ya terminó y tiene extractos de ahorro y de tarjeta de crédito cargados. El balance es definitivo.', bg: 'rgba(34,197,94,0.1)', color: '#16a34a' },
            { dot: '🔄', label: 'Activo', desc: 'El mes tiene extracto de ahorro pero aún falta el extracto de tarjeta de crédito, o el mes todavía está en curso.', bg: 'rgba(234,179,8,0.1)', color: '#ca8a04' },
            { dot: '⏳', label: 'Parcial', desc: 'Solo hay un tipo de extracto cargado para este mes.', bg: 'rgba(148,163,184,0.1)', color: '#64748b' },
          ].map((s) => (
            <div key={s.label} className="flex items-start gap-3 rounded-lg px-3 py-2.5"
              style={{ background: s.bg }}>
              <span className="text-base flex-shrink-0">{s.dot}</span>
              <div>
                <div className="text-xs font-semibold" style={{ color: s.color }}>{s.label}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Divider />

      {/* ── Qué entró ── */}
      <Section title="QUÉ ENTRÓ">
        <Callout>
          💡 Ejemplo: salario de <strong>$5.000.000</strong> el 3 ene + otros ingresos <strong>$200.000</strong>.
        </Callout>
        <Row label="💰 Salario" value={fmt(5_000_000)} color="var(--accent-green)" sub="Ingreso identificado como salario/nómina. Se usa la descripción y fecha del movimiento." />
        <Row label="Otros ingresos" value={fmt(200_000)} color="var(--accent-green)" sub="Suma de ingresos que no son salario ni traslados internos (ej. transferencias recibidas)." />
        <Row label="Total ingresos" value={fmt(5_200_000)} color="var(--accent-green)" sub="Salario + Otros ingresos." />
        <Formula text="Total ingresos = Salario + Otros ingresos = $5.000.000 + $200.000 = $5.200.000" />
      </Section>

      <Divider />

      {/* ── Qué salió ── */}
      <Section title="QUÉ SALIÓ">
        <Callout>
          💡 Ejemplo: pago Falabella <strong>$1.500.000</strong> + mercado <strong>$800.000</strong> + servicios <strong>$300.000</strong>.
        </Callout>
        <Row label="Gastos por categoría" value="varios" sub="Cada ítem agrupa los egresos de una categoría. El número entre paréntesis indica cuántas transacciones componen el total." />
        <Row label="Total salidas" value={fmt(2_600_000)} color="var(--accent-red)" sub="Suma de todos los egresos del mes (excluye traslados internos al Bolsillo)." />
      </Section>

      <Divider />

      {/* ── Resultado ── */}
      <Section title="RESULTADO">
        <Callout>
          💡 Siguiendo el ejemplo anterior: Total ingresos <strong>$5.200.000</strong> − Total salidas <strong>$2.600.000</strong> = <strong>+$2.600.000</strong>.
        </Callout>
        <Row label="Diferencia del mes" value={fmt(2_600_000)} color="var(--accent-green)" sub="Total ingresos − Total salidas. Verde si positivo (ahorraste), rojo si negativo (gastaste más de lo que entró)." />
        <Formula text="Diferencia = Total ingresos − Total salidas" />

        <div className="mt-3 mb-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
          Saldo Davivienda anterior / final
        </div>
        <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
          Tomados directamente del encabezado del PDF. El saldo final es el real que muestra el banco, incluyendo todos los débitos y créditos del período.
        </p>
        <Row label="🏦 Saldo anterior" value={fmt(3_200_000)} sub="Saldo de la cuenta al inicio del período según el extracto." />
        <Row label="🏦 Saldo final" value={fmt(4_600_000)} color="var(--accent-green)" sub="Saldo al cierre del período. 📈 si creció respecto al anterior, 📉 si bajó." />

        <div className="mt-3 mb-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
          Pago Falabella
        </div>
        <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
          Cuando el mes tiene tarjeta de crédito pendiente de pago, se muestra el próximo pago. Una vez confirmado (aparece en el extracto Davivienda), cambia el estado y se calcula el Ahorro real.
        </p>
        <Row label="⏳ Próximo pago Falabella" value={fmt(1_500_000)} color="var(--accent-red)" sub="Monto pendiente de salir de la cuenta. Todavía no descontado del saldo." />
        <Row label="✅ Pago Falabella confirmado" value={fmt(1_500_000)} color="var(--accent-red)" sub="El pago ya fue debitado de la cuenta Davivienda (se encontró en el extracto de ahorros)." />
        <Row label="Ahorro real del mes" value={fmt(1_100_000)} color="var(--accent-green)" sub="Diferencia del mes menos el pago confirmado de la tarjeta. Refleja cuánto ahorró el titular después de cubrir todas las deudas." />
        <Formula text="Ahorro real = Diferencia del mes − Pago Falabella confirmado" />
        <Formula text="Ahorro real = $2.600.000 − $1.500.000 = $1.100.000" />
      </Section>

      <Divider />

      {/* ── Patrimonio ── */}
      <Section title="PATRIMONIO">
        <Callout>
          💡 Esta sección solo aparece cuando el extracto Davivienda incluye datos de saldo (saldo anterior / nuevo saldo).
        </Callout>
        <Row label="🏦 Davivienda" value={fmt(4_600_000)} sub="Saldo total de la cuenta de ahorros al cierre del período." />
        <Row label="💰 En bolsillo (ahorro)" value={fmt(1_200_000)} color="var(--accent-green)" sub="Monto guardado en el Bolsillo Davivienda (cuenta de ahorro interna). Este dinero es parte del saldo total." />
        <Row label="💵 Disponible en cuenta" value={fmt(3_400_000)} sub="Saldo total − En bolsillo. Dinero disponible fuera del ahorro." />
        <Formula text="Disponible = Saldo total − Bolsillo = $4.600.000 − $1.200.000 = $3.400.000" />
        <Row label="📈 Ahorrado este mes" value={fmt(500_000)} color="var(--accent-green)" sub="Incremento del bolsillo respecto al mes anterior. Solo visible si aumentó." />
        <Row label="💳 Deuda Falabella" value={fmt(1_500_000)} color="var(--accent-red)" sub="Deuda pendiente con la tarjeta de crédito (monto total a pagar). Solo aparece si es > 0." />
        <Row label="Patrimonio neto" value={fmt(3_100_000)} color="var(--accent-green)" sub="Saldo Davivienda menos la deuda con Falabella. Verde si activo, rojo si las deudas superan el ahorro." />
        <Formula text="Patrimonio neto = Saldo Davivienda − Deuda Falabella" />
        <Formula text="Patrimonio neto = $4.600.000 − $1.500.000 = $3.100.000" />
      </Section>
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────

export function HelpModal({ initialTab = 'dashboard', onClose }: HelpModalProps) {
  const [tab, setTab] = useState<HelpTab>(initialTab)

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Panel */}
      <div
        className="relative flex flex-col rounded-2xl shadow-2xl"
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          width: '100%',
          maxWidth: 580,
          maxHeight: '85vh',
          margin: '0 1rem',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <span className="text-xl">❓</span>
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Ayuda — ¿Cómo funciona?
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-sm transition-opacity hover:opacity-70"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 pt-3 pb-0 gap-2 flex-shrink-0">
          {([
            { key: 'dashboard' as const, label: '📊 Dashboard' },
            { key: 'mes_a_mes' as const, label: '📅 Mes a Mes' },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="text-xs px-3 py-1.5 rounded-lg transition-all"
              style={{
                background: tab === key ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                color: tab === key ? '#fff' : 'var(--text-secondary)',
                border: '1px solid var(--border)',
                fontWeight: tab === key ? 600 : 400,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === 'dashboard' ? <DashboardHelp /> : <MesAMesHelp />}
        </div>
      </div>
    </div>
  )
}
