from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models.machine import Machine, Nozzle
from app.models.fuel_pump import FuelPump
from app.models.tank import Tank
from app.schemas.machine import (
    MachineCreate,
    MachineUpdate,
    MachineResponse,
    NozzleCreate,
    NozzleUpdate,
    NozzleResponse,
)

router = APIRouter(tags=["Machines & Nozzles"])

# --- Machine Routes ---

@router.get("/machines", response_model=List[MachineResponse])
def list_machines(pump_id: Optional[int] = None, db: Session = Depends(get_db)):
    """List all machines, filterable by pump_id."""
    query = db.query(Machine).filter(Machine.is_active == True)
    if pump_id is not None:
        query = query.filter(Machine.pump_id == pump_id)
    return query.all()

@router.post("/machines", response_model=MachineResponse, status_code=status.HTTP_201_CREATED)
def create_machine(machine: MachineCreate, db: Session = Depends(get_db)):
    """Create a new machine dispenser unit."""
    pump = db.query(FuelPump).filter(FuelPump.id == machine.pump_id, FuelPump.is_active == True).first()
    if not pump:
        raise HTTPException(status_code=400, detail="Specified Fuel Pump not found or inactive")

    db_machine = Machine(
        pump_id=machine.pump_id,
        name=machine.name,
        number_of_nozzles=machine.number_of_nozzles,
        is_active=machine.is_active
    )
    db.add(db_machine)
    db.commit()
    db.refresh(db_machine)
    return db_machine

@router.get("/machines/{machine_id}", response_model=MachineResponse)
def get_machine(machine_id: int, db: Session = Depends(get_db)):
    """Get details of a specific machine."""
    machine = db.query(Machine).filter(Machine.id == machine_id, Machine.is_active == True).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    return machine

@router.put("/machines/{machine_id}", response_model=MachineResponse)
def update_machine(machine_id: int, machine_update: MachineUpdate, db: Session = Depends(get_db)):
    """Update details of an existing machine."""
    machine = db.query(Machine).filter(Machine.id == machine_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    update_data = machine_update.model_dump(exclude_unset=True)
    if "pump_id" in update_data:
        pump = db.query(FuelPump).filter(FuelPump.id == update_data["pump_id"], FuelPump.is_active == True).first()
        if not pump:
            raise HTTPException(status_code=400, detail="Specified Fuel Pump not found or inactive")

    for key, value in update_data.items():
        setattr(machine, key, value)

    db.commit()
    db.refresh(machine)
    return machine

@router.delete("/machines/{machine_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_machine(machine_id: int, db: Session = Depends(get_db)):
    """Soft delete a machine and all connected nozzles (sets is_active = False)."""
    machine = db.query(Machine).filter(Machine.id == machine_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    machine.is_active = False
    for nozzle in machine.nozzles:
        nozzle.is_active = False

    db.commit()
    return

# --- Nozzle Routes ---

@router.get("/nozzles", response_model=List[NozzleResponse])
def list_nozzles(
    machine_id: Optional[int] = None,
    tank_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """List all nozzles, filterable by machine_id or tank_id."""
    query = db.query(Nozzle).filter(Nozzle.is_active == True)
    if machine_id is not None:
        query = query.filter(Nozzle.machine_id == machine_id)
    if tank_id is not None:
        query = query.filter(Nozzle.tank_id == tank_id)
    return query.all()

@router.post("/nozzles", response_model=NozzleResponse, status_code=status.HTTP_201_CREATED)
def create_nozzle(nozzle: NozzleCreate, db: Session = Depends(get_db)):
    """Create a new nozzle connected to a machine and tank."""
    machine = db.query(Machine).filter(Machine.id == nozzle.machine_id, Machine.is_active == True).first()
    if not machine:
        raise HTTPException(status_code=400, detail="Specified Machine not found or inactive")

    tank = db.query(Tank).filter(Tank.id == nozzle.tank_id).first()
    if not tank:
        raise HTTPException(status_code=400, detail="Specified Tank not found")

    db_nozzle = Nozzle(
        machine_id=nozzle.machine_id,
        tank_id=nozzle.tank_id,
        name=nozzle.name,
        is_active=nozzle.is_active
    )
    db.add(db_nozzle)
    db.commit()
    db.refresh(db_nozzle)
    return db_nozzle

@router.get("/nozzles/{nozzle_id}", response_model=NozzleResponse)
def get_nozzle(nozzle_id: int, db: Session = Depends(get_db)):
    """Get details of a specific nozzle."""
    nozzle = db.query(Nozzle).filter(Nozzle.id == nozzle_id, Nozzle.is_active == True).first()
    if not nozzle:
        raise HTTPException(status_code=404, detail="Nozzle not found")
    return nozzle

@router.put("/nozzles/{nozzle_id}", response_model=NozzleResponse)
def update_nozzle(nozzle_id: int, nozzle_update: NozzleUpdate, db: Session = Depends(get_db)):
    """Update details of an existing nozzle."""
    nozzle = db.query(Nozzle).filter(Nozzle.id == nozzle_id).first()
    if not nozzle:
        raise HTTPException(status_code=404, detail="Nozzle not found")

    update_data = nozzle_update.model_dump(exclude_unset=True)
    if "machine_id" in update_data:
        machine = db.query(Machine).filter(Machine.id == update_data["machine_id"], Machine.is_active == True).first()
        if not machine:
            raise HTTPException(status_code=400, detail="Specified Machine not found or inactive")

    if "tank_id" in update_data:
        tank = db.query(Tank).filter(Tank.id == update_data["tank_id"]).first()
        if not tank:
            raise HTTPException(status_code=400, detail="Specified Tank not found")

    for key, value in update_data.items():
        setattr(nozzle, key, value)

    db.commit()
    db.refresh(nozzle)
    return nozzle

@router.delete("/nozzles/{nozzle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_nozzle(nozzle_id: int, db: Session = Depends(get_db)):
    """Soft delete a nozzle by setting is_active = False."""
    nozzle = db.query(Nozzle).filter(Nozzle.id == nozzle_id).first()
    if not nozzle:
        raise HTTPException(status_code=404, detail="Nozzle not found")

    nozzle.is_active = False
    db.commit()
    return
