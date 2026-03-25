from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from models.database import get_db, Month
from core.exporter import export_csv, export_excel, export_report

router = APIRouter()


@router.get('/csv')
def export_csv_endpoint(month_id: int = Query(...), db: Session = Depends(get_db)):
    month = db.query(Month).filter(Month.id == month_id).first()
    if not month:
        raise HTTPException(404, 'Month not found')
    data = export_csv(db, month_id)
    filename = f'movimientos_{month.year}_{month.month:02d}.csv'
    return Response(
        content=data,
        media_type='text/csv',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'}
    )


@router.get('/excel')
def export_excel_endpoint(month_id: int = Query(...), db: Session = Depends(get_db)):
    month = db.query(Month).filter(Month.id == month_id).first()
    if not month:
        raise HTTPException(404, 'Month not found')
    data = export_excel(db, month_id)
    filename = f'movimientos_{month.year}_{month.month:02d}.xlsx'
    return Response(
        content=data,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'}
    )


@router.get('/report')
def export_report_endpoint(month_id: int = Query(...), db: Session = Depends(get_db)):
    month = db.query(Month).filter(Month.id == month_id).first()
    if not month:
        raise HTTPException(404, 'Month not found')
    data = export_report(db, month_id)
    filename = f'reporte_{month.year}_{month.month:02d}.txt'
    content = data.encode('utf-8') if isinstance(data, str) else data
    return Response(
        content=content,
        media_type='text/plain; charset=utf-8',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'}
    )
