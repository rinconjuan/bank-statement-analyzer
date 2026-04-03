import json
import os
from dataclasses import asdict, dataclass
from typing import Any

from core.pdf_parser import parse_pdf
from core.constants import INTERNAL_MOVEMENT_KEYWORDS, SALARY_KEYWORDS, SALARY_MIN_AMOUNT


@dataclass
class FileValidation:
    file: str
    bank: str
    movements_count: int
    first_date: str | None
    last_date: str | None
    metadata: dict[str, Any]
    checks: dict[str, Any]


def _is_internal(description: str) -> bool:
    d = description.lower()
    return any(k in d for k in INTERNAL_MOVEMENT_KEYWORDS)


def _date_key(date_str: str) -> tuple[int, int, int]:
    parts = date_str.split('/')
    if len(parts) == 3:
        try:
            return int(parts[2]), int(parts[1]), int(parts[0])
        except ValueError:
            return (0, 0, 0)
    return (0, 0, 0)


def _salary_candidates(movements: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for mv in movements:
        if mv.get('type') != 'Ingreso':
            continue
        amount = float(mv.get('amount') or 0)
        desc = str(mv.get('description') or '').upper()
        if amount >= SALARY_MIN_AMOUNT and any(k in desc for k in SALARY_KEYWORDS):
            out.append({'date': mv.get('date'), 'description': mv.get('description'), 'amount': amount})
    return sorted(out, key=lambda x: x['amount'], reverse=True)


def validate_file(path: str) -> FileValidation:
    movements, bank, metadata = parse_pdf(path)
    movements = sorted(movements, key=lambda m: _date_key(m.get('date', '')))
    first_date = movements[0]['date'] if movements else None
    last_date = movements[-1]['date'] if movements else None

    checks: dict[str, Any] = {
        'parse_ok': len(movements) > 0,
        'has_dates': first_date is not None and last_date is not None,
    }

    if bank == 'davivienda':
        income = sum(m['amount'] for m in movements if m.get('type') == 'Ingreso' and not _is_internal(str(m.get('description') or '')))
        expenses = sum(m['amount'] for m in movements if m.get('type') == 'Egreso' and not _is_internal(str(m.get('description') or '')))
        internal_count = sum(1 for m in movements if _is_internal(str(m.get('description') or '')))
        salary = _salary_candidates(movements)

        saldo_anterior = metadata.get('saldo_anterior')
        nuevo_saldo = metadata.get('nuevo_saldo')
        saldo_delta = None
        if saldo_anterior is not None and nuevo_saldo is not None:
            saldo_delta = float(nuevo_saldo) - float(saldo_anterior)

        checks.update({
            'saldo_fields_present': saldo_anterior is not None and nuevo_saldo is not None,
            'saldo_anterior': saldo_anterior,
            'nuevo_saldo': nuevo_saldo,
            'saldo_bolsillo': metadata.get('saldo_bolsillo'),
            'total_income_non_internal': round(income, 2),
            'total_expenses_non_internal': round(expenses, 2),
            'internal_movements_excluded_count': internal_count,
            'salary_candidates': salary[:3],
            'salary_detected': len(salary) > 0,
            'balance_delta_vs_flow': {
                'saldo_delta': round(saldo_delta, 2) if saldo_delta is not None else None,
                'income_minus_expenses': round(income - expenses, 2),
                'difference': round((saldo_delta - (income - expenses)), 2) if saldo_delta is not None else None,
            },
        })

    elif bank in ('falabella', 'bancolombia'):
        pagos = [m for m in movements if m.get('es_pago_tarjeta')]
        egresos = [m for m in movements if m.get('type') == 'Egreso' and not m.get('es_pago_tarjeta')]
        cuota_sum = sum(float(m.get('cuota_mes') or 0) for m in egresos if float(m.get('cuota_mes') or 0) > 0)
        diferidos_sum = sum(float(m.get('amount') or 0) for m in egresos if float(m.get('cuota_mes') or 0) == 0)

        checks.update({
            'credit_metadata_present': {
                'min_payment': metadata.get('min_payment') is not None,
                'total_payment': metadata.get('total_payment') is not None,
                'fecha_corte': metadata.get('fecha_corte') is not None,
                'fecha_limite_pago': metadata.get('fecha_limite_pago') is not None,
            },
            'min_payment': metadata.get('min_payment'),
            'total_payment': metadata.get('total_payment'),
            'consumos_periodo_proxy_cuota_sum': round(cuota_sum, 2),
            'diferidos_proxy_sum': round(diferidos_sum, 2),
            'payments_detected_count': len(pagos),
            'payments_total': round(sum(float(p.get('amount') or 0) for p in pagos), 2),
        })

    return FileValidation(
        file=path,
        bank=bank,
        movements_count=len(movements),
        first_date=first_date,
        last_date=last_date,
        metadata=metadata,
        checks=checks,
    )


def main() -> None:
    files = [
        r'C:\Users\Usuario\Downloads\EXTRACTO_FEB2026.pdf',
        r'C:\Users\Usuario\Downloads\EXTRACTO_MAR2026.pdf',
        r'C:\Users\Usuario\Downloads\extracto davivienda sin contraseña.pdf',
    ]

    results = []
    for f in files:
        if not os.path.exists(f):
            results.append({'file': f, 'error': 'NOT_FOUND'})
            continue
        try:
            results.append(asdict(validate_file(f)))
        except Exception as exc:  # noqa: BLE001
            results.append({'file': f, 'error': f'{type(exc).__name__}: {exc}'})

    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
