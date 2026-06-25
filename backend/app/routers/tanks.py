from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models.tank import Tank
from app.models.fuel_pump import FuelPump
from app.models.product import Product
from app.schemas.tank import TankCreate, TankUpdate, TankResponse

router = APIRouter(prefix="/tanks", tags=["Tanks"])

@router.get("", response_model=List[TankResponse])
def list_tanks(pump_id: Optional[int] = None, db: Session = Depends(get_db)):
    """List all tanks, optionally filtered by pump_id."""
    query = db.query(Tank)
    if pump_id is not None:
        query = query.filter(Tank.pump_id == pump_id)
    return query.all()

@router.post("", response_model=TankResponse, status_code=status.HTTP_201_CREATED)
def create_tank(tank: TankCreate, db: Session = Depends(get_db)):
    """Create a new underground tank."""
    # Validate pump and product exist
    pump = db.query(FuelPump).filter(FuelPump.id == tank.pump_id, FuelPump.is_active == True).first()
    if not pump:
        raise HTTPException(status_code=400, detail="Specified Fuel Pump not found or inactive")
        
    product = db.query(Product).filter(Product.id == tank.product_id).first()
    if not product:
        raise HTTPException(status_code=400, detail="Specified Product not found")

    db_tank = Tank(
        pump_id=tank.pump_id,
        product_id=tank.product_id,
        name=tank.name,
        max_capacity=tank.max_capacity
    )
    db.add(db_tank)
    db.commit()
    db.refresh(db_tank)
    return db_tank

@router.get("/{tank_id}", response_model=TankResponse)
def get_tank(tank_id: int, db: Session = Depends(get_db)):
    """Get details of a specific tank."""
    db_tank = db.query(Tank).filter(Tank.id == tank_id).first()
    if not db_tank:
        raise HTTPException(status_code=404, detail="Tank not found")
    return db_tank

@router.put("/{tank_id}", response_model=TankResponse)
def update_tank(tank_id: int, tank_update: TankUpdate, db: Session = Depends(get_db)):
    """Update details of an existing tank."""
    db_tank = db.query(Tank).filter(Tank.id == tank_id).first()
    if not db_tank:
        raise HTTPException(status_code=404, detail="Tank not found")

    update_data = tank_update.model_dump(exclude_unset=True)
    if "pump_id" in update_data:
        pump = db.query(FuelPump).filter(FuelPump.id == update_data["pump_id"], FuelPump.is_active == True).first()
        if not pump:
            raise HTTPException(status_code=400, detail="Specified Fuel Pump not found or inactive")
            
    if "product_id" in update_data:
        product = db.query(Product).filter(Product.id == update_data["product_id"]).first()
        if not product:
            raise HTTPException(status_code=400, detail="Specified Product not found")

    for key, value in update_data.items():
        setattr(db_tank, key, value)

    db.commit()
    db.refresh(db_tank)
    return db_tank

@router.delete("/{tank_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tank(tank_id: int, db: Session = Depends(get_db)):
    """Delete a tank (note: in production, check if logs are tied to it first)."""
    db_tank = db.query(Tank).filter(Tank.id == tank_id).first()
    if not db_tank:
        raise HTTPException(status_code=404, detail="Tank not found")
        
    db.delete(db_tank)
    db.commit()
    return
