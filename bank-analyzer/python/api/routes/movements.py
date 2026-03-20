from collections import defaultdict
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from models.database import get_db, Movement
from models.schemas import Movement as MovementSchema, MovementUpdate, MovementsSummary, CategorySummary
from core.categorizer import save_user_rule

router = APIRouter()


@router.get('', response_model=list[MovementSchema])
def get_movements(
    month_id: Optional[int] = Query(None),
    category_id: Optional[int] = Query(None),
    movement_type: Optional[str] = Query(None, alias='type'),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    q = db.query(Movement)
    if month_id is not None:
        q = q.filter(Movement.month_id == month_id)
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

    return MovementsSummary(
        by_category=sorted(by_category, key=lambda x: x.total, reverse=True),
        total_income=total_income,
        total_expenses=total_expenses,
        balance=total_income - total_expenses
    )
