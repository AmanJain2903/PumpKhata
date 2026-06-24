from sqlalchemy import Column, Integer, String, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base

class Tank(Base):
    __tablename__ = "tanks"

    id = Column(Integer, primary_key=True, index=True)
    pump_id = Column(Integer, ForeignKey("fuel_pumps.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    name = Column(String(100), nullable=False)
    max_capacity = Column(Numeric(12, 2), nullable=False)

    # Relationships
    pump = relationship("FuelPump", back_populates="tanks")
    product = relationship("Product", back_populates="tanks")
    nozzles = relationship("Nozzle", back_populates="tank")
    daily_logs = relationship("DailyTankLog", back_populates="tank")
