import enum
from sqlalchemy import Column, Integer, BigInteger, Numeric, Boolean, Date, DateTime, ForeignKey, UniqueConstraint, Enum as SQLEnum, Text, String
from sqlalchemy.orm import relationship
from app.models.base import Base

class DailyLogSessionStatus(str, enum.Enum):
    OPEN = "OPEN"
    CLOSED = "CLOSED"

class DailyLogSession(Base):
    __tablename__ = "daily_log_sessions"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    pump_id = Column(Integer, ForeignKey("fuel_pumps.id"), nullable=False)
    log_date = Column(Date, nullable=False)
    status = Column(SQLEnum(DailyLogSessionStatus, native_enum=False), default=DailyLogSessionStatus.OPEN, nullable=False)
    opened_at = Column(DateTime(timezone=True), nullable=False)

    closed_at = Column(DateTime(timezone=True), nullable=True)

    # Financial Summary (written on Close)
    opening_cash_balance = Column(Numeric(12, 2), nullable=False)
    fuel_cash_collected = Column(Numeric(12, 2), nullable=True)
    fuel_digital_collected = Column(Numeric(12, 2), nullable=True)
    credit_sales_total = Column(Numeric(12, 2), nullable=True)
    expected_revenue = Column(Numeric(12, 2), nullable=True)
    shortage_overage = Column(Numeric(12, 2), nullable=True)
    credit_payments_cash_total = Column(Numeric(12, 2), nullable=True)
    credit_payments_digital_total = Column(Numeric(12, 2), nullable=True)
    misc_cash = Column(Numeric(12, 2), default=0.0, nullable=False)
    misc_digital = Column(Numeric(12, 2), default=0.0, nullable=False)
    misc_notes = Column(Text, nullable=True)
    closing_cash_balance = Column(Numeric(12, 2), nullable=True)
    price_change_gain_loss_total = Column(Numeric(12, 2), nullable=True)
    prior_period_adjustment = Column(Numeric(12, 2), default=0.0, nullable=False)
    adjustment_notes = Column(Text, nullable=True)
    is_initialization = Column(Boolean, default=False, nullable=False)

    __table_args__ = (
        UniqueConstraint("pump_id", "log_date", name="uq_pump_date_session"),
    )

    # Relationships
    pump = relationship("FuelPump", back_populates="daily_log_sessions")
    nozzle_logs = relationship("DailyNozzleLog", back_populates="session", cascade="all, delete-orphan")
    tank_logs = relationship("DailyTankLog", back_populates="session", cascade="all, delete-orphan")
    credit_transactions = relationship("CreditTransaction", back_populates="session")
    collections = relationship("DailyLogSessionPayment", back_populates="session", cascade="all, delete-orphan")
    account_transactions = relationship("PumpAccountTransaction", back_populates="session", cascade="all, delete-orphan")
    price_change_records = relationship("PriceChangeGainLoss", back_populates="session", cascade="all, delete-orphan")


class DailyNozzleLog(Base):
    __tablename__ = "daily_nozzle_logs"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    session_id = Column(BigInteger, ForeignKey("daily_log_sessions.id"), nullable=False)
    nozzle_id = Column(Integer, ForeignKey("nozzles.id"), nullable=False)
    entry_index = Column(Integer, default=0, nullable=False)
    product_price = Column(Numeric(10, 2), nullable=False)
    log_date = Column(Date, nullable=False)
    log_timestamp = Column(DateTime(timezone=True), nullable=False)
    opening_reading = Column(Numeric(12, 2), nullable=False)
    closing_reading = Column(Numeric(12, 2), nullable=False)
    is_reset = Column(Boolean, default=False, nullable=False)
    gross_liters_sold = Column(Numeric(12, 2), nullable=False)

    __table_args__ = (
        UniqueConstraint("nozzle_id", "session_id", "entry_index", name="uq_nozzle_session_entry"),
    )

    # Relationships
    nozzle = relationship("Nozzle", back_populates="daily_logs")
    session = relationship("DailyLogSession", back_populates="nozzle_logs")


class DailyTankLog(Base):
    __tablename__ = "daily_tank_logs"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    session_id = Column(BigInteger, ForeignKey("daily_log_sessions.id"), nullable=False)
    tank_id = Column(Integer, ForeignKey("tanks.id"), nullable=False)
    log_date = Column(Date, nullable=False)
    log_timestamp = Column(DateTime(timezone=True), nullable=False)
    testing_liters = Column(Numeric(8, 2), nullable=False)
    fuel_received = Column(Numeric(12, 2), nullable=False)
    actual_dip_volume = Column(Numeric(12, 2), nullable=False)
    calculated_variance = Column(Numeric(12, 2), nullable=False)

    __table_args__ = (
        UniqueConstraint("tank_id", "session_id", name="uq_tank_session"),
    )

    # Relationships
    tank = relationship("Tank", back_populates="daily_logs")
    session = relationship("DailyLogSession", back_populates="tank_logs")


class DailyFinancialLog(Base):
    __tablename__ = "daily_financial_logs"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    pump_id = Column(Integer, ForeignKey("fuel_pumps.id"), nullable=False)
    log_date = Column(Date, nullable=False)
    log_timestamp = Column(DateTime(timezone=True), nullable=False)
    opening_cash_balance = Column(Numeric(12, 2), nullable=False)
    expected_revenue = Column(Numeric(12, 2), nullable=False)
    cash_collected = Column(Numeric(12, 2), nullable=False)
    digital_collected = Column(Numeric(12, 2), nullable=False)
    credit_sales_logged = Column(Numeric(12, 2), nullable=False)
    closing_cash_balance = Column(Numeric(12, 2), nullable=False)
    shortage_overage = Column(Numeric(12, 2), nullable=False)

    __table_args__ = (
        UniqueConstraint("pump_id", "log_timestamp", name="uq_pump_daily_financial_log"),
    )

    # Relationships
    pump = relationship("FuelPump", back_populates="daily_financial_logs")


class DailyLogSessionPayment(Base):
    __tablename__ = "daily_session_payments"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    session_id = Column(BigInteger, ForeignKey("daily_log_sessions.id"), nullable=False)
    payment_method = Column(String(50), nullable=False)
    amount = Column(Numeric(12, 2), default=0.0, nullable=False)
    log_date = Column(Date, nullable=False)

    __table_args__ = (
        UniqueConstraint("session_id", "payment_method", name="uq_session_payment_method"),
    )

    # Relationships
    session = relationship("DailyLogSession", back_populates="collections")

