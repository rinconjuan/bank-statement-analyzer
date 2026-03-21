import pdfplumber
import re
from datetime import datetime
from typing import Optional


class PDFPasswordRequiredError(Exception):
    """Raised when a PDF requires a password to open."""
    pass


BANK_PATTERNS = {
    'bancolombia': r'(\d{2}/\d{2}/\d{4})\s+(.+?)\s+([\d,.]+)\s+([\d,.]+)',
    'generic': r'(\d{2}/\d{2})\s+(.+?)\s+(-?\d+[.,]\d{2})',
}

# Lines to skip when scanning for pending COP amounts in Falabella statements.
# These lines follow a USD transaction and should not reset pending_cop.
_FALABELLA_SKIP_PREFIXES = ('TT..CC..', '1-Tarjeta', 'Página')

# Description fragment that identifies an insurance charge — these are never
# marked as deferred (es_diferido_anterior) even when cuota_mes == 0.
_FALABELLA_SEGURO_DESC = 'cobro seguro vida deudor'


def detect_bank(text: str) -> str:
    """Detect bank from PDF text using keywords"""
    text_lower = text.lower()
    if 'bancolombia' in text_lower:
        return 'bancolombia'
    if 'davivienda' in text_lower:
        return 'davivienda'
    if 'bbva' in text_lower:
        return 'bbva'
    if 'nequi' in text_lower:
        return 'nequi'
    if 'falabella' in text_lower or 'tarjeta cmr' in text_lower:
        return 'falabella'
    return 'generic'


def parse_amount(s: str) -> float:
    """Parse Colombian/European formatted numbers.

    Handles:
    - '$' currency prefix (single or doubled '$$' PDF artifact)
    - Doubled-character PDF artifacts: '$$33..999900,,0000' → 3990.00
    - Negative doubled prefix: '--$$44..339944,,1100' → -4394.10
    - Colombian thousands separator: '1.234.567,89' → 1234567.89
    """
    s = s.strip().replace(' ', '')
    # Decode doubled-character PDF artifact detectable by '..', ',,' or '$$'
    if '..' in s or ',,' in s or '$$' in s:
        s = re.sub(r'(.)\1', r'\1', s)
    # Detect negative (may be '--' after doubling collapse or single '-')
    negative = s.startswith('-')
    s = s.lstrip('-').lstrip('$')
    # Parse Colombian/European formatted numbers
    if ',' in s and '.' in s:
        if s.find(',') > s.rfind('.'):
            # Colombian format: 1.234.567,89
            s = s.replace('.', '').replace(',', '.')
        else:
            # European format: 1,234,567.89
            s = s.replace(',', '')
    elif ',' in s:
        s = s.replace(',', '.')
    val = float(s)
    return -val if negative else val


def _is_doubled_text(s: str) -> bool:
    """Return True when *s* is a doubled-character PDF artifact (e.g. 'PPAAGGOO')."""
    non_space = s.replace(' ', '').replace('\n', '')
    if len(non_space) < 4:
        return False
    pairs = sum(1 for i in range(0, len(non_space) - 1, 2) if non_space[i] == non_space[i + 1])
    return pairs >= len(non_space) // 2 * 0.8


def parse_pdf(file_path: str, password: str | None = None) -> tuple[list[dict], str, dict]:
    """Parse PDF and return (movements, bank_name, metadata).

    metadata keys:
      - min_payment:    float | None  (credit card minimum payment due)
      - total_payment:  float | None  (credit card total balance due)
      - saldo_anterior: float | None  (Davivienda previous balance)
      - nuevo_saldo:    float | None  (Davivienda new/closing balance)
      - saldo_bolsillo: float | None  (Davivienda pocket/savings balance)

    Raises PDFPasswordRequiredError if the file is encrypted and no password
    (or a wrong password) is supplied.
    """
    movements = []
    bank_name = 'generic'
    metadata: dict = {'min_payment': None, 'total_payment': None}

    open_kwargs: dict = {}
    if password:
        open_kwargs['password'] = password

    try:
        pdf_ctx = pdfplumber.open(file_path, **open_kwargs)
    except Exception as exc:
        # pdfplumber wraps pdfminer exceptions in PdfminerException on some builds.
        # We also match the raw pdfminer exception names for environments where the
        # wrapper is not used (older pdfplumber versions).
        # Recognised exception class names:
        #   pdfminer.pdfdocument.PDFPasswordIncorrect
        #   pdfminer.pdfpage.PDFTextExtractionNotAllowed
        #   pdfplumber.utils.exceptions.PdfminerException  (Windows / newer pdfplumber)
        exc_name = type(exc).__name__
        if exc_name in ('PDFPasswordIncorrect', 'PDFTextExtractionNotAllowed',
                        'PdfminerException') or \
                'password' in str(exc).lower() or 'encrypt' in str(exc).lower():
            raise PDFPasswordRequiredError('PDF is password-protected') from exc
        raise

    with pdf_ctx as pdf:
        full_text = ''
        for page in pdf.pages:
            page_text = page.extract_text() or ''
            full_text += page_text + '\n'

        bank_name = detect_bank(full_text)

        if bank_name == 'falabella':
            # Use the dedicated Falabella parser (text-based + table for split-line entries)
            movements = _parse_falabella(file_path, full_text, password=password)
            metadata = _extract_falabella_metadata(full_text)
        elif bank_name == 'davivienda':
            movements, davivienda_meta = _parse_davivienda(file_path, full_text, password=password)
            metadata.update(davivienda_meta)
        else:
            # Generic path: try table extraction first, fall back to regex
            for page in pdf.pages:
                tables = page.extract_tables()
                for table in tables:
                    for row in table:
                        if row and len(row) >= 3:
                            parsed = _parse_table_row(row, bank_name)
                            if parsed:
                                movements.append(parsed)

            if not movements:
                pattern = BANK_PATTERNS.get(bank_name, BANK_PATTERNS['generic'])
                for match in re.finditer(pattern, full_text):
                    parsed = _parse_regex_match(match, bank_name)
                    if parsed:
                        movements.append(parsed)

    # Remove duplicates
    seen: set = set()
    unique_movements = []
    for m in movements:
        key = (m['date'], m['description'], m['amount'])
        if key not in seen:
            seen.add(key)
            unique_movements.append(m)

    return unique_movements, bank_name, metadata


# ---------------------------------------------------------------------------
# Falabella metadata extraction (pago total / pago mínimo)
# ---------------------------------------------------------------------------

def _extract_falabella_metadata(text: str) -> dict:
    """Extract the total and minimum payment amounts, dates, and credit limits from a
    Falabella credit card statement.

    The PDF uses doubled characters for text (e.g. 'TTuu' = 'Tu') but normal
    single digits for numbers.  Each line is decoded individually so that
    keywords can be recognised while the numeric part is read from the original
    line (decoding would corrupt repeated digits like '33' → '3').
    """
    metadata: dict = {
        'min_payment': None, 'total_payment': None,
        'fecha_corte': None, 'fecha_limite_pago': None,
        'cupo_total': None, 'cupo_disponible': None,
    }

    _ES_MONTHS_SHORT = {
        # Abbreviated (3-letter) forms
        'ene': 1, 'feb': 2, 'mar': 3, 'abr': 4, 'may': 5, 'jun': 6,
        'jul': 7, 'ago': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dic': 12,
        # Full names (in case the PDF text is not abbreviated)
        'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5,
        'junio': 6, 'julio': 7, 'agosto': 8, 'septiembre': 9,
        'octubre': 10, 'noviembre': 11, 'diciembre': 12,
    }

    def _parse_es_date(s: str) -> 'str | None':
        """Convert 'DD mmm YYYY' (in decoded string) to 'DD/MM/YYYY'.

        Normalises multiple/collapsed spaces first so that doubled characters
        in folded PDF text (e.g. '14  e n e  2026' → '14 e n e 2026') are
        collapsed before the regex runs.  The regex is intentionally permissive
        with whitespace between tokens to handle residual spacing artefacts.
        """
        # Collapse any run of whitespace to a single space
        s = re.sub(r'\s+', ' ', s.strip())
        m = re.search(r'(\d{1,2})\s*([a-záéíóú]{3,})\s*(\d{4})', s, re.IGNORECASE)
        if not m:
            return None
        day_s, month_s, year_s = m.group(1), m.group(2)[:3].lower(), m.group(3)
        month_num = _ES_MONTHS_SHORT.get(month_s)
        if not month_num:
            return None
        return f"{int(day_s):02d}/{month_num:02d}/{year_s}"

    for raw_line in text.split('\n'):
        raw_line = raw_line.strip()
        if not raw_line:
            continue
        decoded = re.sub(r'(.)\1', r'\1', raw_line).lower()

        # ── Amounts (lines that contain '$') ──────────────────────────────────
        if '$' in raw_line:
            amt_m = re.search(r'\$\s*([\d.,]+)', raw_line)
            if amt_m:
                try:
                    amount = parse_amount(amt_m.group(1))
                except Exception:
                    amount = 0

                if amount > 0:
                    if 'pago total' in decoded and metadata['total_payment'] is None:
                        metadata['total_payment'] = amount
                    elif ('pago' in decoded
                          and ('minimo' in decoded or 'mínimo' in decoded)
                          and metadata['min_payment'] is None):
                        metadata['min_payment'] = amount
                    elif 'cupo total' in decoded and metadata['cupo_total'] is None:
                        metadata['cupo_total'] = amount
                    elif ('disponible' in decoded) and metadata['cupo_disponible'] is None:
                        metadata['cupo_disponible'] = amount

        # ── Date fields ────────────────────────────────────────────────────────
        if ('antes del' in decoded or 'paga antes' in decoded) and metadata['fecha_limite_pago'] is None:
            fecha = _parse_es_date(decoded)
            if fecha:
                metadata['fecha_limite_pago'] = fecha
        elif ('corte' in decoded) and metadata['fecha_corte'] is None:
            # Extract only the substring starting at 'corte' so that, when the
            # line also contains the period-start date (e.g. "15 ene 2026 al
            # 14 feb 2026 … corte: 14 feb 2026"), re.search does not pick up
            # the earlier (wrong) date.
            corte_idx = decoded.find('corte')
            fecha = _parse_es_date(decoded[corte_idx:])
            if fecha:
                metadata['fecha_corte'] = fecha

    return metadata


# ---------------------------------------------------------------------------
# Falabella / CMR credit-card parser
# ---------------------------------------------------------------------------

def _parse_falabella(file_path: str, full_text: str, password: str | None = None) -> list[dict]:
    """Parse a Banco Falabella CMR credit-card statement.

    Uses two complementary strategies and merges the results:
    1. Table extraction – primary source; captures cuota_mes, valor_pendiente,
       num_cuotas, and all credit-card flags per entry.
    2. Line-by-line text regex – fallback for entries not captured by tables
       (e.g. entries whose description spans multiple lines in the table).

    Table data takes priority when both sources capture the same entry
    (matched by date + rounded amount).
    """
    table_movs = _parse_falabella_tables(file_path, password=password)
    text_movs = _parse_falabella_text(full_text)

    # Build seen set from table results (primary)
    seen: set = set()
    merged: list[dict] = []

    for m in table_movs:
        key = (m['date'], round(m['amount'], 2))
        if key not in seen:
            seen.add(key)
            merged.append(m)

    # Add text-only entries not already captured by tables
    for m in text_movs:
        key = (m['date'], round(m['amount'], 2))
        if key not in seen:
            seen.add(key)
            merged.append(m)

    merged.sort(key=lambda m: m['date'])
    return merged


def _parse_falabella_text(text: str) -> list[dict]:
    """Extract movements from the raw text of a Falabella statement."""
    movements: list[dict] = []

    # Match: DD/MM/YYYY  DESCRIPTION  TT|A  <rest of line>
    TXN_LINE = re.compile(r'^(\d{2}/\d{2}/\d{4})\s+(.+?)\s+(?:TT|AT|A)\s+(.*)')
    # Standalone COP-amount line that precedes a USD transaction (e.g. '$157.189,22')
    STANDALONE_COP = re.compile(r'^\$([\d.]+,\d{2})$')
    # Amount at the start of the rest-of-line: optional '--', 1-2 '$', digits/dots/commas
    AMOUNT_PAT = re.compile(r'^(-{0,2}\${1,2}[\d.,]+)')

    pending_cop: Optional[str] = None

    for line in text.split('\n'):
        line = line.strip()
        if not line:
            pending_cop = None
            continue

        # Standalone COP amount that belongs to the *next* USD transaction
        m = STANDALONE_COP.match(line)
        if m:
            pending_cop = '$' + m.group(1)
            continue

        m = TXN_LINE.match(line)
        if not m:
            # Keep pending_cop across T.C. annotation lines and page footers
            if not any(line.startswith(p) for p in _FALABELLA_SKIP_PREFIXES):
                pending_cop = None
            continue

        date, description, rest = m.groups()
        description = description.strip()

        # Decode doubled descriptions (e.g. 'PPAAGGOO TTAARRJJEETTAA' → 'PAGO TARJETA')
        if _is_doubled_text(description):
            description = re.sub(r'(.)\1', r'\1', description)

        rest = rest.strip()
        amount_str: Optional[str] = None

        if re.match(r'[\d]+[.,][\d]+\s+UUSSDD', rest):
            # USD transaction: the PDF doubles each character, so 'USD' appears as 'UUSSDD'.
            # The COP equivalent appears on a standalone line just before this entry.
            amount_str = pending_cop
            pending_cop = None
        else:
            m_amt = AMOUNT_PAT.match(rest)
            if m_amt:
                amount_str = m_amt.group(1)
            pending_cop = None

        if not amount_str:
            continue

        try:
            amount = parse_amount(amount_str)
        except Exception:
            continue

        if amount == 0:
            continue

        # Credit-card convention: positive = purchase (Egreso), negative = payment/credit (Ingreso)
        mov_type = 'Ingreso' if amount < 0 else 'Egreso'
        es_pago = 'pago tarjeta' in description.lower() or 'pago tc' in description.lower()
        movements.append({
            'date': date,
            'description': description,
            'amount': abs(amount),
            'type': mov_type,
            'cuota_mes': 0.0,
            'valor_pendiente': 0.0,
            'num_cuotas_actual': None,
            'num_cuotas_total': None,
            'aplica_este_extracto': es_pago,  # text parser can't determine from cuota_mes
            'es_pago_tarjeta': es_pago,
            'es_diferido_anterior': False,
        })

    return movements


def _parse_cuotas(s: str) -> tuple:
    """Parse '2 de 24' → (2, 24). Returns (None, None) if not parseable."""
    m = re.search(r'(\d+)\s+de\s+(\d+)', s.lower())
    if m:
        return int(m.group(1)), int(m.group(2))
    m2 = re.match(r'^(\d+)$', s.strip())
    if m2:
        return int(m2.group(1)), None
    return None, None


def _parse_falabella_tables(file_path: str, password: str | None = None) -> list[dict]:
    """Extract movements from the pdfplumber tables of a Falabella statement.

    Table columns (Falabella credit card):
      0: Fecha  1: Detalle  2: Titular/Adicional  3: Valor movimiento
      4: Num cuotas  5: Tasa efectiva anual  6: Cuota a pagar este mes
      7: Valor pendiente

    Covers entries whose description is split across lines in the raw text
    (e.g. 'ABONO COMPRA MASTERCARD INTERN').
    """
    movements: list[dict] = []
    open_kwargs: dict = {}
    if password:
        open_kwargs['password'] = password

    with pdfplumber.open(file_path, **open_kwargs) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables():
                for row in table:
                    cells = [str(c) if c is not None else '' for c in row]
                    if len(cells) < 3:
                        continue

                    date = cells[0].strip()
                    if not re.match(r'^\d{2}/\d{2}/\d{4}$', date):
                        continue

                    description = cells[1].strip() if len(cells) > 1 else ''
                    description = description.replace('\n', ' ').strip()
                    if _is_doubled_text(description):
                        description = re.sub(r'(.)\1', r'\1', description)
                    if not description:
                        continue

                    # Column 3: transaction amount (first line for USD/COP multi-line entries)
                    col3 = (cells[3].split('\n')[0].strip()) if len(cells) > 3 else ''
                    # Column 6: cuota a pagar — also used as amount fallback for payments
                    col6 = cells[6].strip() if len(cells) > 6 else ''
                    amount_str = col3 or col6

                    if not amount_str:
                        continue

                    try:
                        amount = parse_amount(amount_str)
                    except Exception:
                        continue

                    if amount == 0:
                        continue

                    # Extract cuota_mes (col 6) — separate from amount
                    cuota_mes = 0.0
                    if len(cells) > 6 and cells[6].strip():
                        try:
                            cuota_mes = abs(parse_amount(cells[6].strip()))
                        except Exception:
                            cuota_mes = 0.0

                    # Extract valor_pendiente (col 7)
                    valor_pendiente = 0.0
                    if len(cells) > 7 and cells[7].strip():
                        try:
                            valor_pendiente = abs(parse_amount(cells[7].strip()))
                        except Exception:
                            valor_pendiente = 0.0

                    # Extract num_cuotas (col 4) — format "X de Y"
                    num_cuotas_actual: Optional[int] = None
                    num_cuotas_total: Optional[int] = None
                    if len(cells) > 4 and cells[4].strip():
                        raw_cuotas = cells[4].strip()
                        if _is_doubled_text(raw_cuotas):
                            raw_cuotas = re.sub(r'(.)\1', r'\1', raw_cuotas)
                        num_cuotas_actual, num_cuotas_total = _parse_cuotas(raw_cuotas)

                    mov_type = 'Ingreso' if amount < 0 else 'Egreso'
                    es_pago = 'pago tarjeta' in description.lower() or 'pago tc' in description.lower()
                    aplica = cuota_mes > 0 or es_pago
                    diferido = (not aplica) and (cuota_mes == 0) and (
                        _FALABELLA_SEGURO_DESC not in description.lower()
                    )

                    movements.append({
                        'date': date,
                        'description': description,
                        'amount': abs(amount),
                        'type': mov_type,
                        'cuota_mes': cuota_mes,
                        'valor_pendiente': valor_pendiente,
                        'num_cuotas_actual': num_cuotas_actual,
                        'num_cuotas_total': num_cuotas_total,
                        'aplica_este_extracto': aplica,
                        'es_pago_tarjeta': es_pago,
                        'es_diferido_anterior': diferido,
                    })

    return movements


# ---------------------------------------------------------------------------
# Davivienda savings/checking account parser
# ---------------------------------------------------------------------------

def _parse_davivienda(file_path: str, full_text: str, password: str | None = None) -> list[dict]:
    """Parse a Banco Davivienda account statement.

    Table columns: [day, month, '$amount+/-', doc_number, description, office]
    The date year is extracted from the 'INFORME DEL MES' header line.
    The 'EXTRACTO BOLSILLO' (pocket) section is skipped to avoid duplicates.
    """
    movements: list[dict] = []

    # Internal-transfer keywords for the savings pocket ("Bolsillo").
    # Any movement whose description contains one of these strings is skipped
    # because it represents a transfer between the main account balance and the
    # pocket — not a real income or expense.
    # 'bolsillo' is generic and catches all variants.
    # Mirrors _INTERNAL_MOVEMENT_KEYWORDS in summary.py — keep them in sync.
    _BOLSILLO_KEYWORDS = (
        'bolsillo',               # catches any pocket variant
        'traslado rendimientos',
        'abono rendimientos netos',
    )

    # Extract statement year from header (e.g. 'INFORME DEL MES:FEBRERO /2026')
    year_m = re.search(r'INFORME DEL MES[:\s]+\w+\s*/(\d{4})', full_text, re.IGNORECASE)
    year = year_m.group(1) if year_m else str(datetime.now().year)

    # ── Extract balance metadata from free text ────────────────────────────
    # Lines in the PDF look like: "Saldo Anterior $2,805,400.83"
    davivienda_meta: dict = {
        'saldo_anterior': None,
        'nuevo_saldo': None,
        'saldo_bolsillo': None,
    }
    for line in full_text.split('\n'):
        line_s = line.strip()
        line_lower = line_s.lower()
        if davivienda_meta['saldo_anterior'] is None and 'saldo anterior' in line_lower:
            m_amt = re.search(r'\$\s*([\d.,]+)', line_s)
            if m_amt:
                try:
                    davivienda_meta['saldo_anterior'] = parse_amount(m_amt.group(1))
                except Exception:
                    pass
        if davivienda_meta['nuevo_saldo'] is None and 'nuevo saldo' in line_lower:
            m_amt = re.search(r'\$\s*([\d.,]+)', line_s)
            if m_amt:
                try:
                    davivienda_meta['nuevo_saldo'] = parse_amount(m_amt.group(1))
                except Exception:
                    pass
        if davivienda_meta['saldo_bolsillo'] is None and 'saldo total bolsillo' in line_lower:
            m_amt = re.search(r'\$\s*([\d.,]+)', line_s)
            if m_amt:
                try:
                    davivienda_meta['saldo_bolsillo'] = parse_amount(m_amt.group(1))
                except Exception:
                    pass

    open_kwargs: dict = {}
    if password:
        open_kwargs['password'] = password

    with pdfplumber.open(file_path, **open_kwargs) as pdf:
        in_bolsillo = False
        for page in pdf.pages:
            # Strategy 1: skip entire pages that belong to the H.02 Bolsillo section.
            # This is the strongest guard — if the page header identifies it as H.02
            # or "EXTRACTO BOLSILLO", none of its tables should be processed.
            page_text = page.extract_text() or ''
            if 'H.02' in page_text or 'EXTRACTO BOLSILLO' in page_text:
                continue
            for table in page.extract_tables():
                for row in table:
                    cells = [str(c).strip() if c is not None else '' for c in row]
                    row_text = ' '.join(cells).upper()

                    # Detect section header rows
                    if ('EXTRACTO' in row_text and 'BOLSILLO' in row_text) or \
                            'H.02' in row_text or 'BOLSILLO AHORRO' in row_text:
                        in_bolsillo = True
                        continue
                    if 'EXTRACTO' in row_text and 'BOLSILLO' not in row_text:
                        in_bolsillo = False
                        continue

                    if in_bolsillo:
                        continue

                    # Need at least: day, month, amount, doc, description
                    if len(cells) < 5:
                        continue

                    day_str = cells[0]
                    month_str = cells[1]
                    amount_raw = cells[2]
                    description = cells[4] if len(cells) > 4 else ''

                    # Validate day and month are digits in valid ranges
                    if not (day_str.isdigit() and month_str.isdigit()):
                        continue
                    day_i, month_i = int(day_str), int(month_str)
                    if not (1 <= day_i <= 31 and 1 <= month_i <= 12):
                        continue

                    # Amount must end with '+' or '-'
                    if not amount_raw or amount_raw[-1] not in ('+', '-'):
                        continue

                    # Skip header or label rows
                    if description.lower() in ('clase de movimiento', 'oficina', 'fecha', 'valor', 'doc.', ''):
                        continue

                    # Skip bolsillo (pocket) movements – they are internal transfers between
                    # the main account balance and the savings pocket, not real income/expense.
                    if any(kw in description.lower() for kw in _BOLSILLO_KEYWORDS):
                        continue

                    sign = amount_raw[-1]
                    amount_clean = amount_raw[:-1].strip().lstrip('$').strip()
                    try:
                        amount = parse_amount(amount_clean)
                    except Exception:
                        continue

                    if amount == 0:
                        continue

                    date_str = f"{day_i:02d}/{month_i:02d}/{year}"
                    mov_type = 'Ingreso' if sign == '+' else 'Egreso'
                    movements.append({
                        'date': date_str,
                        'description': description,
                        'amount': amount,
                        'type': mov_type,
                    })

    return movements, davivienda_meta


# ---------------------------------------------------------------------------
# Generic parsers (non-Falabella banks)
# ---------------------------------------------------------------------------

def _parse_table_row(row: list, bank_name: str) -> Optional[dict]:
    """Try to parse a generic table row into a movement."""
    try:
        cells = [str(c).strip() for c in row if c is not None and str(c).strip()]
        if len(cells) < 3:
            return None

        date_pattern = re.compile(r'\d{2}/\d{2}(/\d{4})?')
        date_cell = None
        date_idx = -1
        for i, cell in enumerate(cells[:3]):
            if date_pattern.match(cell):
                date_cell = cell
                date_idx = i
                break

        if date_cell is None:
            return None

        remaining = cells[date_idx + 1:]
        if not remaining:
            return None

        amount = None
        amount_idx = -1
        for i in range(len(remaining) - 1, -1, -1):
            try:
                amount = parse_amount(remaining[i])
                amount_idx = i
                break
            except (ValueError, AttributeError):
                continue

        if amount is None:
            return None

        description = ' '.join(remaining[:amount_idx]).strip()
        if not description:
            return None

        mov_type = 'Egreso' if amount < 0 else 'Ingreso'
        amount = abs(amount)

        return {
            'date': date_cell,
            'description': description,
            'amount': amount,
            'type': mov_type,
        }
    except Exception:
        return None


def _parse_regex_match(match: re.Match, bank_name: str) -> Optional[dict]:
    """Parse a regex match into a movement."""
    try:
        groups = match.groups()
        if bank_name == 'bancolombia' and len(groups) >= 4:
            date, description, amount_str, _ = groups[:4]
            amount = parse_amount(amount_str)
        elif len(groups) >= 3:
            date, description, amount_str = groups[:3]
            amount = parse_amount(amount_str)
        else:
            return None

        description = description.strip()
        if len(description) < 2:
            return None

        mov_type = 'Egreso' if amount < 0 else 'Ingreso'
        amount = abs(amount)

        return {
            'date': date,
            'description': description,
            'amount': amount,
            'type': mov_type,
        }
    except Exception:
        return None
