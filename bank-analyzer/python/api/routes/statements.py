from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
import tempfile
import os
from datetime import datetime

from models.database import get_db, Month, Movement
from models.schemas import UploadResponse, MonthWithStats, Movement as MovementSchema
from core.pdf_parser import parse_pdf, PDFPasswordRequiredError
from core.categorizer import auto_categorize_movements

router = APIRouter()


@router.post('/upload', response_model=UploadResponse)
async def upload_statement(
    file: UploadFile = File(...),
    statement_type: str = Form('cuenta_ahorro'),
    password: str = Form(''),
    db: Session = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        raise HTTPException(400, 'Only PDF files are accepted')

    valid_types = {'cuenta_ahorro', 'tarjeta_credito'}
    if statement_type not in valid_types:
        statement_type = 'cuenta_ahorro'

    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        pdf_password = password.strip() or None
        movements_data, bank_name, pdf_meta = parse_pdf(tmp_path, password=pdf_password)
    except PDFPasswordRequiredError:
        raise HTTPException(422, detail='PDF_PASSWORD_REQUIRED')
    finally:
        os.unlink(tmp_path)

    if not movements_data:
        raise HTTPException(422, 'No movements found in PDF')

    # Determine year/month from first movement with a valid date field
    first_date = next((m['date'] for m in movements_data if m.get('date')), None)
    if first_date is None:
        raise HTTPException(422, 'Could not determine statement date from PDF')
    parts = first_date.split('/')
    if len(parts) == 3:
        day, month_num, year = int(parts[0]), int(parts[1]), int(parts[2])
    elif len(parts) == 2:
        now = datetime.now()
        day, month_num, year = int(parts[0]), int(parts[1]), now.year
    else:
        now = datetime.now()
        month_num, year = now.month, now.year

    existing = db.query(Month).filter(Month.year == year, Month.month == month_num).first()
    if existing:
        db_month = existing
        db_month.bank_name = bank_name
        db_month.file_name = file.filename or 'statement.pdf'
        db_month.statement_type = statement_type
        db_month.min_payment = pdf_meta.get('min_payment')
        db_month.total_payment = pdf_meta.get('total_payment')
        db.query(Movement).filter(Movement.month_id == db_month.id).delete()
    else:
        db_month = Month(
            year=year,
            month=month_num,
            bank_name=bank_name,
            file_name=file.filename or 'statement.pdf',
            statement_type=statement_type,
            min_payment=pdf_meta.get('min_payment'),
            total_payment=pdf_meta.get('total_payment'),
        )
        db.add(db_month)
        db.flush()

    for m_data in movements_data:
        mv = Movement(
            month_id=db_month.id,
            date=m_data['date'],
            description=m_data['description'],
            amount=m_data['amount'],
            type=m_data['type'],
        )
        db.add(mv)

    db.commit()
    db.refresh(db_month)

    auto_categorize_movements(db, db_month.id, db_month.statement_type)

    preview_mvs = db.query(Movement).filter(Movement.month_id == db_month.id).limit(10).all()

    return UploadResponse(
        month_id=db_month.id,
        year=db_month.year,
        month=db_month.month,
        movements_count=len(movements_data),
        preview=[MovementSchema.model_validate(m) for m in preview_mvs]
    )


@router.get('/months', response_model=list[MonthWithStats])
def get_months(db: Session = Depends(get_db)):
    months = db.query(Month).order_by(Month.year.desc(), Month.month.desc()).all()
    result = []
    for m in months:
        movements = db.query(Movement).filter(Movement.month_id == m.id).all()
        total_income = sum(mv.amount for mv in movements if mv.type == 'Ingreso')
        total_expenses = sum(mv.amount for mv in movements if mv.type == 'Egreso')
        result.append(MonthWithStats(
            id=m.id,
            year=m.year,
            month=m.month,
            bank_name=m.bank_name,
            file_name=m.file_name,
            statement_type=m.statement_type or 'cuenta_ahorro',
            uploaded_at=m.uploaded_at,
            total_income=total_income,
            total_expenses=total_expenses,
            movements_count=len(movements),
            min_payment=m.min_payment,
            total_payment=m.total_payment,
        ))
    return result


@router.delete('/months/{month_id}')
def delete_month(month_id: int, db: Session = Depends(get_db)):
    month = db.query(Month).filter(Month.id == month_id).first()
    if not month:
        raise HTTPException(404, 'Month not found')
    db.delete(month)
    db.commit()
    return {'ok': True}
