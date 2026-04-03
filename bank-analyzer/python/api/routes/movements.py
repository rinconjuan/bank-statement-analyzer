from collections import defaultdict
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from models.database import get_db, Movement, Month
from models.schemas import (
    Movement as MovementSchema, MovementUpdate,
    MovementsSummary, CategorySummary, MonthlyExpenseBreakdown,
    TrendsReport, MonthlyTotal, CategoryTrend, CategoryTrendPoint,
    RecurringCharge, RecurringOccurrence, SavingsTrendPoint,
)
from core.categorizer import save_user_rule
from core.constants import INTERNAL_MOVEMENT_KEYWORDS

router = APIRouter()

_MONTH_NAMES_ES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]


def _is_bolsillo_movement(description: str) -> bool:
    """Return True if the movement is an internal Davivienda bolsillo/pocket transfer.

    These should be excluded from all financial summaries to avoid double-counting
    the same money (the Bolsillo pocket is the same money as the main account).
    """
    desc_lower = description.lower()
    return any(kw in desc_lower for kw in INTERNAL_MOVEMENT_KEYWORDS)


def _ym_to_label(ym: str) -> str:
    """Convert 'YYYY-MM' → 'Enero 2026'."""
    try:
        year, month = ym.split('-')
        return f'{_MONTH_NAMES_ES[int(month) - 1]} {year}'
    except Exception:
        return ym


def _date_to_ym(date_str: str) -> str:
    """Convert 'DD/MM/YYYY' → 'YYYY-MM'."""
    parts = date_str.split('/')
    if len(parts) == 3:
        return f'{parts[2]}-{parts[1]}'
    return date_str


@router.get('', response_model=list[MovementSchema])
def get_movements(
    month_id: Optional[int] = Query(None),
    calendar_month: Optional[str] = Query(None, description='Filter by calendar month YYYY-MM'),
    category_id: Optional[int] = Query(None),
    movement_type: Optional[str] = Query(None, alias='type'),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0, description='Number of records to skip'),
    limit: int = Query(500, ge=1, le=1000, description='Max records to return'),
    db: Session = Depends(get_db)
):
    q = db.query(Movement)
    if month_id is not None:
        q = q.filter(Movement.month_id == month_id)
    if calendar_month is not None:
        # dates stored as DD/MM/YYYY — match /MM/YYYY suffix
        try:
            year, month = calendar_month.split('-')
            q = q.filter(Movement.date.like(f'%/{month}/{year}'))
        except ValueError:
            pass
    if category_id is not None:
        q = q.filter(Movement.category_id == category_id)
    if movement_type is not None:
        q = q.filter(Movement.type == movement_type)
    if search:
        q = q.filter(Movement.description.ilike(f'%{search}%'))
    return q.order_by(Movement.date.desc()).offset(skip).limit(limit).all()


@router.put('/{movement_id}', response_model=MovementSchema)
def update_movement(movement_id: int, update: MovementUpdate, db: Session = Depends(get_db)):
    movement = db.query(Movement).filter(Movement.id == movement_id).first()
    if not movement:
        raise HTTPException(404, 'Movement not found')
    if update.category_id is not None:
        movement.category_id = update.category_id
        # Persist a user rule so future auto-categorization learns from this change
        save_user_rule(db, movement.description, update.category_id)
    if update.note is not None:
        movement.note = update.note
    if update.applies_this_month is not None:
        movement.applies_this_month = update.applies_this_month
    db.commit()
    db.refresh(movement)
    return movement


@router.get('/summary', response_model=MovementsSummary)
def get_summary(month_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    q = db.query(Movement)
    if month_id is not None:
        q = q.filter(Movement.month_id == month_id)
    movements = q.all()

    # Exclude internal Davivienda bolsillo/pocket movements from all summary totals.
    # The Bolsillo is the same money as the main account — including both sides would
    # inflate both income and expense totals (double-counting).
    movements = [m for m in movements if not _is_bolsillo_movement(m.description)]

    total_income = sum(m.amount for m in movements if m.type == 'Ingreso')
    total_expenses = sum(m.amount for m in movements if m.type == 'Egreso')

    cat_data = defaultdict(lambda: {'income': 0.0, 'expense': 0.0, 'count': 0, 'cat': None})
    for m in movements:
        key = m.category_id
        if m.category:
            cat_data[key]['cat'] = m.category
        if m.type == 'Ingreso':
            cat_data[key]['income'] += m.amount
        else:
            cat_data[key]['expense'] += m.amount
        cat_data[key]['count'] += 1

    by_category = []
    for key, data in cat_data.items():
        cat = data['cat']
        by_category.append(CategorySummary(
            category_id=key,
            category_name=cat.name if cat else 'Sin categoría',
            category_color=cat.color if cat else '#94a3b8',
            category_icon=cat.icon if cat else '📦',
            total=data['income'] + data['expense'],
            income_total=data['income'],
            expense_total=data['expense'],
            count=data['count']
        ))

    # Month-by-month expense breakdown (for credit card statements)
    monthly: dict[str, float] = defaultdict(float)
    for m in movements:
        if m.type == 'Egreso':
            ym = _date_to_ym(m.date)
            monthly[ym] += m.amount

    expenses_by_month = [
        MonthlyExpenseBreakdown(month=ym, month_label=_ym_to_label(ym), total=total)
        for ym, total in sorted(monthly.items())
    ]

    return MovementsSummary(
        by_category=sorted(by_category, key=lambda x: x.total, reverse=True),
        total_income=total_income,
        total_expenses=total_expenses,
        balance=total_income - total_expenses,
        expenses_by_month=expenses_by_month,
    )


@router.get('/calendar-months', response_model=list[str])
def get_calendar_months(db: Session = Depends(get_db)):
    """Return a sorted list of distinct YYYY-MM months found across all movement dates (DD/MM/YYYY)."""
    rows = db.query(Movement.date).distinct().all()
    months: set[str] = set()
    for (date_str,) in rows:
        if date_str and len(date_str) == 10:
            # DD/MM/YYYY → YYYY-MM
            parts = date_str.split('/')
            if len(parts) == 3:
                months.add(f'{parts[2]}-{parts[1]}')
    return sorted(months, reverse=True)


@router.get('/trends', response_model=TrendsReport)
def get_trends(db: Session = Depends(get_db)):
    """Compute spending trends across all uploaded statement months.

    Returns:
    - monthly_totals: total income/expenses per statement month.
    - category_trends: per-category evolution across months (top 10 by total spend).
    - recurring_charges: suspected subscriptions/recurring expenses detected in
      2+ statement months with a similar description.
    """
    # Load all statement months ordered chronologically
    all_months = db.query(Month).order_by(Month.year, Month.month).all()
    if not all_months:
        return TrendsReport(monthly_totals=[], category_trends=[], recurring_charges=[], months_analyzed=0)

    # Build a key for each month record (year-month string) from its year/month fields
    def _month_key(m: Month) -> str:
        return f'{m.year}-{m.month:02d}'

    # ── 1. Monthly totals ──────────────────────────────────────────────────
    monthly_totals_map: dict[str, MonthlyTotal] = {}
    for m in all_months:
        key = _month_key(m)
        movs = db.query(Movement).filter(Movement.month_id == m.id).all()
        expenses = sum(mv.amount for mv in movs if mv.type == 'Egreso')
        income = sum(mv.amount for mv in movs if mv.type == 'Ingreso')
        monthly_totals_map[key] = MonthlyTotal(
            month=key,
            label=_ym_to_label(key),
            total_expenses=expenses,
            total_income=income,
            statement_type=m.statement_type or 'cuenta_ahorro',
        )
    monthly_totals = list(monthly_totals_map.values())

    # ── 2. Category trends ─────────────────────────────────────────────────
    # For each (month, category) pair, accumulate expenses
    cat_month_totals: dict = defaultdict(lambda: defaultdict(float))
    cat_meta: dict = {}

    for m in all_months:
        key = _month_key(m)
        movs = db.query(Movement).filter(Movement.month_id == m.id).all()
        for mv in movs:
            if mv.type != 'Egreso':
                continue
            cat_id = mv.category_id
            cat_month_totals[cat_id][key] += mv.amount
            if cat_id not in cat_meta and mv.category:
                cat_meta[cat_id] = mv.category

    # Build sorted list of all month keys present in data
    all_month_keys = sorted({k for cat_data in cat_month_totals.values() for k in cat_data.keys()})

    category_trends: list[CategoryTrend] = []
    for cat_id, month_data in cat_month_totals.items():
        points = [
            CategoryTrendPoint(month=k, label=_ym_to_label(k), total=month_data.get(k, 0.0))
            for k in all_month_keys
        ]
        totals = [p.total for p in points if p.total > 0]
        avg_monthly = sum(totals) / len(totals) if totals else 0.0

        # Trend: compare last period vs first period
        first = next((p.total for p in points if p.total > 0), 0.0)
        last = next((p.total for p in reversed(points) if p.total > 0), 0.0)
        if first == 0:
            trend = 'new'
            change_pct = 0.0
        else:
            change_pct = round((last - first) / first * 100, 1)
            if change_pct > 10:
                trend = 'up'
            elif change_pct < -10:
                trend = 'down'
            else:
                trend = 'stable'

        cat = cat_meta.get(cat_id)
        category_trends.append(CategoryTrend(
            category_id=cat_id,
            category_name=cat.name if cat else 'Sin categoría',
            category_color=cat.color if cat else '#94a3b8',
            category_icon=cat.icon if cat else '📦',
            points=points,
            trend=trend,
            change_pct=change_pct,
            avg_monthly=avg_monthly,
        ))

    # Sort by total spend descending, take top 10
    category_trends.sort(key=lambda c: c.avg_monthly, reverse=True)
    category_trends = category_trends[:10]

    # ── 3. Recurring charges ───────────────────────────────────────────────
    # Group expenses by a normalised description key across different statement months
    desc_occurrences: dict[str, list] = defaultdict(list)

    for m in all_months:
        month_key = _month_key(m)
        movs = db.query(Movement).filter(Movement.month_id == m.id).all()
        for mv in movs:
            if mv.type != 'Egreso':
                continue
            # Normalise: first 30 chars, uppercase, strip numbers
            import re
            normalised = re.sub(r'\d', '', mv.description[:30].upper()).strip()
            if len(normalised) < 4:
                continue
            desc_occurrences[normalised].append({
                'raw_desc': mv.description,
                'month': month_key,
                'date': mv.date,
                'amount': mv.amount,
            })

    recurring_charges: list[RecurringCharge] = []
    for norm_desc, occ_list in desc_occurrences.items():
        # Only flag if seen in 2+ different statement months
        distinct_months = {o['month'] for o in occ_list}
        if len(distinct_months) < 2:
            continue

        # Use raw description from most recent occurrence
        occ_list_sorted = sorted(occ_list, key=lambda o: o['month'])
        raw_desc = occ_list_sorted[-1]['raw_desc']
        amounts = [o['amount'] for o in occ_list_sorted]
        avg_amt = sum(amounts) / len(amounts)
        first_amt = amounts[0]
        last_amt = amounts[-1]
        if first_amt == 0:
            rec_trend = 'stable'
        else:
            pct = (last_amt - first_amt) / first_amt * 100
            rec_trend = 'up' if pct > 10 else ('down' if pct < -10 else 'stable')

        occurrences = [
            RecurringOccurrence(
                month=o['month'],
                label=_ym_to_label(o['month']),
                date=o['date'],
                amount=o['amount'],
            )
            for o in occ_list_sorted
        ]
        recurring_charges.append(RecurringCharge(
            description=raw_desc,
            occurrences=occurrences,
            avg_amount=round(avg_amt, 2),
            min_amount=min(amounts),
            max_amount=max(amounts),
            trend=rec_trend,
            months_seen=len(distinct_months),
        ))

    # Sort by months_seen desc, then avg amount desc
    recurring_charges.sort(key=lambda r: (r.months_seen, r.avg_amount), reverse=True)
    recurring_charges = recurring_charges[:20]

    # ── 4. Savings balance trend ───────────────────────────────────────────
    # Use nuevo_saldo from savings account months ordered chronologically.
    savings_months = [m for m in all_months if m.statement_type == 'cuenta_ahorro' and m.nuevo_saldo]
    savings_trend: list[SavingsTrendPoint] = []
    for m in savings_months:
        key = _month_key(m)
        saldo_ant = m.saldo_anterior or 0.0
        nuevo = m.nuevo_saldo or 0.0
        bolsillo = m.saldo_bolsillo or 0.0
        savings_trend.append(SavingsTrendPoint(
            month=key,
            label=_ym_to_label(key),
            nuevo_saldo=nuevo,
            saldo_anterior=saldo_ant,
            saldo_bolsillo=bolsillo,
            diferencia=round(nuevo - saldo_ant, 2),
        ))

    return TrendsReport(
        monthly_totals=monthly_totals,
        category_trends=category_trends,
        recurring_charges=recurring_charges,
        months_analyzed=len(all_months),
        savings_trend=savings_trend,
    )
