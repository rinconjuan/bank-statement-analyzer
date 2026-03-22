declare global {
  interface Window {
    API_PORT?: number
    electronAPI?: {
      openFileDialog: () => Promise<string | null>
      saveFileDialog: (options: { defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) => Promise<string | null>
      getApiPort: () => Promise<number>
    }
  }
}

function getBaseUrl(): string {
  const port = window.API_PORT ?? parseInt(import.meta.env.VITE_API_PORT ?? '8000')
  return `http://127.0.0.1:${port}`
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${getBaseUrl()}${path}`
  const res = await fetch(url, options)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error((err as { detail: string }).detail ?? 'Request failed')
  }
  return res.json() as Promise<T>
}

export interface Category {
  id: number
  name: string
  keywords: string[]
  color: string
  icon: string
}

export interface Movement {
  id: number
  month_id: number
  date: string
  description: string
  amount: number
  type: 'Ingreso' | 'Egreso'
  category_id: number | null
  note: string | null
  applies_this_month: boolean | null
  statement_type: string
  category: Category | null
  // Credit card extended fields
  cuota_mes: number
  valor_pendiente: number
  num_cuotas_actual: number | null
  num_cuotas_total: number | null
  aplica_este_extracto: boolean
  es_pago_tarjeta: boolean
  es_diferido_anterior: boolean
}

export interface MonthWithStats {
  id: number
  year: number
  month: number
  bank_name: string | null
  file_name: string
  statement_type: string
  uploaded_at: string
  total_income: number
  total_expenses: number
  movements_count: number
  min_payment: number | null
  total_payment: number | null
  fecha_corte: string | null
  fecha_limite_pago: string | null
  cupo_total: number
  cupo_disponible: number
  consumos_periodo: number
}

export interface UploadResponse {
  month_id: number
  year: number
  month: number
  movements_count: number
  preview: Movement[]
}

export interface CategorySummary {
  category_id: number | null
  category_name: string
  category_color: string
  category_icon: string
  total: number
  income_total: number
  expense_total: number
  count: number
}

export interface MonthlyExpenseBreakdown {
  month: string        // 'YYYY-MM'
  month_label: string  // 'Febrero 2026'
  total: number
}

export interface MovementsSummary {
  by_category: CategorySummary[]
  total_income: number
  total_expenses: number
  balance: number
  expenses_by_month: MonthlyExpenseBreakdown[]
}

// Months
export const fetchMonths = () => request<MonthWithStats[]>('/api/v1/statements/months')
export const deleteMonth = (id: number) => request<{ ok: boolean }>(`/api/v1/statements/months/${id}`, { method: 'DELETE' })

// Upload
export async function uploadStatement(file: File, statementType: string = 'cuenta_ahorro', password: string = ''): Promise<UploadResponse> {
  const form = new FormData()
  form.append('file', file)
  form.append('statement_type', statementType)
  form.append('password', password)
  const url = `${getBaseUrl()}/api/v1/statements/upload`
  const res = await fetch(url, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error((err as { detail: string }).detail ?? 'Upload failed')
  }
  return res.json() as Promise<UploadResponse>
}

// Movements
export const fetchMovements = (params: { month_id?: number; calendar_month?: string; category_id?: number; type?: string; search?: string }) => {
  const qs = new URLSearchParams()
  if (params.month_id != null) qs.set('month_id', String(params.month_id))
  if (params.calendar_month) qs.set('calendar_month', params.calendar_month)
  if (params.category_id != null) qs.set('category_id', String(params.category_id))
  if (params.type) qs.set('type', params.type)
  if (params.search) qs.set('search', params.search)
  return request<Movement[]>(`/api/v1/movements?${qs}`)
}

export const updateMovement = (id: number, data: { category_id?: number | null; note?: string | null; applies_this_month?: boolean | null }) =>
  request<Movement>(`/api/v1/movements/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

export const fetchCalendarMonths = () =>
  request<string[]>('/api/v1/movements/calendar-months')

export const fetchSummary = (month_id?: number) => {
  const qs = month_id != null ? `?month_id=${month_id}` : ''
  return request<MovementsSummary>(`/api/v1/movements/summary${qs}`)
}

// Categories
export const fetchCategories = () => request<Category[]>('/api/v1/categories')
export const createCategory = (data: Omit<Category, 'id'>) =>
  request<Category>('/api/v1/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
export const updateCategory = (id: number, data: Partial<Omit<Category, 'id'>>) =>
  request<Category>(`/api/v1/categories/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
export const deleteCategory = (id: number) =>
  request<{ ok: boolean }>(`/api/v1/categories/${id}`, { method: 'DELETE' })

// Export
export const getExportUrl = (type: 'csv' | 'excel' | 'report', month_id: number) =>
  `${getBaseUrl()}/api/v1/export/${type}?month_id=${month_id}`

// Credit card summary
export interface CreditSummaryMonth {
  mes: string
  total_consumos: number
  total_cuota: number
  aplica_extracto: boolean
  movimientos_count: number
}

export interface CreditSummary {
  // Aggregate of all payments: 'amount' (total), 'date' (first), 'date_end' (last if multiple), 'count'
  pago_realizado: { amount: number; date: string; date_end?: string; count: number } | null
  // All individual payment movements, sorted by date
  pagos_realizados: { amount: number; date: string }[]
  pago_minimo: number
  pago_total: number
  fecha_limite: string | null
  cupo_total: number
  cupo_disponible: number
  consumos_por_mes: CreditSummaryMonth[]
  total_consumos_nuevos: number
  total_diferidos: number
}

export const fetchCreditSummary = (month_id: number) =>
  request<CreditSummary>(`/api/v1/statements/months/${month_id}/credit-summary`)

// Trends
export interface MonthlyTotal {
  month: string     // 'YYYY-MM'
  label: string     // 'Enero 2026'
  total_expenses: number
  total_income: number
  statement_type: string
}

export interface CategoryTrendPoint {
  month: string
  label: string
  total: number
}

export interface CategoryTrend {
  category_id: number | null
  category_name: string
  category_color: string
  category_icon: string
  points: CategoryTrendPoint[]
  trend: 'up' | 'down' | 'stable' | 'new'
  change_pct: number
  avg_monthly: number
}

export interface RecurringOccurrence {
  month: string
  label: string
  date: string
  amount: number
}

export interface RecurringCharge {
  description: string
  occurrences: RecurringOccurrence[]
  avg_amount: number
  min_amount: number
  max_amount: number
  trend: 'up' | 'down' | 'stable'
  months_seen: number
}

export interface TrendsReport {
  monthly_totals: MonthlyTotal[]
  category_trends: CategoryTrend[]
  recurring_charges: RecurringCharge[]
  months_analyzed: number
}

export const fetchTrends = () =>
  request<TrendsReport>('/api/v1/movements/trends')

// Monthly unified summary
export interface SalaryInfo {
  amount: number
  description: string
  date: string
  confirmed: boolean
}

export interface CreditCardSummaryInfo {
  payment_made: number
  payment_date: string | null
  payment_date_end: string | null
  payment_count: number
  consumos_periodo: number
  next_payment_total: number
  next_payment_min: number
  next_payment_date: string | null
  payment_confirmed: boolean
}

export interface SavingsAccountInfo {
  opening_balance: number
  closing_balance: number
  other_expenses: number
  saldo_anterior: number
  nuevo_saldo: number
  saldo_bolsillo: number
  ahorro_mes: number
}

export interface BalanceSummary {
  income: number
  card_payment: number
  other_expenses: number
  difference: number
  matches_statement: boolean
  balance_change: number
}

export interface ExpenseBreakdownItem {
  label: string
  icon: string
  amount: number
  tooltip: string | null
  count: number
}

export interface MonthlySummary {
  year: number
  month: number
  month_label: string
  /** PARCIAL | ACTIVO | CERRADO */
  month_status: string
  salary: SalaryInfo | null
  other_income: number
  total_income: number
  credit_card: CreditCardSummaryInfo | null
  savings_account: SavingsAccountInfo | null
  balance: BalanceSummary | null
  has_savings: boolean
  has_credit: boolean
  patrimonio_davivienda: number
  patrimonio_neto: number
  expense_breakdown: ExpenseBreakdownItem[]
  next_payment_confirmed: boolean
  next_payment_confirmation_date: string | null
  next_payment_confirmation_amount: number
  ahorro_real: number | null
}

export interface AvailableMonth {
  year: number
  month: number
  label: string
}

export const fetchMonthlySummary = (year: number, month: number) =>
  request<MonthlySummary>(`/api/v1/summary/monthly?year=${year}&month=${month}`)

export const fetchAvailableMonths = () =>
  request<AvailableMonth[]>('/api/v1/summary/available-months')
