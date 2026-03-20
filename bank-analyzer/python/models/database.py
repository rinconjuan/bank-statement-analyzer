import os
from datetime import datetime, timezone
from sqlalchemy import (
    create_engine, Column, Integer, String, Float, Text,
    DateTime, ForeignKey, UniqueConstraint, CheckConstraint
)
from sqlalchemy.orm import DeclarativeBase, relationship, sessionmaker

DB_PATH = os.environ.get('DB_PATH', './bank_analyzer.db')
engine = create_engine(f'sqlite:///{DB_PATH}', connect_args={'check_same_thread': False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class Category(Base):
    __tablename__ = 'categories'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    keywords = Column(Text, default='[]')
    color = Column(String, default='#6366f1')
    icon = Column(String, default='📦')

    movements = relationship('Movement', back_populates='category')


class Month(Base):
    __tablename__ = 'months'

    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    bank_name = Column(String, nullable=True)
    file_name = Column(String, nullable=False)
    uploaded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (UniqueConstraint('year', 'month', name='uq_year_month'),)

    movements = relationship('Movement', back_populates='month_rel', cascade='all, delete-orphan')


class Movement(Base):
    __tablename__ = 'movements'

    id = Column(Integer, primary_key=True, index=True)
    month_id = Column(Integer, ForeignKey('months.id', ondelete='CASCADE'), nullable=False)
    date = Column(String, nullable=False)
    description = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    type = Column(String, nullable=False)
    category_id = Column(Integer, ForeignKey('categories.id', ondelete='SET NULL'), nullable=True)
    note = Column(Text, nullable=True)

    __table_args__ = (CheckConstraint("type IN ('Ingreso', 'Egreso')", name='ck_movement_type'),)

    month_rel = relationship('Month', back_populates='movements')
    category = relationship('Category', back_populates='movements')


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
