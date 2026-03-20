import io
import csv
from collections import defaultdict
from datetime import datetime

import pandas as pd
from sqlalchemy.orm import Session

from models.database import Movement, Month


def export_csv(db: Session, month_id: int) -> bytes:
    """Export movements to CSV bytes"""
    movements = db.query(Movement).filter(Movement.month_id == month_id).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Fecha', 'Descripción', 'Monto', 'Tipo', 'Categoría', 'Nota'])
    for m in movements:
        cat_name = m.category.name if m.category else 'Sin categoría'
        writer.writerow([m.date, m.description, m.amount, m.type, cat_name, m.note or ''])
    return output.getvalue().encode('utf-8-sig')


def export_excel(db: Session, month_id: int) -> bytes:
    """Export movements to Excel bytes with two sheets"""
    movements = db.query(Movement).filter(Movement.month_id == month_id).all()

    rows = []
    for m in movements:
        cat_name = m.category.name if m.category else 'Sin categoría'
        rows.append({
            'Fecha': m.date,
            'Descripción': m.description,
            'Monto': m.amount,
            'Tipo': m.type,
            'Categoría': cat_name,
            'Nota': m.note or ''
        })

    df_movements = pd.DataFrame(rows)

    summary_rows = []
    if rows:
        cat_totals = defaultdict(lambda: {'total': 0.0, 'count': 0})
        for m in movements:
            cat_name = m.category.name if m.category else 'Sin categoría'
            if m.type == 'Egreso':
                cat_totals[cat_name]['total'] += m.amount
            cat_totals[cat_name]['count'] += 1
        for cat_name, data in cat_totals.items():
            summary_rows.append({
                'Categoría': cat_name,
                'Total Egresos': data['total'],
                'Transacciones': data['count']
            })

    df_summary = pd.DataFrame(summary_rows)

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df_movements.to_excel(writer, sheet_name='Movimientos', index=False)
        df_summary.to_excel(writer, sheet_name='Resumen por Categoría', index=False)

    return output.getvalue()


def export_report(db: Session, month_id: int) -> str:
    """Export text report"""
    month = db.query(Month).filter(Month.id == month_id).first()
    movements = db.query(Movement).filter(Movement.month_id == month_id).all()

    lines = []
    lines.append('=' * 80)
    lines.append('REPORTE DE EXTRACTO BANCARIO')
    if month:
        lines.append(f'Período: {month.month:02d}/{month.year}')
        if month.bank_name:
            lines.append(f'Banco: {month.bank_name}')
    lines.append(f'Generado: {datetime.now().strftime("%d/%m/%Y %H:%M")}')
    lines.append('=' * 80)
    lines.append('')

    total_income = sum(m.amount for m in movements if m.type == 'Ingreso')
    total_expenses = sum(m.amount for m in movements if m.type == 'Egreso')

    lines.append('RESUMEN:')
    lines.append(f'  Ingresos:  ${total_income:,.2f}')
    lines.append(f'  Egresos:   ${total_expenses:,.2f}')
    lines.append(f'  Balance:   ${total_income - total_expenses:,.2f}')
    lines.append('')

    by_cat = defaultdict(list)
    for m in movements:
        cat_name = m.category.name if m.category else 'Sin categoría'
        by_cat[cat_name].append(m)

    lines.append('DETALLE POR CATEGORÍA:')
    lines.append('=' * 80)
    for cat_name, cat_movements in sorted(by_cat.items()):
        lines.append(f'\n{cat_name.upper()}')
        lines.append('-' * 80)
        lines.append(f'{"Fecha":<12} {"Descripción":<45} {"Monto":>12} {"Tipo":<8}')
        lines.append('-' * 80)
        for m in cat_movements:
            desc = m.description[:43]
            lines.append(f'{m.date:<12} {desc:<45} ${m.amount:>10,.2f} {m.type:<8}')
        subtotal = sum(m.amount for m in cat_movements)
        lines.append(f'Subtotal: ${subtotal:,.2f}')
        lines.append('=' * 80)

    return '\n'.join(lines)
