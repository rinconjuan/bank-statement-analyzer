"""Monthly unified financial summary endpoint.

Crosses data from Davivienda savings account and Falabella credit card
for the same calendar month and returns a single consolidated view.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from models.database import get_db, Month, Movement
from models.schemas import (
    MonthlySummary, SalaryInfo, CreditCardSummaryInfo,
    SavingsAccountInfo, BalanceSummary,
)
from core.constants import (
    FIXED_CHARGE_KEYWORDS, FALABELLA_PAYMENT_KEYWORDS,
    SALARY_KEYWORDS, SALARY_MIN_AMOUNT,
)

router = APIRouter()

_MONTH_NAMES_ES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

# Keywords identifying internal bolsillo/pocket movements that should NOT count
# as real expenses or income in the monthly balance.
_INTERNAL_MOVEMENT_KEYWORDS = (
    'bolsillo',
    'transferencia de dinero a bolsillo',
    'debito automatico al bolsillo',
    'débito automático al bolsillo',
    'abono automatico a bolsillo',
    'abono automático a bolsillo',
    'traslado rendimientos a bolsillo',
    'traslado rendimientos',
    'transferencia desde cuenta a bolsillo',
    'transferencia de bolsillo a cuenta',
    'abono de bolsillo a cuenta',
    'abono rendimientos netos desde cuenta',
    'rendimientos financieros',
)


def _is_internal_movement(description: str) -> bool:
    """Return True if this movement is an internal bolsillo/pocket transfer."""
    desc_lower = description.lower()
    return any(kw in desc_lower for kw in _INTERNAL_MOVEMENT_KEYWORDS)


def _is_fixed_charge(description: str) -> bool:
    desc_upper = description.upper()
    return any(kw in desc_upper for kw in FIXED_CHARGE_KEYWORDS)


def _date_sort_key(date_str: str) -> tuple:
    parts = date_str.split('/')
    if len(parts) == 3:
        try:
            return (int(parts[2]), int(parts[1]), int(parts[0]))
        except ValueError:
            pass
    return (0, 0, 0)


def _detect_salary(movements: list) -> tuple[float, str, str] | None:
    """Return (amount, description, date) of the best salary candidate."""
    best = None
    for mv in movements:
        if mv.type != 'Ingreso':
            continue
        desc_upper = mv.description.upper()
        is_salary = any(kw in desc_upper for kw in SALARY_KEYWORDS)
        if is_salary and mv.amount >= SALARY_MIN_AMOUNT:
            if best is None or mv.amount > best[0]:
                best = (mv.amount, mv.description, mv.date)
    return best


@router.get('/monthly', response_model=MonthlySummary)
def get_monthly_summary(
    year: int = Query(..., description='Year'),
    month: int = Query(..., description='Month (1-12)'),
    db: Session = Depends(get_db),
):
    """Return a unified monthly summary crossing savings and credit card data."""
    months = db.query(Month).filter(Month.year == year, Month.month == month).all()
    if not months:
        raise HTTPException(404, f'No statements found for {year}/{month:02d}')

    savings_month = next((m for m in months if m.statement_type == 'cuenta_ahorro'), None)
    credit_month = next((m for m in months if m.statement_type == 'tarjeta_credito'), None)

    month_label = _MONTH_NAMES_ES[month - 1] + f' {year}'

    # ── Savings account analysis ──────────────────────────────────────────
    salary_info: SalaryInfo | None = None
    savings_info: SavingsAccountInfo | None = None
    total_income = 0.0
    other_income = 0.0
    falabella_payment_amount = 0.0

    if savings_month:
        mv_savings = db.query(Movement).filter(Movement.month_id == savings_month.id).all()
        mv_savings_sorted = sorted(mv_savings, key=lambda m: _date_sort_key(m.date))

        # Detect salary
        salary_candidate = _detect_salary(mv_savings_sorted)
        if salary_candidate:
            salary_info = SalaryInfo(
                amount=salary_candidate[0],
                description=salary_candidate[1],
                date=salary_candidate[2],
                confirmed=False,
            )

        # Income totals
        all_income = [mv.amount for mv in mv_savings_sorted if mv.type == 'Ingreso']
        total_income = sum(all_income)
        salary_amount = salary_info.amount if salary_info else 0.0
        other_income = total_income - salary_amount

        # Detect Falabella payment(s) in savings
        falabella_payments = [
            mv for mv in mv_savings_sorted
            if mv.type == 'Egreso' and any(kw in mv.description.upper() for kw in FALABELLA_PAYMENT_KEYWORDS)
        ]
        falabella_payment_amount = sum(mv.amount for mv in falabella_payments)

        # Amount moved to bolsillo pocket this month (from egreso movements that are internal)
        ahorro_mes = sum(
            mv.amount for mv in mv_savings_sorted
            if mv.type == 'Egreso'
            and _is_internal_movement(mv.description)
            and mv not in falabella_payments
            and 'rendimientos' not in mv.description.lower()
        )

        # Other real expenses = all debits except Falabella payments and internal transfers
        other_expenses_savings = sum(
            mv.amount for mv in mv_savings_sorted
            if mv.type == 'Egreso'
            and mv not in falabella_payments
            and not _is_internal_movement(mv.description)
        )

        # Opening / closing balance approximation from cumulative amounts
        opening_balance = 0.0
        closing_balance = 0.0

        savings_info = SavingsAccountInfo(
            opening_balance=opening_balance,
            closing_balance=closing_balance,
            other_expenses=other_expenses_savings,
            saldo_anterior=savings_month.saldo_anterior or 0.0,
            nuevo_saldo=savings_month.nuevo_saldo or 0.0,
            saldo_bolsillo=savings_month.saldo_bolsillo or 0.0,
            ahorro_mes=ahorro_mes,
        )

    # ── Credit card analysis ─────────────────────────────────────────────
    credit_info: CreditCardSummaryInfo | None = None

    if credit_month:
        mv_credit = db.query(Movement).filter(Movement.month_id == credit_month.id).all()

        # Collect all payment movements
        pagos = sorted(
            [mv for mv in mv_credit if mv.es_pago_tarjeta],
            key=lambda m: _date_sort_key(m.date),
        )
        total_pagado = sum(mv.amount for mv in pagos)
        payment_date = pagos[0].date if pagos else None
        payment_date_end = pagos[-1].date if len(pagos) > 1 else None
        payment_count = len(pagos)

        # Consumos nuevos: same rule as credit-summary endpoint
        consumos_nuevos = 0.0
        for mv in mv_credit:
            if mv.es_pago_tarjeta or mv.type != 'Egreso':
                continue
            cuota = mv.cuota_mes or 0.0
            if _is_fixed_charge(mv.description):
                consumos_nuevos += mv.amount
            elif cuota > 0:
                consumos_nuevos += cuota

        # Check if savings payment matches credit card payment
        payment_confirmed = False
        if falabella_payment_amount > 0 and total_pagado > 0:
            diff = abs(falabella_payment_amount - total_pagado)
            payment_confirmed = diff < 1.0  # allow 1 COP rounding difference

        credit_info = CreditCardSummaryInfo(
            payment_made=total_pagado,
            payment_date=payment_date,
            payment_date_end=payment_date_end,
            payment_count=payment_count,
            consumos_periodo=consumos_nuevos,
            next_payment_total=credit_month.total_payment or 0.0,
            next_payment_min=credit_month.min_payment or 0.0,
            next_payment_date=credit_month.fecha_limite_pago,
            payment_confirmed=payment_confirmed,
        )

    # ── Patrimonio (Fix 8) ────────────────────────────────────────────────
    patrimonio_davivienda = 0.0
    if savings_month:
        # saldo_bolsillo is already included within nuevo_saldo — they are the
        # same money viewed from two angles (total balance vs pocket sub-balance).
        # Patrimonio Davivienda is simply the total account balance.
        patrimonio_davivienda = savings_month.nuevo_saldo or 0.0

    deuda_falabella = 0.0
    if credit_month:
        deuda_falabella = (credit_month.cupo_total or 0.0) - (credit_month.cupo_disponible or 0.0)

    patrimonio_neto = patrimonio_davivienda - deuda_falabella

    # ── Balance ───────────────────────────────────────────────────────────
    balance_info: BalanceSummary | None = None
    if savings_info or credit_info:
        card_payment = credit_info.payment_made if credit_info else falabella_payment_amount
        other_exp = savings_info.other_expenses if savings_info else 0.0
        diff = total_income - card_payment - other_exp
        bal_change = savings_info.closing_balance - savings_info.opening_balance if savings_info else 0.0
        matches = savings_info is not None and abs(diff - bal_change) < 100.0

        balance_info = BalanceSummary(
            income=total_income,
            card_payment=card_payment,
            other_expenses=other_exp,
            difference=diff,
            matches_statement=matches,
            balance_change=bal_change,
        )

    return MonthlySummary(
        year=year,
        month=month,
        month_label=month_label,
        salary=salary_info,
        other_income=other_income,
        total_income=total_income,
        credit_card=credit_info,
        savings_account=savings_info,
        balance=balance_info,
        has_savings=savings_month is not None,
        has_credit=credit_month is not None,
        patrimonio_davivienda=patrimonio_davivienda,
        patrimonio_neto=patrimonio_neto,
    )


@router.get('/available-months', response_model=list[dict])
def get_available_months(db: Session = Depends(get_db)):
    """Return list of (year, month) pairs that have at least one statement."""
    rows = db.query(Month.year, Month.month).distinct().order_by(
        Month.year.desc(), Month.month.desc()
    ).all()
    return [
        {
            'year': r.year,
            'month': r.month,
            'label': _MONTH_NAMES_ES[r.month - 1] + f' {r.year}',
        }
        for r in rows
    ]
