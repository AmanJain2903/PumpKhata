from sqlalchemy import Column, Integer, BigInteger, Numeric, Boolean, Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.models.base import Base

class DailyNozzleLog(Base):
    __tablename__ = "daily_nozzle_logs"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    nozzle_id = Column(Integer, ForeignKey("nozzles.id"), nullable=False)
    log_date = Column(Date, nullable=False)
    log_timestamp = Column(DateTime(timezone=True), nullable=False)
    opening_reading = Column(Numeric(12, 2), nullable=False)
    closing_reading = Column(Numeric(12, 2), nullable=False)
    is_reset = Column(Boolean, default=False, nullable=False)
    gross_liters_sold = Column(Numeric(12, 2), nullable=False)

    __table_args__ = (
        UniqueConstraint("nozzle_id", "log_timestamp", name="uq_nozzle_daily_log"),
    )

    # Relationships
    nozzle = relationship("Nozzle", back_populates="daily_logs")


class DailyTankLog(Base):
    __tablename__ = "daily_tank_logs"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    tank_id = Column(Integer, ForeignKey("tanks.id"), nullable=False)
    log_date = Column(Date, nullable=False)
    log_timestamp = Column(DateTime(timezone=True), nullable=False)
    testing_liters = Column(Numeric(8, 2), nullable=False)
    fuel_received = Column(Numeric(12, 2), nullable=False)
    actual_dip_volume = Column(Numeric(12, 2), nullable=False)
    calculated_variance = Column(Numeric(12, 2), nullable=False)

    __table_args__ = (
        UniqueConstraint("tank_id", "log_timestamp", name="uq_tank_daily_log"),
    )

    # Relationships
    tank = relationship("Tank", back_populates="daily_logs")


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
