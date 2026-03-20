import pdfplumber
import re
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


def parse_pdf(file_path: str, password: str | None = None) -> tuple[list[dict], str]:
    """Parse PDF and return (movements, bank_name).

    Raises PDFPasswordRequiredError if the file is encrypted and no password
    (or a wrong password) is supplied.
    """
    movements = []
    bank_name = 'generic'

    open_kwargs: dict = {}
    if password:
        open_kwargs['password'] = password

    try:
        pdf_ctx = pdfplumber.open(file_path, **open_kwargs)
    except Exception as exc:
        # pdfplumber / pdfminer raises various exceptions for encrypted PDFs:
        # pdfminer.pdfdocument.PDFPasswordIncorrect  (wrong or empty password)
        # pdfminer.pdfpage.PDFTextExtractionNotAllowed  (some locked PDFs)
        exc_name = type(exc).__name__
        if exc_name in ('PDFPasswordIncorrect', 'PDFTextExtractionNotAllowed') or \
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

    return unique_movements, bank_name


# ---------------------------------------------------------------------------
# Falabella / CMR credit-card parser
# ---------------------------------------------------------------------------

def _parse_falabella(file_path: str, full_text: str, password: str | None = None) -> list[dict]:
    """Parse a Banco Falabella CMR credit-card statement.

    Uses two complementary strategies and merges the results:
    1. Line-by-line text regex – covers the vast majority of transactions.
    2. Table extraction – catches entries whose description spans multiple
       lines in the PDF (e.g. 'ABONO COMPRA MASTERCARD INTERN').
    """
    text_movs = _parse_falabella_text(full_text)
    table_movs = _parse_falabella_tables(file_path, password=password)

    # Merge: text results first, then add table entries not already present
    seen: set = set()
    merged: list[dict] = []

    for m in text_movs:
        key = (m['date'], round(m['amount'], 2))
        if key not in seen:
            seen.add(key)
            merged.append(m)

    for m in table_movs:
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
        movements.append({'date': date, 'description': description, 'amount': abs(amount), 'type': mov_type})

    return movements


def _parse_falabella_tables(file_path: str, password: str | None = None) -> list[dict]:
    """Extract movements from the pdfplumber tables of a Falabella statement.

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

                    # Column 3: transaction amount (first line when multi-line, e.g. USD entries)
                    # Column 6: cuota a pagar – used for payments/credits with '--$$...' values
                    col3 = (cells[3].split('\n')[0].strip()) if len(cells) > 3 else ''
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

                    mov_type = 'Ingreso' if amount < 0 else 'Egreso'
                    movements.append({'date': date, 'description': description, 'amount': abs(amount), 'type': mov_type})

    return movements


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
