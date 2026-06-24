from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base

class Machine(Base):
    __tablename__ = "machines"

    id = Column(Integer, primary_key=True, index=True)
    pump_id = Column(Integer, ForeignKey("fuel_pumps.id"), nullable=False)
    name = Column(String(100), nullable=False)
    number_of_nozzles = Column(Integer, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    pump = relationship("FuelPump", back_populates="machines")
    nozzles = relationship("Nozzle", back_populates="machine", cascade="all, delete-orphan")


class Nozzle(Base):
    __tablename__ = "nozzles"

    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(Integer, ForeignKey("machines.id"), nullable=False)
    tank_id = Column(Integer, ForeignKey("tanks.id"), nullable=False)
    name = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    machine = relationship("Machine", back_populates="nozzles")
    tank = relationship("Tank", back_populates="nozzles")
    daily_logs = relationship("DailyNozzleLog", back_populates="nozzle")
