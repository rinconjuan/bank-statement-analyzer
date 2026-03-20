import json
import unicodedata
from sqlalchemy.orm import Session
from models.database import Category, Movement


def _normalize(text: str) -> str:
    """Lowercase and strip diacritics so accented/non-accented forms match."""
    return unicodedata.normalize('NFD', text.lower()).encode('ascii', 'ignore').decode('ascii')


def categorize_movement(description: str, categories: list) -> int | None:
    """Find category_id for a movement description using keyword matching.

    Both the description and each keyword are normalized (lowercased, accents
    stripped) before comparison, so 'éxito' and 'exito' both match 'ÉXITO'.
    Categories are checked in DB order; more specific keywords are expected to
    live in more specific categories seeded early.  The first match wins.
    """
    desc_norm = _normalize(description)
    for cat in categories:
        try:
            keywords = json.loads(cat.keywords) if isinstance(cat.keywords, str) else cat.keywords
        except Exception:
            keywords = []
        for keyword in keywords:
            if _normalize(keyword) in desc_norm:
                return cat.id
    # Return 'Otros' category id if it exists
    for cat in categories:
        if cat.name == 'Otros':
            return cat.id
    return None


def auto_categorize_movements(db: Session, month_id: int, statement_type: str = 'cuenta_ahorro'):
    """Auto-categorize all movements for a month.

    For *tarjeta_credito* statements every Ingreso movement is automatically
    assigned to the 'Pago/Abono Tarjeta' category (payments/refunds on the
    card), since those are never real salary entries.
    """
    categories = db.query(Category).all()
    movements = db.query(Movement).filter(Movement.month_id == month_id).all()

    abono_category = None
    if statement_type == 'tarjeta_credito':
        abono_category = next((c for c in categories if c.name == 'Pago/Abono Tarjeta'), None)

    for movement in movements:
        if abono_category and movement.type == 'Ingreso':
            movement.category_id = abono_category.id
        else:
            movement.category_id = categorize_movement(movement.description, categories)
    db.commit()
