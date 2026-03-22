import { useState } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import { Lang } from '../../i18n/translations'

type HelpTab = 'dashboard' | 'mes_a_mes' | 'tendencias'

interface HelpModalProps {
  /** Which tab to open initially */
  initialTab?: HelpTab
  onClose: () => void
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}

/** Pick between Spanish and English content inline */
function l<T>(lang: Lang, es: T, en: T): T {
  return lang === 'en' ? en : es
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

function Row({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: React.ReactNode }) {
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

function DashboardHelp({ lang }: { lang: Lang }) {
  return (
    <div>
      <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
        {l(lang,
          'El Dashboard muestra un resumen rápido del mes seleccionado en la barra lateral. Las tarjetas y gráficas cambian según si el extracto es de una cuenta de ahorros o una tarjeta de crédito.',
          'The Dashboard shows a quick summary of the month selected in the sidebar. Cards and charts change depending on whether the statement is from a savings account or a credit card.',
        )}
      </p>

      {/* ── Cuenta de ahorros ── */}
      <Section title={l(lang, 'Cuenta de ahorros — Tarjetas de resumen', 'Savings account — Summary cards')}>
        <Callout>
          💡 {l(lang,
            <>Ejemplo: en enero entraron <strong>$5.200.000</strong> (salario + otros) y salieron <strong>$3.800.000</strong> en gastos.</>,
            <>Example: in January <strong>$5,200,000</strong> came in (salary + other) and <strong>$3,800,000</strong> went out in expenses.</>,
          )}
        </Callout>

        <Row
          label={l(lang, '↑ Ingresos', '↑ Income')}
          value={fmt(5_200_000)}
          color="var(--accent-green)"
          sub={l(lang,
            'Suma de todos los movimientos de tipo Ingreso del extracto.',
            'Sum of all Income-type movements in the statement.',
          )}
        />
        <Row
          label={l(lang, '↓ Egresos', '↓ Expenses')}
          value={fmt(3_800_000)}
          color="var(--accent-red)"
          sub={l(lang,
            'Suma de todos los movimientos de tipo Egreso del extracto. Los traslados al Bolsillo no se cuentan para evitar duplicados.',
            'Sum of all Expense-type movements. Internal pocket transfers are excluded to avoid double-counting.',
          )}
        />
        <Row
          label={l(lang, '≈ Balance', '≈ Balance')}
          value={fmt(1_400_000)}
          color="var(--accent-green)"
          sub={l(lang, 'Diferencia entre Ingresos y Egresos del mes.', 'Difference between Income and Expenses for the month.')}
        />
        <Formula text={l(lang,
          'Balance = Ingresos − Egresos = $5.200.000 − $3.800.000 = $1.400.000',
          'Balance = Income − Expenses = $5,200,000 − $3,800,000 = $1,400,000',
        )} />

        <div className="mt-3 mb-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
          {l(lang, 'Saldo anterior y Saldo final (tarjeta Balance)', 'Previous balance and Final balance (Balance card)')}
        </div>
        <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
          {l(lang,
            'Estos valores se extraen directamente del encabezado del PDF del extracto. Representan el saldo real de la cuenta antes y después del período.',
            'These values are extracted directly from the statement PDF header. They represent the real account balance before and after the period.',
          )}
        </p>
        <Row label={l(lang, 'Saldo anterior', 'Previous balance')} value={fmt(3_200_000)} sub={l(lang, 'Saldo al inicio del período, según el extracto.', 'Balance at the start of the period, per the statement.')} />
        <Row label={l(lang, 'Saldo final', 'Final balance')} value={fmt(4_600_000)} color="var(--accent-green)" sub={l(lang, 'Saldo al cierre del período. Verde si creció, rojo si bajó.', 'Balance at end of period. Green if it grew, red if it dropped.')} />
      </Section>

      <Divider />

      {/* ── Tarjeta de crédito ── */}
      <Section title={l(lang, 'Tarjeta de crédito — Tarjetas de resumen', 'Credit card — Summary cards')}>
        <Callout>
          💡 {l(lang,
            <>Ejemplo: en el período se consumió <strong>$1.800.000</strong> y se abonaron <strong>$2.000.000</strong>.</>,
            <>Example: in the period <strong>$1,800,000</strong> was charged and <strong>$2,000,000</strong> was paid.</>,
          )}
        </Callout>

        <Row
          label={l(lang, '💳 Pagos/Abonos', '💳 Payments')}
          value={fmt(2_000_000)}
          color="var(--accent-green)"
          sub={l(lang, 'Total de pagos realizados a la tarjeta durante el período.', 'Total payments made to the card during the period.')}
        />
        <Row
          label={l(lang, '↓ Consumos Totales', '↓ Total Charges')}
          value={fmt(1_800_000)}
          color="var(--accent-red)"
          sub={l(lang,
            'Suma de todas las compras y consumos del período. Si abarca dos meses calendario, se muestra el desglose por mes.',
            'Sum of all purchases and charges for the period. If it spans two calendar months, a monthly breakdown is shown.',
          )}
        />
        <Row
          label={l(lang, '⚖️ Saldo Pendiente', '⚖️ Outstanding Balance')}
          value={fmt(200_000)}
          color="var(--accent-green)"
          sub={l(lang,
            "Pagos − Consumos. Verde ('A favor') si pagaste más de lo que consumiste; rojo ('Monto por pagar') en caso contrario.",
            "Payments − Charges. Green ('In your favor') if you paid more than charged; red ('Amount due') otherwise.",
          )}
        />
        <Formula text={l(lang,
          'Saldo Pendiente = Pagos − Consumos = $2.000.000 − $1.800.000 = +$200.000',
          'Outstanding Balance = Payments − Charges = $2,000,000 − $1,800,000 = +$200,000',
        )} />
        <Row
          label={l(lang, '💰 Pago total del período', '💰 Total payment for the period')}
          value={fmt(1_800_000)}
          color="var(--accent-red)"
          sub={l(lang, 'Valor para pagar el total de la deuda sin intereses, según el extracto.', 'Amount to pay the total debt without interest, per the statement.')}
        />
        <Row
          label={l(lang, '📋 Pago mínimo', '📋 Minimum payment')}
          value={fmt(270_000)}
          color="#ca8a04"
          sub={l(lang,
            'Monto mínimo requerido para no entrar en mora. Pagar solo el mínimo genera intereses sobre el resto.',
            'Minimum amount required to avoid default. Paying only the minimum generates interest on the remainder.',
          )}
        />
      </Section>

      <Divider />

      {/* ── Gráficas ── */}
      <Section title={l(lang, 'Gráficas', 'Charts')}>
        <div className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
          <strong>🥧 {l(lang, 'Categorías', 'Categories')}:</strong>{' '}
          {l(lang,
            'muestra el porcentaje que representa cada categoría de gasto sobre el total de egresos del mes activo.',
            'shows the percentage each expense category represents of total expenses for the active month.',
          )}
        </div>
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          <strong>📊 {l(lang, 'Meses', 'Months')}:</strong>{' '}
          {l(lang,
            'compara los egresos de todos los extractos cargados para ver la evolución del gasto a lo largo del tiempo.',
            'compares expenses across all loaded statements to track spending evolution over time.',
          )}
        </div>
      </Section>
    </div>
  )
}

// ── Mes a Mes help content ────────────────────────────────────────────────────

function MesAMesHelp({ lang }: { lang: Lang }) {
  return (
    <div>
      <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
        {l(lang,
          'El Mes a Mes consolida todos los extractos (ahorros + tarjeta de crédito) que correspondan al mismo mes calendario para darte una visión completa de ese período.',
          'Month by Month consolidates all statements (savings + credit card) that correspond to the same calendar month, giving you a complete view of that period.',
        )}
      </p>

      {/* ── Estados ── */}
      <Section title={l(lang, 'Estados del mes', 'Month statuses')}>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              dot: '✅',
              label: l(lang, 'Cerrado', 'Closed'),
              desc: l(lang,
                'El balance es definitivo. Dos casos: (a) tienes ambos extractos (ahorros + tarjeta) y ya cargaste el mes siguiente, o (b) solo usas débito y el extracto de ahorros está disponible.',
                'The balance is final. Two cases: (a) you have both statements (savings + credit card) and the next month has already been uploaded, or (b) you only use debit and the savings statement is available.',
              ),
              bg: 'rgba(34,197,94,0.1)', color: '#16a34a',
            },
            {
              dot: '🔄',
              label: l(lang, 'Activo', 'Active'),
              desc: l(lang,
                'Tienes los extractos de ahorros y tarjeta para este mes pero aún no está disponible el extracto del mes siguiente. El balance puede variar.',
                'You have both statements for this month but the next month\'s statement is not yet available. The balance may change.',
              ),
              bg: 'rgba(234,179,8,0.1)', color: '#ca8a04',
            },
            {
              dot: '⏳',
              label: l(lang, 'Parcial', 'Partial'),
              desc: l(lang,
                'Falta al menos un extracto. Puede ser: (a) solo tienes tarjeta pero no el extracto de ahorros, o (b) ya has cargado tarjetas en otros meses pero a este mes le falta la de Falabella.',
                'At least one statement is missing. Either (a) you only have a credit card but no savings statement, or (b) you have credit cards in other months but this month\'s is missing.',
              ),
              bg: 'rgba(148,163,184,0.1)', color: '#64748b',
            },
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
        <Callout>
          💡 {l(lang,
            <><strong>¿Solo usas cuenta de débito?</strong> Si nunca has cargado una tarjeta de crédito, tus meses con extracto de ahorros se marcarán directamente como ✅ <strong>Cerrado</strong> — no es necesario subir ningún extracto adicional. El aviso "Sin extracto Falabella" solo aparece si ya tienes tarjeta de crédito cargada en algún otro mes.</>,
            <><strong>Debit only?</strong> If you have never uploaded a credit card statement, months with a savings statement will be marked ✅ <strong>Closed</strong> — no additional upload is needed. The "No credit statement" notice only appears if a credit card exists in another month.</>,
          )}
        </Callout>
      </Section>

      <Divider />

      {/* ── Qué entró ── */}
      <Section title={l(lang, 'QUÉ ENTRÓ', 'INCOME')}>
        <Callout>
          💡 {l(lang,
            <>Ejemplo: salario de <strong>$5.000.000</strong> el 3 ene + otros ingresos <strong>$200.000</strong>.</>,
            <>Example: salary of <strong>$5,000,000</strong> on Jan 3 + other income <strong>$200,000</strong>.</>,
          )}
        </Callout>
        <Row label={l(lang, '💰 Salario', '💰 Salary')} value={fmt(5_000_000)} color="var(--accent-green)" sub={l(lang, 'Ingreso identificado como salario/nómina. Se usa la descripción y fecha del movimiento.', 'Income identified as salary/payroll. Based on the movement description and date.')} />
        <Row label={l(lang, 'Otros ingresos', 'Other income')} value={fmt(200_000)} color="var(--accent-green)" sub={l(lang, 'Suma de ingresos que no son salario ni traslados internos (ej. transferencias recibidas).', 'Sum of income that is not salary or internal transfers (e.g. received bank transfers).')} />
        <Row label={l(lang, 'Total ingresos', 'Total income')} value={fmt(5_200_000)} color="var(--accent-green)" sub={l(lang, 'Salario + Otros ingresos.', 'Salary + Other income.')} />
        <Formula text={l(lang,
          'Total ingresos = Salario + Otros ingresos = $5.000.000 + $200.000 = $5.200.000',
          'Total income = Salary + Other income = $5,000,000 + $200,000 = $5,200,000',
        )} />
      </Section>

      <Divider />

      {/* ── Qué salió ── */}
      <Section title={l(lang, 'QUÉ SALIÓ', 'EXPENSES')}>
        <Callout>
          💡 {l(lang,
            <>Ejemplo: pago Falabella <strong>$1.500.000</strong> + mercado <strong>$800.000</strong> + servicios <strong>$300.000</strong>.</>,
            <>Example: credit card payment <strong>$1,500,000</strong> + groceries <strong>$800,000</strong> + utilities <strong>$300,000</strong>.</>,
          )}
        </Callout>
        <Row label={l(lang, 'Gastos por categoría', 'Expenses by category')} value={l(lang, 'varios', 'various')} sub={l(lang, 'Cada ítem agrupa los egresos de una categoría. El número entre paréntesis indica cuántas transacciones componen el total.', 'Each item groups expenses for a category. The number in parentheses shows how many transactions make up the total.')} />
        <Row label={l(lang, 'Total salidas', 'Total expenses')} value={fmt(2_600_000)} color="var(--accent-red)" sub={l(lang, 'Suma de todos los egresos del mes (excluye traslados internos al Bolsillo).', 'Sum of all outflows for the month (excludes internal pocket transfers).')} />
      </Section>

      <Divider />

      {/* ── Resultado ── */}
      <Section title={l(lang, 'RESULTADO', 'RESULT')}>
        <Callout>
          💡 {l(lang,
            <>Siguiendo el ejemplo anterior: Total ingresos <strong>$5.200.000</strong> − Total salidas <strong>$2.600.000</strong> = <strong>+$2.600.000</strong>.</>,
            <>Following the example: Total income <strong>$5,200,000</strong> − Total expenses <strong>$2,600,000</strong> = <strong>+$2,600,000</strong>.</>,
          )}
        </Callout>
        <Row label={l(lang, 'Diferencia del mes', 'Month difference')} value={fmt(2_600_000)} color="var(--accent-green)" sub={l(lang, 'Total ingresos − Total salidas. Verde si positivo (ahorraste), rojo si negativo (gastaste más de lo que entró).', 'Total income − Total expenses. Green if positive (you saved), red if negative (you spent more than you earned).')} />
        <Formula text={l(lang, 'Diferencia = Total ingresos − Total salidas', 'Difference = Total income − Total expenses')} />

        <div className="mt-3 mb-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
          {l(lang, 'Saldo anterior / final', 'Previous / final balance')}
        </div>
        <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
          {l(lang,
            'Tomados directamente del encabezado del PDF. El saldo final es el real que muestra el banco, incluyendo todos los débitos y créditos del período.',
            'Taken directly from the PDF header. The final balance is the real figure shown by the bank, including all debits and credits for the period.',
          )}
        </p>
        <Row label={l(lang, '🏦 Saldo anterior', '🏦 Previous balance')} value={fmt(3_200_000)} sub={l(lang, 'Saldo de la cuenta al inicio del período según el extracto.', 'Account balance at the start of the period per the statement.')} />
        <Row label={l(lang, '🏦 Saldo final', '🏦 Final balance')} value={fmt(4_600_000)} color="var(--accent-green)" sub={l(lang, 'Saldo al cierre del período. 📈 si creció respecto al anterior, 📉 si bajó.', 'Balance at end of period. 📈 if it grew vs the previous one, 📉 if it dropped.')} />

        <div className="mt-3 mb-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
          {l(lang, 'Pago tarjeta de crédito', 'Credit card payment')}
        </div>
        <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
          {l(lang,
            'Cuando el mes tiene tarjeta de crédito pendiente de pago, se muestra el próximo pago. Una vez confirmado (aparece en el extracto de ahorros), cambia el estado y se calcula el Ahorro real.',
            'When the month has a pending credit card payment, the next payment is shown. Once confirmed (it appears in the savings statement), the status changes and Real savings is calculated.',
          )}
        </p>
        <Row label={l(lang, '⏳ Próximo pago tarjeta', '⏳ Next card payment')} value={fmt(1_500_000)} color="var(--accent-red)" sub={l(lang, 'Monto pendiente de salir de la cuenta. Todavía no descontado del saldo.', 'Amount pending to leave the account. Not yet deducted from the balance.')} />
        <Row label={l(lang, '✅ Pago tarjeta confirmado', '✅ Card payment confirmed')} value={fmt(1_500_000)} color="var(--accent-red)" sub={l(lang, 'El pago ya fue debitado de la cuenta de ahorros (se encontró en el extracto de ahorros).', 'The payment has already been debited from the savings account (found in the savings statement).')} />
        <Row label={l(lang, 'Ahorro real del mes', 'Real savings for the month')} value={fmt(1_100_000)} color="var(--accent-green)" sub={l(lang, 'Diferencia del mes menos el pago confirmado de la tarjeta. Refleja cuánto ahorró el titular después de cubrir todas las deudas.', 'Month difference minus the confirmed card payment. Shows how much the account holder saved after covering all debts.')} />
        <Formula text={l(lang, 'Ahorro real = Diferencia del mes − Pago tarjeta confirmado', 'Real savings = Month difference − Confirmed card payment')} />
        <Formula text={l(lang, 'Ahorro real = $2.600.000 − $1.500.000 = $1.100.000', 'Real savings = $2,600,000 − $1,500,000 = $1,100,000')} />
      </Section>

      <Divider />

      {/* ── Patrimonio ── */}
      <Section title={l(lang, 'PATRIMONIO', 'NET WORTH')}>
        <Callout>
          💡 {l(lang,
            'Esta sección solo aparece cuando el extracto de ahorros incluye datos de saldo (saldo anterior / nuevo saldo).',
            'This section only appears when the savings statement includes balance data (previous balance / new balance).',
          )}
        </Callout>
        <Row label={l(lang, '🏦 Cuenta ahorros', '🏦 Savings account')} value={fmt(4_600_000)} sub={l(lang, 'Saldo total de la cuenta de ahorros al cierre del período.', 'Total savings account balance at the end of the period.')} />
        <Row label={l(lang, '💰 En bolsillo (ahorro)', '💰 In savings pocket')} value={fmt(1_200_000)} color="var(--accent-green)" sub={l(lang, 'Monto guardado en el Bolsillo (cuenta de ahorro interna). Este dinero es parte del saldo total.', 'Amount saved in the Pocket (internal savings account). This is included in the total balance.')} />
        <Row label={l(lang, '💵 Disponible en cuenta', '💵 Available in account')} value={fmt(3_400_000)} sub={l(lang, 'Saldo total − En bolsillo. Dinero disponible fuera del ahorro.', 'Total balance − Pocket. Money available outside the savings pocket.')} />
        <Formula text={l(lang, 'Disponible = Saldo total − Bolsillo = $4.600.000 − $1.200.000 = $3.400.000', 'Available = Total balance − Pocket = $4,600,000 − $1,200,000 = $3,400,000')} />
        <Row label={l(lang, '📈 Ahorrado este mes', '📈 Saved this month')} value={fmt(500_000)} color="var(--accent-green)" sub={l(lang, 'Incremento del bolsillo respecto al mes anterior. Solo visible si aumentó.', 'Increase in the pocket vs the previous month. Only visible if it increased.')} />
        <Row label={l(lang, '💳 Deuda tarjeta', '💳 Card debt')} value={fmt(1_500_000)} color="var(--accent-red)" sub={l(lang, 'Deuda pendiente con la tarjeta de crédito (monto total a pagar). Solo aparece si es > 0.', 'Outstanding credit card debt (total amount to pay). Only shown if > 0.')} />
        <Row label={l(lang, 'Patrimonio neto', 'Net worth')} value={fmt(3_100_000)} color="var(--accent-green)" sub={l(lang, 'Saldo cuenta de ahorros menos la deuda con la tarjeta. Verde si activo, rojo si las deudas superan el ahorro.', 'Savings balance minus card debt. Green if positive, red if debts exceed savings.')} />
        <Formula text={l(lang, 'Patrimonio neto = Saldo ahorros − Deuda tarjeta', 'Net worth = Savings balance − Card debt')} />
        <Formula text={l(lang, 'Patrimonio neto = $4.600.000 − $1.500.000 = $3.100.000', 'Net worth = $4,600,000 − $1,500,000 = $3,100,000')} />
      </Section>
    </div>
  )
}

// ── Trends help content ───────────────────────────────────────────────────────

function TrendsHelp({ lang }: { lang: Lang }) {
  return (
    <div>
      <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
        {l(lang,
          'Tendencias analiza todos tus extractos cargados y calcula patrones de gasto, evolución del ahorro y cargos que se repiten mes a mes.',
          'Trends analyzes all your uploaded statements and calculates spending patterns, savings evolution, and recurring charges across months.',
        )}
      </p>

      {/* ── Tarjetas de resumen ── */}
      <Section title={l(lang, 'Tarjetas de resumen', 'Summary cards')}>
        <Callout>
          💡 {l(lang,
            'Necesitas al menos 2 extractos cargados para ver tendencias.',
            'You need at least 2 uploaded statements to see trends.',
          )}
        </Callout>
        <Row
          label={l(lang, 'Tendencia general', 'Overall trend')}
          value="↑ 15%"
          color="var(--accent-red)"
          sub={l(lang,
            'Compara el total de egresos del primer extracto vs. el último. ↑ si subió más del 5%, ↓ si bajó más del 5%, → si es estable.',
            'Compares total expenses of the first statement vs. the last. ↑ if up more than 5%, ↓ if down more than 5%, → if stable.',
          )}
        />
        <Row
          label={l(lang, 'Categorías en alza', 'Rising categories')}
          value="↑ 3"
          color="var(--accent-red)"
          sub={l(lang,
            'Número de categorías que han aumentado más del 10% entre el primer y el último período analizado.',
            'Number of categories that have increased more than 10% between the first and last analyzed period.',
          )}
        />
        <Row
          label={l(lang, 'Cargos recurrentes', 'Recurring charges')}
          value="🔄 5"
          sub={l(lang,
            'Transacciones con descripción similar detectadas en 2 o más extractos. Sirve para identificar suscripciones.',
            'Transactions with similar descriptions detected in 2 or more statements. Useful for identifying subscriptions.',
          )}
        />
      </Section>

      <Divider />

      {/* ── Gastos por extracto ── */}
      <Section title={l(lang, 'Gastos por extracto', 'Expenses per statement')}>
        <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
          {l(lang,
            'Gráfica de barras que muestra el total de egresos de cada extracto cargado, ordenados cronológicamente. Cada barra representa un extracto.',
            'Bar chart showing total expenses for each uploaded statement, ordered chronologically. Each bar represents one statement.',
          )}
        </p>
      </Section>

      <Divider />

      {/* ── Tendencia de ahorro ── */}
      <Section title={l(lang, '🏦 Tendencia de ahorro', '🏦 Savings trend')}>
        <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
          {l(lang,
            'Evolución del saldo de tu cuenta de ahorros a lo largo del tiempo.',
            'Evolution of your savings account balance over time.',
          )}
        </p>
        <Row label={l(lang, 'Saldo actual', 'Current balance')} value={fmt(4_600_000)} sub={l(lang, 'Saldo del extracto más reciente.', 'Balance from the most recent statement.')} />
        <Row label={l(lang, 'Meses positivos', 'Positive months')} value="↑ 4 de 6" color="var(--accent-green)" sub={l(lang, 'Número de extractos donde el saldo subió respecto al anterior.', 'Number of statements where the balance increased vs the previous one.')} />
        <Row label={l(lang, 'Cambio total', 'Total change')} value={fmt(1_200_000)} color="var(--accent-green)" sub={l(lang, 'Diferencia entre el saldo más reciente y el más antiguo.', 'Difference between the most recent and oldest balance.')} />
      </Section>

      <Divider />

      {/* ── Evolución por categoría ── */}
      <Section title={l(lang, 'Evolución por categoría', 'Category evolution')}>
        <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
          {l(lang,
            'Muestra cómo ha variado el gasto en cada categoría entre el primer y el último extracto analizado.',
            'Shows how spending in each category has changed between the first and last analyzed statement.',
          )}
        </p>
        <Row label="↑ 25%" value={l(lang, 'Sube', 'Rising')} color="var(--accent-red)" sub={l(lang, 'La categoría gastó >10% más en el último período vs el primero.', 'Category spent >10% more in the last period vs the first.')} />
        <Row label="↓ 12%" value={l(lang, 'Baja', 'Falling')} color="var(--accent-green)" sub={l(lang, 'La categoría gastó >10% menos. Buena señal de control del gasto.', 'Category spent >10% less. A good sign of spending control.')} />
        <Row label="→" value={l(lang, 'Estable', 'Stable')} sub={l(lang, 'Variación ≤10%. El gasto se mantiene consistente.', 'Variation ≤10%. Spending remains consistent.')} />
        <Row label="★" value={l(lang, 'Nuevo', 'New')} sub={l(lang, 'Solo apareció en el último extracto analizado.', 'Only appeared in the last analyzed statement.')} />
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          {l(lang,
            'La mini gráfica (sparkline) muestra la evolución mensual de cada categoría.',
            'The mini chart (sparkline) shows the monthly evolution of each category.',
          )}
        </p>
      </Section>

      <Divider />

      {/* ── Cargos recurrentes ── */}
      <Section title={l(lang, 'Cargos recurrentes / suscripciones', 'Recurring charges / subscriptions')}>
        <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
          {l(lang,
            'Detecta automáticamente transacciones con descripción similar presentes en 2 o más extractos. Haz clic en una fila para ver el historial de apariciones.',
            'Automatically detects transactions with similar descriptions present in 2 or more statements. Click a row to see the history of occurrences.',
          )}
        </p>
        <Row label={l(lang, 'Estable', 'Stable')} value="→" sub={l(lang, 'El monto no varía significativamente entre períodos.', 'The amount does not vary significantly between periods.')} />
        <Row label={l(lang, 'Sube', 'Rising')} value="↑" color="var(--accent-red)" sub={l(lang, 'El monto promedio ha aumentado.', 'The average amount has increased.')} />
        <Row label={l(lang, 'Baja', 'Falling')} value="↓" color="var(--accent-green)" sub={l(lang, 'El monto promedio ha disminuido.', 'The average amount has decreased.')} />
      </Section>
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────

export function HelpModal({ initialTab = 'dashboard', onClose }: HelpModalProps) {
  const [tab, setTab] = useState<HelpTab>(initialTab)
  const { lang, t } = useLanguage()

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
          maxWidth: 760,
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
              {t('help.title')}
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
            { key: 'dashboard' as const, label: t('help.tab.dashboard') },
            { key: 'mes_a_mes' as const, label: t('help.tab.mesAMes') },
            { key: 'tendencias' as const, label: t('help.tab.tendencias') },
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
          {tab === 'dashboard' ? <DashboardHelp lang={lang} /> :
           tab === 'mes_a_mes' ? <MesAMesHelp lang={lang} /> :
           <TrendsHelp lang={lang} />}
        </div>
      </div>
    </div>
  )
}
