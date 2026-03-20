import pdfplumber
import re
from typing import Optional

BANK_PATTERNS = {
    'bancolombia': r'(\d{2}/\d{2}/\d{4})\s+(.+?)\s+([\d,.]+)\s+([\d,.]+)',
    'generic': r'(\d{2}/\d{2})\s+(.+?)\s+(-?\d+[.,]\d{2})',
}


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
    return 'generic'


def parse_amount(s: str) -> float:
    """Parse Colombian/European formatted numbers"""
    s = s.strip().replace(' ', '')
    if ',' in s and '.' in s:
        if s.find(',') < s.find('.'):
            s = s.replace(',', '')
        else:
            s = s.replace('.', '').replace(',', '.')
    elif ',' in s:
        s = s.replace(',', '.')
    return float(s)


def parse_pdf(file_path: str) -> tuple[list[dict], str]:
    """Parse PDF and return (movements, bank_name)"""
    movements = []
    bank_name = 'generic'

    with pdfplumber.open(file_path) as pdf:
        full_text = ''
        for page in pdf.pages:
            page_text = page.extract_text() or ''
            full_text += page_text + '\n'

        bank_name = detect_bank(full_text)

        # Try table extraction first
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                for row in table:
                    if row and len(row) >= 3:
                        parsed = _parse_table_row(row, bank_name)
                        if parsed:
                            movements.append(parsed)

        # Fall back to regex if no movements found
        if not movements:
            pattern = BANK_PATTERNS.get(bank_name, BANK_PATTERNS['generic'])
            for match in re.finditer(pattern, full_text):
                parsed = _parse_regex_match(match, bank_name)
                if parsed:
                    movements.append(parsed)

    # Remove duplicates
    seen = set()
    unique_movements = []
    for m in movements:
        key = (m['date'], m['description'], m['amount'])
        if key not in seen:
            seen.add(key)
            unique_movements.append(m)

    return unique_movements, bank_name


def _parse_table_row(row: list, bank_name: str) -> Optional[dict]:
    """Try to parse a table row into a movement"""
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
    """Parse a regex match into a movement"""
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
