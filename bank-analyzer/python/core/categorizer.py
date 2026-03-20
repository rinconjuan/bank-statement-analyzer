import json
import unicodedata
from sqlalchemy.orm import Session
from models.database import Category, Movement, UserCategoryRule


def _normalize(text: str) -> str:
    """Lowercase and strip diacritics so accented/non-accented forms match."""
    return unicodedata.normalize('NFD', text.lower()).encode('ascii', 'ignore').decode('ascii')


def categorize_movement(description: str, categories: list, user_rules: list | None = None) -> int | None:
    """Find category_id for a movement description using keyword matching.

    Priority:
    1. User-defined rules (from manual category assignments)
    2. Default keyword matching

    Both description and keywords are normalized before comparison.
    The first match wins.
    """
    desc_norm = _normalize(description)

    # ── 1. Check user-defined rules first ────────────────────────────────────
    if user_rules:
        for rule in user_rules:
            if _normalize(rule.description_fragment) in desc_norm:
                return rule.category_id

    # ── 2. Fall back to keyword matching ─────────────────────────────────────
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


def save_user_rule(db: Session, description: str, category_id: int):
    """Persist a manual category assignment as a reusable rule.

    Uses the full description as the fragment.  Any future movement whose
    description contains this text will be classified to the same category.
    """
    fragment = description.strip()
    if not fragment:
        return
    existing = db.query(UserCategoryRule).filter(
        UserCategoryRule.description_fragment == fragment
    ).first()
    if existing:
        existing.category_id = category_id
    else:
        db.add(UserCategoryRule(description_fragment=fragment, category_id=category_id))
    db.commit()


def auto_categorize_movements(db: Session, month_id: int, statement_type: str = 'cuenta_ahorro'):
    """Auto-categorize all movements for a month.

    For *tarjeta_credito* statements every Ingreso movement is automatically
    assigned to the 'Pago/Abono Tarjeta' category (payments/refunds on the
    card), since those are never real salary entries.
    """
    categories = db.query(Category).all()
    user_rules = db.query(UserCategoryRule).all()
    movements = db.query(Movement).filter(Movement.month_id == month_id).all()

    abono_category = None
    if statement_type == 'tarjeta_credito':
        abono_category = next((c for c in categories if c.name == 'Pago/Abono Tarjeta'), None)

    for movement in movements:
        if abono_category and movement.type == 'Ingreso':
            movement.category_id = abono_category.id
        else:
            movement.category_id = categorize_movement(movement.description, categories, user_rules)
    db.commit()
