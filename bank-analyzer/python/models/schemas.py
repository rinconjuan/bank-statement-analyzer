import json
from datetime import datetime
from pydantic import BaseModel, ConfigDict, field_validator


class CategoryBase(BaseModel):
    name: str
    keywords: list[str]
    color: str = '#6366f1'
    icon: str = '📦'

    @field_validator('keywords', mode='before')
    @classmethod
    def parse_keywords(cls, v: object) -> list:
        """Accept a JSON string stored in the DB and deserialize it to a list."""
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return []
        return v


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: str | None = None
    keywords: list[str] | None = None
    color: str | None = None
    icon: str | None = None


class Category(CategoryBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class MovementBase(BaseModel):
    date: str
    description: str
    amount: float
    type: str  # 'Ingreso' | 'Egreso'


class MovementCreate(MovementBase):
    month_id: int
    category_id: int | None = None
    note: str | None = None


class MovementUpdate(BaseModel):
    category_id: int | None = None
    note: str | None = None
    applies_this_month: bool | None = None


class Movement(MovementBase):
    id: int
    month_id: int
    category_id: int | None = None
    note: str | None = None
    applies_this_month: bool | None = None
    statement_type: str = 'cuenta_ahorro'
    category: Category | None = None
    # Credit card extended fields
    cuota_mes: float = 0.0
    valor_pendiente: float = 0.0
    num_cuotas_actual: int | None = None
    num_cuotas_total: int | None = None
    aplica_este_extracto: bool = True
    es_pago_tarjeta: bool = False
    es_diferido_anterior: bool = False
    model_config = ConfigDict(from_attributes=True)


class MonthBase(BaseModel):
    year: int
    month: int
    bank_name: str | None = None
    file_name: str
    statement_type: str = 'cuenta_ahorro'


class MonthCreate(MonthBase):
    pass


class Month(MonthBase):
    id: int
    uploaded_at: datetime
    model_config = ConfigDict(from_attributes=True)


class MonthWithStats(Month):
    total_income: float
    total_expenses: float
    movements_count: int
    min_payment: float | None = None
    total_payment: float | None = None
    fecha_corte: str | None = None
    fecha_limite_pago: str | None = None
    cupo_total: float = 0.0
    cupo_disponible: float = 0.0
    consumos_periodo: float = 0.0


class UploadResponse(BaseModel):
    month_id: int
    year: int
    month: int
    movements_count: int
    preview: list[Movement]


class CategorySummary(BaseModel):
    category_id: int | None
    category_name: str
    category_color: str
    category_icon: str
    total: float
    income_total: float = 0.0
    expense_total: float = 0.0
    count: int


class MonthlyExpenseBreakdown(BaseModel):
    month: str        # 'YYYY-MM'
    month_label: str  # e.g. 'Febrero 2026'
    total: float


class MovementsSummary(BaseModel):
    by_category: list[CategorySummary]
    total_income: float
    total_expenses: float
    balance: float
    expenses_by_month: list[MonthlyExpenseBreakdown] = []


class CreditSummaryMonth(BaseModel):
    mes: str           # 'Enero 2026'
    total_consumos: float
    total_cuota: float
    aplica_extracto: bool
    movimientos_count: int


class CreditSummary(BaseModel):
    # pago_realizado: aggregate of all payments in the statement.
    # Keys: 'amount' (total), 'date' (first payment), 'date_end' (last, if multiple), 'count' (N)
    pago_realizado: dict | None = None
    # List of each individual payment movement (es_pago_tarjeta=True), sorted by date
    pagos_realizados: list[dict] = []
    pago_minimo: float = 0.0
    pago_total: float = 0.0
    fecha_limite: str | None = None
    cupo_total: float = 0.0
    cupo_disponible: float = 0.0
    consumos_por_mes: list[CreditSummaryMonth] = []
    total_consumos_nuevos: float = 0.0
    total_diferidos: float = 0.0


# ── Trends ─────────────────────────────────────────────────────────────────


class MonthlyTotal(BaseModel):
    month: str           # 'YYYY-MM'
    label: str           # 'Enero 2026'
    total_expenses: float
    total_income: float
    statement_type: str = 'cuenta_ahorro'


class CategoryTrendPoint(BaseModel):
    month: str           # 'YYYY-MM'
    label: str
    total: float


class CategoryTrend(BaseModel):
    category_id: int | None
    category_name: str
    category_color: str
    category_icon: str
    points: list[CategoryTrendPoint]
    trend: str           # 'up' | 'down' | 'stable' | 'new'
    change_pct: float    # percentage change last vs first period
    avg_monthly: float


class RecurringOccurrence(BaseModel):
    month: str           # 'YYYY-MM'
    label: str
    date: str
    amount: float


class RecurringCharge(BaseModel):
    description: str
    occurrences: list[RecurringOccurrence]
    avg_amount: float
    min_amount: float
    max_amount: float
    trend: str           # 'stable' | 'up' | 'down'
    months_seen: int


class TrendsReport(BaseModel):
    monthly_totals: list[MonthlyTotal]
    category_trends: list[CategoryTrend]
    recurring_charges: list[RecurringCharge]
    months_analyzed: int


# ── Monthly Unified Summary ─────────────────────────────────────────────────


class SalaryInfo(BaseModel):
    amount: float
    description: str
    date: str
    confirmed: bool = False


class CreditCardSummaryInfo(BaseModel):
    payment_made: float
    payment_date: str | None = None
    payment_date_end: str | None = None
    payment_count: int = 1
    consumos_periodo: float
    next_payment_total: float
    next_payment_min: float
    next_payment_date: str | None = None
    payment_confirmed: bool = False


class SavingsAccountInfo(BaseModel):
    opening_balance: float
    closing_balance: float
    other_expenses: float


class BalanceSummary(BaseModel):
    income: float
    card_payment: float
    other_expenses: float
    difference: float
    matches_statement: bool
    balance_change: float


class MonthlySummary(BaseModel):
    year: int
    month: int
    month_label: str
    salary: SalaryInfo | None = None
    other_income: float = 0.0
    total_income: float = 0.0
    credit_card: CreditCardSummaryInfo | None = None
    savings_account: SavingsAccountInfo | None = None
    balance: BalanceSummary | None = None
    has_savings: bool = False
    has_credit: bool = False
