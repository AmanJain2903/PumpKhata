from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.fuel_pump import FuelPump
from app.schemas.fuel_pump import FuelPumpCreate, FuelPumpUpdate, FuelPumpResponse, PumpConfigUpdateRequest
from app.schemas.machine import MachineResponse
from app.schemas.tank import TankResponse
from app.schemas.product import ProductResponse
from app.schemas.credit import CreditAccountResponse

router = APIRouter(prefix="/pumps", tags=["Fuel Pumps"])

@router.get("", response_model=List[FuelPumpResponse])
def list_pumps(db: Session = Depends(get_db)):
    """List all fuel pumps."""
    return db.query(FuelPump).all()

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
    pump = db.query(FuelPump).filter(FuelPump.id == pump_id).first()
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

    # Cascade the active status to all machines and nozzles belonging to this pump
    if "is_active" in update_data:
        is_active_val = update_data["is_active"]
        for m in pump.machines:
            m.is_active = is_active_val
            for n in m.nozzles:
                n.is_active = is_active_val
    
    db.commit()
    db.refresh(pump)
    return pump

@router.delete("/{pump_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pump(pump_id: int, db: Session = Depends(get_db)):
    """Hard delete a fuel pump, cascade-deleting all related forecourt configurations, logs, B2B credit accounts, and transactions."""
    pump = db.query(FuelPump).filter(FuelPump.id == pump_id).first()
    if not pump:
        raise HTTPException(status_code=404, detail="Fuel Pump not found")

    from app.models.log import DailyFinancialLog, DailyTankLog, DailyNozzleLog
    from app.models.credit import CreditAccount, CreditTransaction
    from app.models.machine import Machine, Nozzle
    from app.models.tank import Tank
    from app.models.product import product_pumps

    # Check if any associated B2B credit accounts have a non-zero balance
    for acc in pump.credit_accounts:
        if acc.current_outstanding_balance != 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete station: Credit account '{acc.account_name}' has an uncleared balance (₹{float(acc.current_outstanding_balance):.2f}). Please settle all credit ledgers to zero first."
            )

    # 1. Delete Daily Financial Logs
    for log in list(pump.daily_financial_logs):
      db.delete(log)

    # 2. Delete Credit Accounts & Transactions
    for acc in list(pump.credit_accounts):
      for tx in list(acc.transactions):
        db.delete(tx)
      db.delete(acc)

    # 3. Delete Machines, Nozzles & Nozzle Logs
    for m in list(pump.machines):
      for n in list(m.nozzles):
        for log in list(n.daily_logs):
          db.delete(log)
        db.delete(n)
      db.delete(m)

    # 4. Delete Tanks & Tank Logs
    for t in list(pump.tanks):
      for log in list(t.daily_logs):
        db.delete(log)
      db.delete(t)

    # 5. Delete M2M Product associations
    db.execute(product_pumps.delete().where(product_pumps.c.pump_id == pump_id))

    # 6. Delete the Pump itself
    db.delete(pump)
    db.commit()
    return

@router.get("/{pump_id}/config")
def get_pump_config(pump_id: int, db: Session = Depends(get_db)):
    """Fetch the nested configuration for a pump, including all tanks, machines, and nozzles."""
    pump = db.query(FuelPump).filter(FuelPump.id == pump_id).first()
    if not pump:
        raise HTTPException(status_code=404, detail="Fuel Pump not found")
    
    tanks = []
    for t in pump.tanks:
        t_data = TankResponse.model_validate(t).model_dump()
        t_data["product_name"] = t.product.name
        tanks.append(t_data)
    machines = []
    nozzles = []
    from app.models.log import DailyNozzleLog
    for m in pump.machines:
        m_data = MachineResponse.model_validate(m).model_dump()
        machines.append(m_data)
        for n in m.nozzles:
            last_log = db.query(DailyNozzleLog).filter(DailyNozzleLog.nozzle_id == n.id).order_by(DailyNozzleLog.log_timestamp.desc()).first()
            opening_reading = float(last_log.closing_reading) if last_log else 0.0
            nozzles.append({
                "id": n.id,
                "machine_id": n.machine_id,
                "tank_id": n.tank_id,
                "name": n.name,
                "is_active": n.is_active,
                "tank_name": n.tank.name,
                "product_name": n.tank.product.name,
                "product_price": float(n.tank.product.current_price),
                "opening_reading": opening_reading
            })
            
    products = [ProductResponse.model_validate(p) for p in pump.products]
    credit_accounts = [CreditAccountResponse.model_validate(c) for c in pump.credit_accounts]

    return {
        "pump": FuelPumpResponse.model_validate(pump),
        "tanks": tanks,
        "machines": machines,
        "nozzles": nozzles,
        "products": products,
        "credit_accounts": credit_accounts
    }

@router.put("/{pump_id}/config", status_code=status.HTTP_200_OK)
def update_pump_config(
    pump_id: int,
    payload: PumpConfigUpdateRequest,
    db: Session = Depends(get_db)
):
    """Update nested configuration for a pump, inserting, updating, and deleting tanks/machines/nozzles atomically."""
    # 1. Fetch fuel pump
    pump = db.query(FuelPump).filter(FuelPump.id == pump_id, FuelPump.is_active == True).first()
    if not pump:
        raise HTTPException(status_code=404, detail="Fuel Pump not found")

    from app.models.tank import Tank
    from app.models.machine import Machine, Nozzle
    from app.models.log import DailyTankLog, DailyNozzleLog
    from datetime import datetime
    from zoneinfo import ZoneInfo
    from decimal import Decimal

    IST = ZoneInfo("Asia/Kolkata")
    now = datetime.now(IST)

    # Pre-fetch existing records to detect deletes
    existing_tanks = {t.id: t for t in pump.tanks}
    existing_machines = {m.id: m for m in pump.machines}
    
    # Map of nozzle_id -> nozzle for nozzles belonging to existing machines
    existing_nozzles = {}
    for m in existing_machines.values():
        for n in m.nozzles:
            existing_nozzles[n.id] = n

    # Tracking payload IDs to determine what to delete
    payload_tank_ids = set()
    payload_machine_ids = set()
    payload_nozzle_ids = set()

    # Maps temp_id -> db_id for new tanks and machines
    tank_id_map = {}
    machine_id_map = {}

    # --- Phase 1: Tanks Processing ---
    for tank_in in payload.tanks:
        if tank_in.id is not None:
            # Update existing tank
            if tank_in.id not in existing_tanks:
                raise HTTPException(status_code=400, detail=f"Tank ID {tank_in.id} does not belong to this pump")
            db_tank = existing_tanks[tank_in.id]
            db_tank.name = tank_in.name
            db_tank.product_id = tank_in.product_id
            db_tank.max_capacity = tank_in.max_capacity
            db_tank.actual_dip_volume = tank_in.actual_dip_volume
            db_tank.variance = tank_in.variance
            
            # If actual dip volume has changed compared to the latest tank log, record it
            last_tank_log = db.query(DailyTankLog).filter(DailyTankLog.tank_id == db_tank.id).order_by(DailyTankLog.log_timestamp.desc()).first()
            if not last_tank_log or last_tank_log.actual_dip_volume != tank_in.actual_dip_volume:
                new_tank_log = DailyTankLog(
                    tank_id=db_tank.id,
                    log_date=now.date(),
                    log_timestamp=now,
                    testing_liters=Decimal('0.00'),
                    fuel_received=Decimal('0.00'),
                    actual_dip_volume=tank_in.actual_dip_volume,
                    calculated_variance=tank_in.variance or Decimal('0.00')
                )
                db.add(new_tank_log)

            payload_tank_ids.add(tank_in.id)
            if tank_in.temp_id:
                tank_id_map[tank_in.temp_id] = tank_in.id
        else:
            # Create new tank
            db_tank = Tank(
                pump_id=pump_id,
                product_id=tank_in.product_id,
                name=tank_in.name,
                max_capacity=tank_in.max_capacity,
                actual_dip_volume=tank_in.actual_dip_volume,
                variance=tank_in.variance
            )
            db.add(db_tank)
            db.flush()  # Generate DB ID
            
            # Create starting DailyTankLog entry
            start_tank_log = DailyTankLog(
                tank_id=db_tank.id,
                log_date=now.date(),
                log_timestamp=now,
                testing_liters=Decimal('0.00'),
                fuel_received=Decimal('0.00'),
                actual_dip_volume=db_tank.actual_dip_volume,
                calculated_variance=Decimal('0.00')
            )
            db.add(start_tank_log)
            
            if tank_in.temp_id:
                tank_id_map[tank_in.temp_id] = db_tank.id

    # --- Phase 2: Machines Processing ---
    for mach_in in payload.machines:
        # Determine number of nozzles in this machine
        num_nozzles = len(mach_in.nozzles)
        
        if mach_in.id is not None:
            # Update existing machine
            if mach_in.id not in existing_machines:
                raise HTTPException(status_code=400, detail=f"Machine ID {mach_in.id} does not belong to this pump")
            db_machine = existing_machines[mach_in.id]
            db_machine.name = mach_in.name
            db_machine.is_active = mach_in.is_active
            db_machine.number_of_nozzles = num_nozzles
            
            payload_machine_ids.add(mach_in.id)
            if mach_in.temp_id:
                machine_id_map[mach_in.temp_id] = mach_in.id
        else:
            # Create new machine
            db_machine = Machine(
                pump_id=pump_id,
                name=mach_in.name,
                number_of_nozzles=num_nozzles,
                is_active=mach_in.is_active
            )
            db.add(db_machine)
            db.flush()  # Generate DB ID
            
            if mach_in.temp_id:
                machine_id_map[mach_in.temp_id] = db_machine.id

        # --- Phase 3: Nozzles Processing (per machine) ---
        for noz_in in mach_in.nozzles:
            # Resolve tank ID (could be database integer or temporary string ID)
            resolved_tank_id = None
            if isinstance(noz_in.tank_id, str):
                if noz_in.tank_id not in tank_id_map:
                    raise HTTPException(status_code=400, detail=f"Nozzle refers to unresolved tank temp ID: {noz_in.tank_id}")
                resolved_tank_id = tank_id_map[noz_in.tank_id]
            else:
                resolved_tank_id = noz_in.tank_id

            if noz_in.id is not None:
                # Update existing nozzle
                if noz_in.id not in existing_nozzles:
                    raise HTTPException(status_code=400, detail=f"Nozzle ID {noz_in.id} does not belong to this pump")
                db_nozzle = existing_nozzles[noz_in.id]
                db_nozzle.name = noz_in.name
                db_nozzle.tank_id = resolved_tank_id
                db_nozzle.is_active = noz_in.is_active
                
                # If opening reading has changed from the latest log's closing reading, record it
                last_log = db.query(DailyNozzleLog).filter(DailyNozzleLog.nozzle_id == db_nozzle.id).order_by(DailyNozzleLog.log_timestamp.desc()).first()
                new_reading = noz_in.opening_reading or Decimal('0.00')
                if not last_log or last_log.closing_reading != new_reading:
                    new_base_log = DailyNozzleLog(
                        nozzle_id=db_nozzle.id,
                        log_date=now.date(),
                        log_timestamp=now,
                        opening_reading=new_reading,
                        closing_reading=new_reading,
                        is_reset=False,
                        gross_liters_sold=Decimal('0.00')
                    )
                    db.add(new_base_log)
                
                payload_nozzle_ids.add(noz_in.id)
            else:
                # Create new nozzle
                db_nozzle = Nozzle(
                    machine_id=db_machine.id,
                    tank_id=resolved_tank_id,
                    name=noz_in.name,
                    is_active=noz_in.is_active
                )
                db.add(db_nozzle)
                db.flush()  # Generate DB ID
                
                # Seed starting nozzle logs/reading
                start_noz_log = DailyNozzleLog(
                    nozzle_id=db_nozzle.id,
                    log_date=now.date(),
                    log_timestamp=now,
                    opening_reading=noz_in.opening_reading or Decimal('0.00'),
                    closing_reading=noz_in.opening_reading or Decimal('0.00'),
                    is_reset=False,
                    gross_liters_sold=Decimal('0.00')
                )
                db.add(start_noz_log)

    # --- Phase 4: Deletion Purges ---
    # Deleting nozzles that are not in the payload
    for noz_id, noz in existing_nozzles.items():
        if noz_id not in payload_nozzle_ids:
            # Delete nozzle logs first
            db.query(DailyNozzleLog).filter(DailyNozzleLog.nozzle_id == noz_id).delete(synchronize_session=False)
            db.delete(noz)

    # Deleting machines that are not in the payload
    for mach_id, mach in existing_machines.items():
        if mach_id not in payload_machine_ids:
            # Find and clean its nozzles first (if any remain)
            noz_to_clean = db.query(Nozzle).filter(Nozzle.machine_id == mach_id).all()
            for n in noz_to_clean:
                db.query(DailyNozzleLog).filter(DailyNozzleLog.nozzle_id == n.id).delete(synchronize_session=False)
                db.delete(n)
            db.delete(mach)

    # Deleting tanks that are not in the payload
    for tank_id, tank in existing_tanks.items():
        if tank_id not in payload_tank_ids:
            # Delete tank logs first
            db.query(DailyTankLog).filter(DailyTankLog.tank_id == tank_id).delete(synchronize_session=False)
            # Find any nozzle attached to this tank and clean them
            noz_attached = db.query(Nozzle).filter(Nozzle.tank_id == tank_id).all()
            for n in noz_attached:
                db.query(DailyNozzleLog).filter(DailyNozzleLog.nozzle_id == n.id).delete(synchronize_session=False)
                # Decrement parent machine count or delete if reaches 0
                parent_mach = db.query(Machine).filter(Machine.id == n.machine_id).first()
                if parent_mach:
                    parent_mach.number_of_nozzles -= 1
                    if parent_mach.number_of_nozzles <= 0:
                        db.delete(parent_mach)
                db.delete(n)
            db.delete(tank)

    db.commit()
    return {"status": "success", "message": "Forecourt configuration saved successfully"}
