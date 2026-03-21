"""Shared constants used across multiple API routes and parsers."""

# Bank-fee line descriptions that always apply to the current statement
# even though Falabella does not populate cuota_mes for them.
FIXED_CHARGE_KEYWORDS: tuple[str, ...] = (
    'COBRO SEGURO VIDA DEUDOR',
    'COBRO CUOTA MANEJO',
)

# Keywords used to detect Falabella-related debit entries in a savings account.
FALABELLA_PAYMENT_KEYWORDS: tuple[str, ...] = (
    'FALABELLA',
    'BANCO FALABELLA',
    'CMR',
)

# Keywords used to identify salary / primary income credits.
SALARY_KEYWORDS: tuple[str, ...] = (
    'CITIBANK',
    'TRANSFERENCIA',
    'NOMINA',
    'SALARIO',
    'SUELDO',
)

# Minimum amount (COP) for an income movement to be considered a salary.
SALARY_MIN_AMOUNT: float = 1_000_000.0
