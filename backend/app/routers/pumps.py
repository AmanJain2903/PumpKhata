from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.fuel_pump import FuelPump
from app.schemas.fuel_pump import FuelPumpCreate, FuelPumpUpdate, FuelPumpResponse
from app.schemas.machine import MachineResponse
from app.schemas.tank import TankResponse
from app.schemas.product import ProductResponse
from app.schemas.credit import CreditAccountResponse

router = APIRouter(prefix="/pumps", tags=["Fuel Pumps"])

@router.get("", response_model=List[FuelPumpResponse])
def list_pumps(db: Session = Depends(get_db)):
    """List all active fuel pumps."""
    return db.query(FuelPump).filter(FuelPump.is_active == True).all()

@router.post("", response_model=FuelPumpResponse, status_code=status.HTTP_201_CREATED)
def create_pump(pump: FuelPumpCreate, db: Session = Depends(get_db)):
    """Create a new fuel pump."""
    db_pump = FuelPump(
        name=pump.name,
        location=pump.location,
        is_active=pump.is_active
    )
    db.add(db_pump)
    db.commit()
    db.refresh(db_pump)
    return db_pump

@router.get("/{pump_id}", response_model=FuelPumpResponse)
def get_pump(pump_id: int, db: Session = Depends(get_db)):
    """Get detailed information about a specific fuel pump."""
    pump = db.query(FuelPump).filter(FuelPump.id == pump_id, FuelPump.is_active == True).first()
    if not pump:
        raise HTTPException(status_code=404, detail="Fuel Pump not found")
    return pump

@router.put("/{pump_id}", response_model=FuelPumpResponse)
def update_pump(pump_id: int, pump_update: FuelPumpUpdate, db: Session = Depends(get_db)):
    """Update properties of an existing fuel pump."""
    pump = db.query(FuelPump).filter(FuelPump.id == pump_id).first()
    if not pump:
        raise HTTPException(status_code=404, detail="Fuel Pump not found")
    
    update_data = pump_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(pump, key, value)
    
    db.commit()
    db.refresh(pump)
    return pump

@router.delete("/{pump_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pump(pump_id: int, db: Session = Depends(get_db)):
    """Soft delete a fuel pump by setting is_active = False."""
    pump = db.query(FuelPump).filter(FuelPump.id == pump_id).first()
    if not pump:
        raise HTTPException(status_code=404, detail="Fuel Pump not found")
    
    pump.is_active = False
    db.commit()
    return

@router.get("/{pump_id}/config")
def get_pump_config(pump_id: int, db: Session = Depends(get_db)):
    """Fetch the nested configuration for a pump, including all tanks, machines, and nozzles."""
    pump = db.query(FuelPump).filter(FuelPump.id == pump_id, FuelPump.is_active == True).first()
    if not pump:
        raise HTTPException(status_code=404, detail="Fuel Pump not found")
    
    tanks = [TankResponse.model_validate(t) for t in pump.tanks]
    machines = []
    for m in pump.machines:
        if m.is_active:
            m_data = MachineResponse.model_validate(m)
            machines.append(m_data)
            
    products = [ProductResponse.model_validate(p) for p in pump.products]
    credit_accounts = [CreditAccountResponse.model_validate(c) for c in pump.credit_accounts]

    return {
        "pump": FuelPumpResponse.model_validate(pump),
        "tanks": tanks,
        "machines": machines,
        "products": products,
        "credit_accounts": credit_accounts
    }
