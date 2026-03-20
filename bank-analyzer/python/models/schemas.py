import json
from datetime import datetime
from pydantic import BaseModel, ConfigDict, field_validator


class CategoryBase(BaseModel):
    name: str
    keywords: list[str]
    color: str = '#6366f1'
    icon: str = '📦'

    @field_validator('keywords', mode='before')
    @classmethod
    def parse_keywords(cls, v: object) -> list:
        """Accept a JSON string stored in the DB and deserialize it to a list."""
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return []
        return v


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: str | None = None
    keywords: list[str] | None = None
    color: str | None = None
    icon: str | None = None


class Category(CategoryBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class MovementBase(BaseModel):
    date: str
    description: str
    amount: float
    type: str  # 'Ingreso' | 'Egreso'


class MovementCreate(MovementBase):
    month_id: int
    category_id: int | None = None
    note: str | None = None


class MovementUpdate(BaseModel):
    category_id: int | None = None
    note: str | None = None


class Movement(MovementBase):
    id: int
    month_id: int
    category_id: int | None = None
    note: str | None = None
    category: Category | None = None
    model_config = ConfigDict(from_attributes=True)


class MonthBase(BaseModel):
    year: int
    month: int
    bank_name: str | None = None
    file_name: str


class MonthCreate(MonthBase):
    pass


class Month(MonthBase):
    id: int
    uploaded_at: datetime
    model_config = ConfigDict(from_attributes=True)


class MonthWithStats(Month):
    total_income: float
    total_expenses: float
    movements_count: int


class UploadResponse(BaseModel):
    month_id: int
    year: int
    month: int
    movements_count: int
    preview: list[Movement]


class CategorySummary(BaseModel):
    category_id: int | None
    category_name: str
    category_color: str
    category_icon: str
    total: float
    count: int


class MovementsSummary(BaseModel):
    by_category: list[CategorySummary]
    total_income: float
    total_expenses: float
    balance: float
