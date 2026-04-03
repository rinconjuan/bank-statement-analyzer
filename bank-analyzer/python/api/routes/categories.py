import json

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from models.database import get_db, Category, Movement
from models.schemas import Category as CategorySchema, CategoryCreate, CategoryUpdate, CategoryDeleteRequest

router = APIRouter()


@router.get('', response_model=list[CategorySchema])
def get_categories(db: Session = Depends(get_db)):
    cats = db.query(Category).order_by(Category.name).all()
    result = []
    for cat in cats:
        try:
            keywords = json.loads(cat.keywords)
        except Exception:
            keywords = []
        result.append(CategorySchema(
            id=cat.id,
            name=cat.name,
            keywords=keywords,
            color=cat.color,
            icon=cat.icon
        ))
    return result


@router.post('', response_model=CategorySchema)
def create_category(data: CategoryCreate, db: Session = Depends(get_db)):
    existing = db.query(Category).filter(Category.name == data.name).first()
    if existing:
        raise HTTPException(409, 'Category already exists')
    cat = Category(
        name=data.name,
        keywords=json.dumps(data.keywords, ensure_ascii=False),
        color=data.color,
        icon=data.icon
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return CategorySchema(id=cat.id, name=cat.name, keywords=data.keywords, color=cat.color, icon=cat.icon)


@router.put('/{category_id}', response_model=CategorySchema)
def update_category(category_id: int, data: CategoryUpdate, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(404, 'Category not found')
    if data.name is not None:
        cat.name = data.name
    if data.keywords is not None:
        cat.keywords = json.dumps(data.keywords, ensure_ascii=False)
    if data.color is not None:
        cat.color = data.color
    if data.icon is not None:
        cat.icon = data.icon
    db.commit()
    db.refresh(cat)
    try:
        keywords = json.loads(cat.keywords)
    except Exception:
        keywords = []
    return CategorySchema(id=cat.id, name=cat.name, keywords=keywords, color=cat.color, icon=cat.icon)


@router.delete('/{category_id}')
def delete_category(
    category_id: int,
    data: CategoryDeleteRequest | None = Body(default=None),
    db: Session = Depends(get_db)
):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(404, 'Category not found')
    has_movements = db.query(Movement).filter(Movement.category_id == category_id).first()
    if has_movements:
        replacement_id = data.replacement_category_id if data else None
        if replacement_id is None:
            raise HTTPException(409, 'Category has associated movements. Provide replacement_category_id')
        if replacement_id == category_id:
            raise HTTPException(400, 'replacement_category_id must be different from category_id')
        replacement = db.query(Category).filter(Category.id == replacement_id).first()
        if not replacement:
            raise HTTPException(404, 'Replacement category not found')
        db.query(Movement).filter(Movement.category_id == category_id).update(
            {Movement.category_id: replacement_id},
            synchronize_session=False
        )
    db.delete(cat)
    db.commit()
    return {'ok': True}
