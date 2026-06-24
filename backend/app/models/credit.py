import enum
from sqlalchemy import Column, Integer, BigInteger, String, Numeric, Date, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.models.base import Base

class CreditTransactionType(str, enum.Enum):
    CHARGE = "CHARGE"
    PAYMENT = "PAYMENT"

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
    log_date = Column(Date, nullable=False)
    log_timestamp = Column(DateTime(timezone=True), nullable=False)
    type = Column(SQLEnum(CreditTransactionType, name="credit_transaction_type"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    notes = Column(String, nullable=True)

    # Relationships
    account = relationship("CreditAccount", back_populates="transactions")
