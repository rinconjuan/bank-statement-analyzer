from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from collections import defaultdict
import tempfile
import os
from datetime import datetime

from models.database import get_db, Month, Movement
from models.schemas import (
    UploadResponse, MonthWithStats, Movement as MovementSchema, CreditSummary, CreditSummaryMonth,
)
from core.pdf_parser import parse_pdf, PDFPasswordRequiredError
from core.categorizer import auto_categorize_movements

router = APIRouter()

_MONTH_NAMES_ES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]


def _ym_to_label(ym: str) -> str:
    try:
        year, month = ym.split('-')
        return f'{_MONTH_NAMES_ES[int(month) - 1]} {year}'
    except Exception:
        return ym


def _date_to_ym(date_str: str) -> str:
    parts = date_str.split('/')
    if len(parts) == 3:
        return f'{parts[2]}-{parts[1]}'
    return date_str


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

    # Determine year/month:
    # For Falabella credit cards use fecha_corte (most accurate).
    # Fall back to the first movement date otherwise.
    fecha_corte = pdf_meta.get('fecha_corte')
    if fecha_corte:
        parts = fecha_corte.split('/')
        if len(parts) == 3:
            day, month_num, year = int(parts[0]), int(parts[1]), int(parts[2])
        else:
            fecha_corte = None

    if not fecha_corte:
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

    # Calculate consumos_periodo: sum of cuota_mes for all movements
    consumos_periodo = sum(m.get('cuota_mes', 0.0) for m in movements_data)

    db_month = Month(
        year=year,
        month=month_num,
        bank_name=bank_name,
        file_name=file.filename or 'statement.pdf',
        statement_type=statement_type,
        min_payment=pdf_meta.get('min_payment'),
        total_payment=pdf_meta.get('total_payment'),
        fecha_corte=pdf_meta.get('fecha_corte'),
        fecha_limite_pago=pdf_meta.get('fecha_limite_pago'),
        cupo_total=pdf_meta.get('cupo_total') or 0.0,
        cupo_disponible=pdf_meta.get('cupo_disponible') or 0.0,
        consumos_periodo=consumos_periodo,
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
            cuota_mes=m_data.get('cuota_mes', 0.0),
            valor_pendiente=m_data.get('valor_pendiente', 0.0),
            num_cuotas_actual=m_data.get('num_cuotas_actual'),
            num_cuotas_total=m_data.get('num_cuotas_total'),
            aplica_este_extracto=1 if m_data.get('aplica_este_extracto', True) else 0,
            es_pago_tarjeta=1 if m_data.get('es_pago_tarjeta', False) else 0,
            es_diferido_anterior=1 if m_data.get('es_diferido_anterior', False) else 0,
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
            fecha_corte=m.fecha_corte,
            fecha_limite_pago=m.fecha_limite_pago,
            cupo_total=m.cupo_total or 0.0,
            cupo_disponible=m.cupo_disponible or 0.0,
            consumos_periodo=m.consumos_periodo or 0.0,
        ))
    return result


@router.get('/months/{month_id}/credit-summary', response_model=CreditSummary)
def get_credit_summary(month_id: int, db: Session = Depends(get_db)):
    """Return a detailed credit card summary for a given statement month."""
    month = db.query(Month).filter(Month.id == month_id).first()
    if not month:
        raise HTTPException(404, 'Month not found')

    movements = db.query(Movement).filter(Movement.month_id == month_id).all()

    # Payment movement (es_pago_tarjeta)
    pago_realizado = None
    for mv in movements:
        if mv.es_pago_tarjeta:
            pago_realizado = {'amount': mv.amount, 'date': mv.date}
            break

    # Consumos por mes (group by calendar month)
    monthly: dict = defaultdict(lambda: {'total_consumos': 0.0, 'total_cuota': 0.0,
                                          'aplica': False, 'count': 0})
    total_consumos_nuevos = 0.0
    total_diferidos = 0.0

    for mv in movements:
        if mv.type != 'Egreso':
            continue
        ym = _date_to_ym(mv.date)
        monthly[ym]['total_consumos'] += mv.amount
        monthly[ym]['total_cuota'] += mv.cuota_mes or 0.0
        monthly[ym]['count'] += 1
        if mv.aplica_este_extracto:
            monthly[ym]['aplica'] = True
            total_consumos_nuevos += mv.cuota_mes or 0.0
        if mv.es_diferido_anterior:
            total_diferidos += mv.amount

    consumos_por_mes = [
        CreditSummaryMonth(
            mes=_ym_to_label(ym),
            total_consumos=data['total_consumos'],
            total_cuota=data['total_cuota'],
            aplica_extracto=data['aplica'],
            movimientos_count=data['count'],
        )
        for ym, data in sorted(monthly.items())
    ]

    return CreditSummary(
        pago_realizado=pago_realizado,
        pago_minimo=month.min_payment or 0.0,
        pago_total=month.total_payment or 0.0,
        fecha_limite=month.fecha_limite_pago,
        cupo_total=month.cupo_total or 0.0,
        cupo_disponible=month.cupo_disponible or 0.0,
        consumos_por_mes=consumos_por_mes,
        total_consumos_nuevos=total_consumos_nuevos,
        total_diferidos=total_diferidos,
    )


@router.delete('/months/{month_id}')
def delete_month(month_id: int, db: Session = Depends(get_db)):
    month = db.query(Month).filter(Month.id == month_id).first()
    if not month:
        raise HTTPException(404, 'Month not found')
    db.delete(month)
    db.commit()
    return {'ok': True}
