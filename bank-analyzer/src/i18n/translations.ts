export type Lang = 'es' | 'en'

// Flat string dictionary — use {key} placeholders for simple interpolation
type Dict = Record<string, string>

const es: Dict = {
  // ── Navigation ──────────────────────────────────────────────────────────────
  'nav.dashboard':   'Dashboard',
  'nav.mesAMes':     'Mes a Mes',
  'nav.tendencias':  'Tendencias',
  'nav.categorias':  'Categorías',

  // ── Sidebar ─────────────────────────────────────────────────────────────────
  'sidebar.tagline':        'Análisis financiero',
  'sidebar.months':         'Meses',
  'sidebar.uploadTooltip':  'Cargar nuevo extracto',
  'sidebar.noStatements':   'Carga tu primer extracto bancario',
  'sidebar.confirmDelete':  '¿Eliminar este mes y todos sus movimientos?',

  // ── TopBar ───────────────────────────────────────────────────────────────────
  'topBar.selectMonth':   'Selecciona un mes',
  'topBar.newStatement':  '+ Nuevo extracto',

  // ── Welcome screen ───────────────────────────────────────────────────────────
  'welcome.title':    'Bienvenido a Bank Analyzer',
  'welcome.subtitle': 'Carga tu extracto bancario para comenzar',
  'welcome.button':   '+ Cargar extracto PDF',

  // ── Generic buttons ──────────────────────────────────────────────────────────
  'btn.help':  'Ayuda',
  'btn.close': '✕',

  // ── SummaryCards ─────────────────────────────────────────────────────────────
  'cards.income':            'Ingresos',
  'cards.expenses':          'Egresos',
  'cards.balance':           'Balance',
  'cards.payments':          'Pagos/Abonos',
  'cards.totalCharges':      'Consumos Totales',
  'cards.pendingBalance':    'Saldo Pendiente',
  'cards.paymentsHint':      'Pagos realizados a la tarjeta',
  'cards.chargesHint':       'Total de compras del período',
  'cards.inFavor':           'A favor del titular',
  'cards.amountDue':         'Monto por pagar',
  'cards.totalPaymentLabel': 'Pago total del período',
  'cards.minPaymentLabel':   'Pago mínimo',
  'cards.prevBalance':       'Saldo anterior',
  'cards.finalBalance':      'Saldo final',

  // ── TrendsView ───────────────────────────────────────────────────────────────
  'trends.title':            '📈 Tendencias de gasto',
  'trends.overallTrend':     'Tendencia general',
  'trends.increasing':       'Gasto en aumento',
  'trends.decreasing':       'Gasto reduciéndose',
  'trends.stableDesc':       'Gasto estable',
  'trends.risingCats':       'Categorías en alza',
  'trends.recurringCount':   'Cargos recurrentes',
  'trends.recurringDetected':'detectados (2+ meses)',
  'trends.monthlyAvg':       'Prom. mensual:',
  'trends.stable':           'Estable',
  'trends.new':              'Nuevo',
  'trends.sube':             'Sube',
  'trends.baja':             'Baja',
  'trends.expPerStatement':  'Gastos por extracto',
  'trends.savingsTrendTitle':'🏦 Tendencia de ahorro',
  'trends.savingsSubtitle':  'Evolución del saldo en cuenta de ahorros',
  'trends.currentBalance':   'Saldo actual',
  'trends.positiveMonths':   'Meses positivos',
  'trends.totalChange':      'Cambio total',
  'trends.catEvolution':     'Evolución por categoría',
  'trends.all':              'Todas',
  'trends.upFilter':         '↑ Subiendo',
  'trends.downFilter':       '↓ Bajando',
  'trends.noCats':           'Sin categorías con este filtro',
  'trends.legend':           '↑ Sube >10% · ↓ Baja >10% · → Estable · ★ Nuevo (solo en último mes)',
  'trends.recurringTitle':   'Cargos recurrentes / suscripciones detectadas',
  'trends.recurringNote':    'Se detectan transacciones con descripción similar presentes en 2 o más extractos.',
  'trends.loading':          'Calculando tendencias…',
  'trends.notEnough':        'Carga al menos 2 extractos para ver tendencias.',

  // ── HelpModal ────────────────────────────────────────────────────────────────
  'help.title':          'Ayuda — ¿Cómo funciona?',
  'help.tab.dashboard':  '📊 Dashboard',
  'help.tab.mesAMes':    '📅 Mes a Mes',
  'help.tab.tendencias': '📈 Tendencias',

  // ── Mes a Mes / BalanceCard ───────────────────────────────────────────────────
  'mesAMes.balanceTitle':      'Balance del mes',
  'mesAMes.whatIn':            'QUÉ ENTRÓ',
  'mesAMes.whatOut':           'QUÉ SALIÓ',
  'mesAMes.result':            'RESULTADO',
  'mesAMes.patrimony':         'PATRIMONIO',
  'mesAMes.salary':            '💰 Salario',
  'mesAMes.otherIncome':       'Otros ingresos',
  'mesAMes.totalIncome':       'Total ingresos',
  'mesAMes.totalOut':          'Total salidas',
  'mesAMes.monthDiff':         'Diferencia del mes',
  'mesAMes.prevSaldo':         '🏦 Saldo anterior',
  'mesAMes.finalSaldo':        '🏦 Saldo final',
  'mesAMes.nextPayment':       '⏳ Próximo pago {bank}',
  'mesAMes.confirmedPayment':  '✅ Pago {bank} confirmado',
  'mesAMes.realSavings':       'Ahorro real del mes',
  'mesAMes.inBolsillo':        '💰 En bolsillo (ahorro)',
  'mesAMes.availableInAccount':'💵 Disponible en cuenta',
  'mesAMes.savedThisMonth':    '📈 Ahorrado este mes',
  'mesAMes.netPatrimony':      'Patrimonio neto',
  'mesAMes.calendarMonths':    'Meses calendario',
  'mesAMes.loadingBalance':    'Cargando balance…',
  'mesAMes.loadingMovements':  'Cargando movimientos…',
  'mesAMes.statusClosed':      'Cerrado',
  'mesAMes.statusActive':      'Activo',
  'mesAMes.statusPartial':     'Parcial',
  'mesAMes.stmtTypeCredit':    'Tarjeta de Crédito',
  'mesAMes.stmtTypeSavings':   'Cuenta de Ahorros',
  'mesAMes.colDate':           'Fecha',
  'mesAMes.colDesc':           'Descripción',
  'mesAMes.colAmount':         'Monto',
  'mesAMes.colType':           'Tipo',
  'mesAMes.colInstallment':    'Cuota este mes',
  'mesAMes.colCategory':       'Categoría',
  'mesAMes.colApplies':        'Aplica',
  'mesAMes.extracto':          'Extracto',
  'mesAMes.movs':              'mov.',
  'mesAMes.nPayments':         '{n} pagos',

  // ── Settings ──────────────────────────────────────────────────────────────────
  'settings.categories':       'Categorías',
}

const en: Dict = {
  // ── Navigation ──────────────────────────────────────────────────────────────
  'nav.dashboard':   'Dashboard',
  'nav.mesAMes':     'Month by Month',
  'nav.tendencias':  'Trends',
  'nav.categorias':  'Categories',

  // ── Sidebar ─────────────────────────────────────────────────────────────────
  'sidebar.tagline':        'Financial analysis',
  'sidebar.months':         'Months',
  'sidebar.uploadTooltip':  'Upload new statement',
  'sidebar.noStatements':   'Upload your first bank statement',
  'sidebar.confirmDelete':  'Delete this month and all its movements?',

  // ── TopBar ───────────────────────────────────────────────────────────────────
  'topBar.selectMonth':   'Select a month',
  'topBar.newStatement':  '+ New statement',

  // ── Welcome screen ───────────────────────────────────────────────────────────
  'welcome.title':    'Welcome to Bank Analyzer',
  'welcome.subtitle': 'Upload your bank statement to get started',
  'welcome.button':   '+ Upload PDF Statement',

  // ── Generic buttons ──────────────────────────────────────────────────────────
  'btn.help':  'Help',
  'btn.close': '✕',

  // ── SummaryCards ─────────────────────────────────────────────────────────────
  'cards.income':            'Income',
  'cards.expenses':          'Expenses',
  'cards.balance':           'Balance',
  'cards.payments':          'Payments',
  'cards.totalCharges':      'Total Charges',
  'cards.pendingBalance':    'Outstanding Balance',
  'cards.paymentsHint':      'Payments made to the card',
  'cards.chargesHint':       'Total purchases for the period',
  'cards.inFavor':           'In your favor',
  'cards.amountDue':         'Amount due',
  'cards.totalPaymentLabel': 'Total payment for the period',
  'cards.minPaymentLabel':   'Minimum payment',
  'cards.prevBalance':       'Previous balance',
  'cards.finalBalance':      'Final balance',

  // ── TrendsView ───────────────────────────────────────────────────────────────
  'trends.title':            '📈 Spending Trends',
  'trends.overallTrend':     'Overall trend',
  'trends.increasing':       'Spending increasing',
  'trends.decreasing':       'Spending decreasing',
  'trends.stableDesc':       'Spending stable',
  'trends.risingCats':       'Rising categories',
  'trends.recurringCount':   'Recurring charges',
  'trends.recurringDetected':'detected (2+ months)',
  'trends.monthlyAvg':       'Monthly avg:',
  'trends.stable':           'Stable',
  'trends.new':              'New',
  'trends.sube':             'Rising',
  'trends.baja':             'Falling',
  'trends.expPerStatement':  'Expenses per statement',
  'trends.savingsTrendTitle':'🏦 Savings trend',
  'trends.savingsSubtitle':  'Savings account balance evolution',
  'trends.currentBalance':   'Current balance',
  'trends.positiveMonths':   'Positive months',
  'trends.totalChange':      'Total change',
  'trends.catEvolution':     'Category evolution',
  'trends.all':              'All',
  'trends.upFilter':         '↑ Rising',
  'trends.downFilter':       '↓ Falling',
  'trends.noCats':           'No categories with this filter',
  'trends.legend':           '↑ Up >10% · ↓ Down >10% · → Stable · ★ New (only in last month)',
  'trends.recurringTitle':   'Recurring charges / detected subscriptions',
  'trends.recurringNote':    'Transactions with similar descriptions found in 2 or more statements.',
  'trends.loading':          'Calculating trends…',
  'trends.notEnough':        'Upload at least 2 statements to see trends.',

  // ── HelpModal ────────────────────────────────────────────────────────────────
  'help.title':          'Help — How does it work?',
  'help.tab.dashboard':  '📊 Dashboard',
  'help.tab.mesAMes':    '📅 Month by Month',
  'help.tab.tendencias': '📈 Trends',

  // ── Mes a Mes / BalanceCard ───────────────────────────────────────────────────
  'mesAMes.balanceTitle':      'Monthly Balance',
  'mesAMes.whatIn':            'INCOME',
  'mesAMes.whatOut':           'EXPENSES',
  'mesAMes.result':            'RESULT',
  'mesAMes.patrimony':         'NET WORTH',
  'mesAMes.salary':            '💰 Salary',
  'mesAMes.otherIncome':       'Other income',
  'mesAMes.totalIncome':       'Total income',
  'mesAMes.totalOut':          'Total expenses',
  'mesAMes.monthDiff':         'Month difference',
  'mesAMes.prevSaldo':         '🏦 Previous balance',
  'mesAMes.finalSaldo':        '🏦 Final balance',
  'mesAMes.nextPayment':       '⏳ Next {bank} payment',
  'mesAMes.confirmedPayment':  '✅ {bank} payment confirmed',
  'mesAMes.realSavings':       'Real savings for the month',
  'mesAMes.inBolsillo':        '💰 In savings pocket',
  'mesAMes.availableInAccount':'💵 Available in account',
  'mesAMes.savedThisMonth':    '📈 Saved this month',
  'mesAMes.netPatrimony':      'Net worth',
  'mesAMes.calendarMonths':    'Calendar months',
  'mesAMes.loadingBalance':    'Loading balance…',
  'mesAMes.loadingMovements':  'Loading transactions…',
  'mesAMes.statusClosed':      'Closed',
  'mesAMes.statusActive':      'Active',
  'mesAMes.statusPartial':     'Partial',
  'mesAMes.stmtTypeCredit':    'Credit Card',
  'mesAMes.stmtTypeSavings':   'Savings Account',
  'mesAMes.colDate':           'Date',
  'mesAMes.colDesc':           'Description',
  'mesAMes.colAmount':         'Amount',
  'mesAMes.colType':           'Type',
  'mesAMes.colInstallment':    'Installment',
  'mesAMes.colCategory':       'Category',
  'mesAMes.colApplies':        'Applies',
  'mesAMes.extracto':          'Statement',
  'mesAMes.movs':              'mov.',
  'mesAMes.nPayments':         '{n} payments',

  // ── Settings ──────────────────────────────────────────────────────────────────
  'settings.categories':       'Categories',
}

export function getDict(lang: Lang): Dict {
  return lang === 'en' ? en : es
}
