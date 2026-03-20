import json
from sqlalchemy.orm import Session
from models.database import Category, Movement


def categorize_movement(description: str, categories: list) -> int | None:
    """Find category_id for a movement description"""
    description_lower = description.lower()
    for cat in categories:
        try:
            keywords = json.loads(cat.keywords) if isinstance(cat.keywords, str) else cat.keywords
        except Exception:
            keywords = []
        for keyword in keywords:
            if keyword.lower() in description_lower:
                return cat.id
    # Return 'Otros' category id if exists
    for cat in categories:
        if cat.name == 'Otros':
            return cat.id
    return None


def auto_categorize_movements(db: Session, month_id: int):
    """Auto-categorize all movements for a month"""
    categories = db.query(Category).all()
    movements = db.query(Movement).filter(Movement.month_id == month_id).all()
    for movement in movements:
        category_id = categorize_movement(movement.description, categories)
        movement.category_id = category_id
    db.commit()
