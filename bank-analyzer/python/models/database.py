import os
from datetime import datetime, timezone
from sqlalchemy import (
    create_engine, Column, Integer, String, Float, Text,
    DateTime, ForeignKey, CheckConstraint, text
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


class UserCategoryRule(Base):
    """Stores manual category assignments to improve future auto-categorization."""
    __tablename__ = 'user_category_rules'

    id = Column(Integer, primary_key=True, index=True)
    description_fragment = Column(String, nullable=False, unique=True)
    category_id = Column(Integer, ForeignKey('categories.id', ondelete='CASCADE'), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    category = relationship('Category')


class Month(Base):
    __tablename__ = 'months'

    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    bank_name = Column(String, nullable=True)
    file_name = Column(String, nullable=False)
    statement_type = Column(String, default='cuenta_ahorro')
    uploaded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    min_payment = Column(Float, nullable=True)
    total_payment = Column(Float, nullable=True)
    # Credit card extended fields
    fecha_corte = Column(String, nullable=True)
    fecha_limite_pago = Column(String, nullable=True)
    cupo_total = Column(Float, default=0.0)
    cupo_disponible = Column(Float, default=0.0)
    consumos_periodo = Column(Float, default=0.0)
    # Davivienda balance fields
    saldo_anterior = Column(Float, nullable=True)
    nuevo_saldo = Column(Float, nullable=True)
    saldo_bolsillo = Column(Float, nullable=True)

    __table_args__ = ()

    movements = relationship('Movement', back_populates='month_rel', cascade='all, delete-orphan')


class Movement(Base):
    __tablename__ = 'movements'

    id = Column(Integer, primary_key=True, index=True)
    month_id = Column(Integer, ForeignKey('months.id', ondelete='CASCADE'), nullable=False, index=True)
    date = Column(String, nullable=False, index=True)
    description = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    type = Column(String, nullable=False)
    category_id = Column(Integer, ForeignKey('categories.id', ondelete='SET NULL'), nullable=True, index=True)
    note = Column(Text, nullable=True)
    applies_this_month = Column(Integer, nullable=True)  # NULL=unknown, 1=yes, 0=no
    # Credit card extended fields
    cuota_mes = Column(Float, default=0.0)
    valor_pendiente = Column(Float, default=0.0)
    num_cuotas_actual = Column(Integer, nullable=True)
    num_cuotas_total = Column(Integer, nullable=True)
    aplica_este_extracto = Column(Integer, default=1)   # 1=aplica, 0=no aplica
    es_pago_tarjeta = Column(Integer, default=0)        # 1=payment movement, 0=other
    es_diferido_anterior = Column(Integer, default=0)   # 1=deferred/carry-over, 0=other

    __table_args__ = (CheckConstraint("type IN ('Ingreso', 'Egreso')", name='ck_movement_type'),)

    month_rel = relationship('Month', back_populates='movements')
    category = relationship('Category', back_populates='movements')

    @property
    def statement_type(self) -> str:
        """Return the statement type of the parent Month (for API serialization)."""
        return self.month_rel.statement_type if self.month_rel else 'cuenta_ahorro'


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


DEFAULT_CATEGORIES = [
    # ── Salary / income ─────────────────────────────────────────────────────
    {'name': 'Salario',              'keywords': ['salario', 'sueldo', 'nomina', 'honorarios'],
     'color': '#22c55e', 'icon': '💼'},

    # ── Credit-card payments (Ingresos on tarjeta extracto) ──────────────────
    {'name': 'Pago/Abono Tarjeta',   'keywords': [
        'abono tarjeta', 'pago tarjeta', 'pago tc', 'abono pago',
        'mastercard intern', 'abono compra mastercard',
    ], 'color': '#14b8a6', 'icon': '💳'},

    # ── Telecomunicaciones ───────────────────────────────────────────────────
    {'name': 'Telecomunicaciones',   'keywords': [
        'comcel', 'claro', 'movistar', 'tigo', 'wom ', 'etb', 'une ',
        'telefonica', 'telecomunicaciones',
    ], 'color': '#8b5cf6', 'icon': '📱'},

    # ── Streaming ────────────────────────────────────────────────────────────
    {'name': 'Streaming',            'keywords': [
        'netflix', 'spotify', 'youtube premium', 'twitch', 'hbo', 'disney',
        'amazon prime', 'apple.com', 'apple com', 'apple tv', 'crunchyroll',
        'deezer', 'paramount', 'star+', 'directv go', 'claro video',
    ], 'color': '#ec4899', 'icon': '🎬'},

    # ── Video games ──────────────────────────────────────────────────────────
    {'name': 'Videojuegos',          'keywords': [
        'steam', 'riotgames', 'riot games', 'epicgames', 'epic games',
        'playstation', 'xbox', 'nintendo', 'blizzard', 'ubisoft',
        'roblox', 'battlenet', 'battle.net', 'activision', 'ea games',
    ], 'color': '#6366f1', 'icon': '🎮'},

    # ── Fuel ─────────────────────────────────────────────────────────────────
    {'name': 'Combustible',          'keywords': [
        'eds ', 'terpel', 'biomax', 'primax', 'zeuss', 'combustible',
        'combuscol', 'gasolinera', 'estacion de servicio',
    ], 'color': '#d97706', 'icon': '⛽'},

    # ── Groceries / supermarkets ─────────────────────────────────────────────
    {'name': 'Mercado/Alimentación', 'keywords': [
        'surtimax', 'tienda d1', 'd1 ', 'tienda ara', 'ara ',
        'exito', 'carulla', 'jumbo', 'metro grandes',
        'alkosto', 'colsubsidio', 'mercando', 'supermercado',
        'mercado donde', 'fruver', 'minimercado', 'raptiendas',
        'la 14', 'grandes superficies',
    ], 'color': '#16a34a', 'icon': '🛒'},

    # ── Health / pharmacy ────────────────────────────────────────────────────
    {'name': 'Salud/Farmacia',       'keywords': [
        'drogueria', 'farmacia', 'drogas', 'clinica',
        'hospital', 'laboratorio', 'medico',
        'odontologia', 'dental', 'audifarma', 'copidrogas', 'cafam salud',
        'colsanitas', 'sanitas', 'compensar salud',
    ], 'color': '#ef4444', 'icon': '💊'},

    # ── Pets ─────────────────────────────────────────────────────────────────
    {'name': 'Mascotas',             'keywords': [
        'puppis', 'puppies', 'petco', 'agrocampo', 'veterinaria',
        'vetlog', 'mascotas', 'petshop', 'pet shop', 'animalitos',
        'clinica veterinaria', 'animalia',
    ], 'color': '#fb923c', 'icon': '🐾'},

    # ── Gifts / flowers ──────────────────────────────────────────────────────
    {'name': 'Regalos',              'keywords': [
        'flores', 'floristeria', 'floresyflores',
        'regalolandia', 'regalo',
    ], 'color': '#e879f9', 'icon': '🎁'},

    # ── Insurance ────────────────────────────────────────────────────────────
    {'name': 'Seguros',              'keywords': [
        'seguro vida', 'vida deudor', 'cobro seguro', 'seguro obligatorio',
        'poliza', 'prima seguro', 'seguro deudor',
    ], 'color': '#0ea5e9', 'icon': '🛡️'},

    # ── Restaurants / food delivery ──────────────────────────────────────────
    {'name': 'Restaurantes',         'keywords': [
        'restaurante', 'restaurant', 'cafeteria', 'comida',
        'delivery', 'rappi', 'ifood', 'domino', 'mcdonalds', 'mc donalds',
        'subway', 'burger', 'pizza', 'kfc', 'frisby', 'el corral',
        'crepes', 'asadero', 'panaderia', 'heladeria',
        'sushi', 'tacos', 'wok', 'hacienda', 'andres dc',
    ], 'color': '#f97316', 'icon': '🍽️'},

    # ── Transport ────────────────────────────────────────────────────────────
    {'name': 'Transporte',           'keywords': [
        'uber', 'taxi', 'metro ', 'peaje', 'indrive', 'indrives',
        'cabify', 'beat ', 'sitp', 'transmilenio', 'parqueadero',
        'parking', 'gasolina', 'mototaxi',
    ], 'color': '#06b6d4', 'icon': '🚗'},

    # ── General shopping ─────────────────────────────────────────────────────
    {'name': 'Compras',              'keywords': [
        'amazon', 'mercadolibre', 'linio', 'adidas', 'nike', 'zara',
        'h&m', 'falabella tienda', 'ripley', 'homecenter', 'easy ',
        'ikea', 'retail', 'almacen', 'comercio',
    ], 'color': '#f59e0b', 'icon': '🛍️'},

    # ── Utilities (domiciliary services) ─────────────────────────────────────
    {'name': 'Servicios',            'keywords': [
        'epm', 'codensa', 'acueducto', 'energia electrica',
        'gas domiciliario', 'internet hogar', 'tv por cable',
        'directv', 'canal une', 'aire acondicionado', 'recibo de luz',
    ], 'color': '#7c3aed', 'icon': '⚡'},

    # ── Bank fees ────────────────────────────────────────────────────────────
    {'name': 'Comisiones',           'keywords': [
        'comision', 'comisiones', 'mantenimiento cuenta',
        'cuota manejo', '4x1000', 'gravamen', 'retencion',
    ], 'color': '#dc2626', 'icon': '🏦'},

    # ── Transfers ────────────────────────────────────────────────────────────
    {'name': 'Transferencia',        'keywords': [
        'transferencia', 'envio', 'giro', 'nequi', 'daviplata',
        'bold', 'wompi', 'transfiya',
    ], 'color': '#3b82f6', 'icon': '↔️'},

    # ── Fallback ─────────────────────────────────────────────────────────────
    {'name': 'Otros',                'keywords': [],
     'color': '#94a3b8', 'icon': '📦'},
]


def init_db():
    import json as _json
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # ── Schema migrations ────────────────────────────────────────────────
        # Add statement_type column to months if it doesn't exist yet
        try:
            db.execute(text(
                "ALTER TABLE months ADD COLUMN statement_type VARCHAR DEFAULT 'cuenta_ahorro'"
            ))
            db.commit()
        except Exception as e:
            db.rollback()
            if 'duplicate column name' not in str(e).lower() and 'already exists' not in str(e).lower():
                raise

        # Add min_payment / total_payment columns to months if they don't exist yet
        for col_ddl in (
            "ALTER TABLE months ADD COLUMN min_payment FLOAT",
            "ALTER TABLE months ADD COLUMN total_payment FLOAT",
        ):
            try:
                db.execute(text(col_ddl))
                db.commit()
            except Exception as e:
                db.rollback()
                if 'duplicate column name' not in str(e).lower() and 'already exists' not in str(e).lower():
                    raise

        # Add applies_this_month column to movements if it doesn't exist yet
        try:
            db.execute(text("ALTER TABLE movements ADD COLUMN applies_this_month INTEGER"))
            db.commit()
        except Exception as e:
            db.rollback()
            if 'duplicate column name' not in str(e).lower() and 'already exists' not in str(e).lower():
                raise

        # Add credit-card extended columns to movements
        for col_ddl in (
            "ALTER TABLE movements ADD COLUMN cuota_mes FLOAT DEFAULT 0.0",
            "ALTER TABLE movements ADD COLUMN valor_pendiente FLOAT DEFAULT 0.0",
            "ALTER TABLE movements ADD COLUMN num_cuotas_actual INTEGER",
            "ALTER TABLE movements ADD COLUMN num_cuotas_total INTEGER",
            "ALTER TABLE movements ADD COLUMN aplica_este_extracto INTEGER DEFAULT 1",
            "ALTER TABLE movements ADD COLUMN es_pago_tarjeta INTEGER DEFAULT 0",
            "ALTER TABLE movements ADD COLUMN es_diferido_anterior INTEGER DEFAULT 0",
        ):
            try:
                db.execute(text(col_ddl))
                db.commit()
            except Exception as e:
                db.rollback()
                if 'duplicate column name' not in str(e).lower() and 'already exists' not in str(e).lower():
                    raise

        # Add credit-card extended columns to months
        for col_ddl in (
            "ALTER TABLE months ADD COLUMN fecha_corte VARCHAR",
            "ALTER TABLE months ADD COLUMN fecha_limite_pago VARCHAR",
            "ALTER TABLE months ADD COLUMN cupo_total FLOAT DEFAULT 0.0",
            "ALTER TABLE months ADD COLUMN cupo_disponible FLOAT DEFAULT 0.0",
            "ALTER TABLE months ADD COLUMN consumos_periodo FLOAT DEFAULT 0.0",
        ):
            try:
                db.execute(text(col_ddl))
                db.commit()
            except Exception as e:
                db.rollback()
                if 'duplicate column name' not in str(e).lower() and 'already exists' not in str(e).lower():
                    raise

        # Add Davivienda balance columns to months
        for col_ddl in (
            "ALTER TABLE months ADD COLUMN saldo_anterior FLOAT",
            "ALTER TABLE months ADD COLUMN nuevo_saldo FLOAT",
            "ALTER TABLE months ADD COLUMN saldo_bolsillo FLOAT",
        ):
            try:
                db.execute(text(col_ddl))
                db.commit()
            except Exception as e:
                db.rollback()
                if 'duplicate column name' not in str(e).lower() and 'already exists' not in str(e).lower():
                    raise

        # Add performance indexes on movements (CREATE INDEX IF NOT EXISTS is idempotent — no exception handling needed)
        for idx_ddl in (
            "CREATE INDEX IF NOT EXISTS ix_movements_month_id ON movements (month_id)",
            "CREATE INDEX IF NOT EXISTS ix_movements_category_id ON movements (category_id)",
            "CREATE INDEX IF NOT EXISTS ix_movements_date ON movements (date)",
        ):
            db.execute(text(idx_ddl))
        db.commit()

        # Migration: drop unique constraint (year, month) so that multiple statements
        # for the same month (e.g. savings account + credit card) can coexist.
        # SQLite does not support DROP CONSTRAINT – we recreate the table without it.
        try:
            row = db.execute(
                text("SELECT sql FROM sqlite_master WHERE type='table' AND name='months'")
            ).fetchone()
            if row and row[0] and 'uq_year_month' in row[0]:
                db.execute(text("""
                    CREATE TABLE months_migration (
                        id                INTEGER NOT NULL PRIMARY KEY,
                        year              INTEGER NOT NULL,
                        month             INTEGER NOT NULL,
                        bank_name         VARCHAR,
                        file_name         VARCHAR NOT NULL,
                        statement_type    VARCHAR DEFAULT 'cuenta_ahorro',
                        uploaded_at       DATETIME,
                        min_payment       FLOAT,
                        total_payment     FLOAT,
                        fecha_corte       VARCHAR,
                        fecha_limite_pago VARCHAR,
                        cupo_total        FLOAT DEFAULT 0.0,
                        cupo_disponible   FLOAT DEFAULT 0.0,
                        consumos_periodo  FLOAT DEFAULT 0.0,
                        saldo_anterior    FLOAT,
                        nuevo_saldo       FLOAT,
                        saldo_bolsillo    FLOAT
                    )
                """))
                db.execute(text("""
                    INSERT INTO months_migration (
                        id, year, month, bank_name, file_name, statement_type, uploaded_at,
                        min_payment, total_payment,
                        fecha_corte, fecha_limite_pago, cupo_total, cupo_disponible, consumos_periodo,
                        saldo_anterior, nuevo_saldo, saldo_bolsillo
                    )
                    SELECT
                        id, year, month, bank_name, file_name, statement_type, uploaded_at,
                        min_payment, total_payment,
                        fecha_corte, fecha_limite_pago, cupo_total, cupo_disponible, consumos_periodo,
                        saldo_anterior, nuevo_saldo, saldo_bolsillo
                    FROM months
                """))
                db.execute(text("DROP TABLE months"))
                db.execute(text("ALTER TABLE months_migration RENAME TO months"))
                db.execute(text("CREATE INDEX IF NOT EXISTS ix_months_id ON months (id)"))
                db.commit()
        except Exception as e:
            db.rollback()
            if 'already exists' not in str(e).lower():
                raise

        # ── Seed / update categories ─────────────────────────────────────────
        # Always upsert so that keyword updates are applied to existing DBs
        for cat_data in DEFAULT_CATEGORIES:
            keywords_json = _json.dumps(cat_data['keywords'], ensure_ascii=False)
            exists = db.query(Category).filter(Category.name == cat_data['name']).first()
            if exists:
                exists.keywords = keywords_json
                exists.color = cat_data['color']
                exists.icon = cat_data['icon']
            else:
                cat = Category(
                    name=cat_data['name'],
                    keywords=keywords_json,
                    color=cat_data['color'],
                    icon=cat_data['icon'],
                )
                db.add(cat)
        db.commit()
    finally:
        db.close()
