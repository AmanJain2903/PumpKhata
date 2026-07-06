import enum
from sqlalchemy import Column, Integer, BigInteger, String, Numeric, Date, DateTime, ForeignKey, Enum as SQLEnum, Boolean, UniqueConstraint, func
from sqlalchemy.orm import relationship
from app.models.base import Base

class CreditTransactionType(str, enum.Enum):
    CHARGE = "CHARGE"
    PAYMENT = "PAYMENT"

class PaymentMethodType(str, enum.Enum):
    CASH = "CASH"
    ACCOUNT_TRANSFER = "ACCOUNT_TRANSFER"

class PumpAccount(Base):
    __tablename__ = "pump_accounts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    pump_id = Column(Integer, ForeignKey("fuel_pumps.id"), nullable=False)
    name = Column(String(255), nullable=False)
    balance = Column(Numeric(12, 2), default=0.0, nullable=False)
    is_constant = Column(Boolean, default=False, nullable=False)
    is_paytm_linked = Column(Boolean, default=False, nullable=False)

    __table_args__ = (
        UniqueConstraint("pump_id", "name", name="uq_pump_account_name"),
    )

    # Relationships
    pump = relationship("FuelPump", back_populates="pump_accounts")
    credit_transactions = relationship("CreditTransaction", back_populates="pump_account")
    account_transactions = relationship("PumpAccountTransaction", back_populates="account", cascade="all, delete-orphan")


class CreditAccount(Base):
    __tablename__ = "credit_accounts"

    id = Column(Integer, primary_key=True, index=True)
    pump_id = Column(Integer, ForeignKey("fuel_pumps.id"), nullable=False)
    account_name = Column(String(255), unique=True, nullable=False)
    current_outstanding_balance = Column(Numeric(12, 2), nullable=False)

    # Relationships
    pump = relationship("FuelPump", back_populates="credit_accounts")
    transactions = relationship("CreditTransaction", back_populates="account", cascade="all, delete-orphan")


class CreditTransaction(Base):
    __tablename__ = "credit_transactions"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey("credit_accounts.id"), nullable=False)
    session_id = Column(BigInteger, ForeignKey("daily_log_sessions.id"), nullable=True)
    pump_account_id = Column(Integer, ForeignKey("pump_accounts.id"), nullable=True)
    log_date = Column(Date, nullable=False)
    log_timestamp = Column(DateTime(timezone=True), nullable=False)
    type = Column(SQLEnum(CreditTransactionType, name="credit_transaction_type"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    notes = Column(String, nullable=True)
    payment_method = Column(String(50), nullable=True)

    # Relationships
    account = relationship("CreditAccount", back_populates="transactions")
    session = relationship("DailyLogSession", back_populates="credit_transactions")
    pump_account = relationship("PumpAccount", back_populates="credit_transactions")


class PumpAccountTransaction(Base):
    """Ledger table tracking all inflows/outflows for pump accounts."""
    __tablename__ = "pump_account_transactions"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey("pump_accounts.id"), nullable=False)
    session_id = Column(BigInteger, ForeignKey("daily_log_sessions.id"), nullable=True)
    amount = Column(Numeric(12, 2), nullable=False)
    log_date = Column(Date, nullable=False)
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    account = relationship("PumpAccount", back_populates="account_transactions")
    session = relationship("DailyLogSession", back_populates="account_transactions")

