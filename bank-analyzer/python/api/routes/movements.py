from collections import defaultdict
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from models.database import get_db, Movement
from models.schemas import (
    Movement as MovementSchema, MovementUpdate,
    MovementsSummary, CategorySummary, MonthlyExpenseBreakdown,
)
from core.categorizer import save_user_rule

router = APIRouter()

_MONTH_NAMES_ES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]


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
    return q.order_by(Movement.date.desc()).all()


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
