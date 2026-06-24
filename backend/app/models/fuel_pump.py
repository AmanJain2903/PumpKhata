from sqlalchemy import Column, Integer, String, Text, Boolean
from sqlalchemy.orm import relationship
from app.models.base import Base

class FuelPump(Base):
    __tablename__ = "fuel_pumps"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    location = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    products = relationship("Product", secondary="product_pumps", back_populates="pumps")
    tanks = relationship("Tank", back_populates="pump")
    machines = relationship("Machine", back_populates="pump")
    credit_accounts = relationship("CreditAccount", back_populates="pump")
    daily_financial_logs = relationship("DailyFinancialLog", back_populates="pump")
