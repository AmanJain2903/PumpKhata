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
        is_active=pump.is_active,
        opening_cash_balance=pump.opening_cash_balance
    )
    db.add(db_pump)
    db.commit()
    db.refresh(db_pump)

    # Auto-provision constant IOCL Account
    from app.models.credit import PumpAccount
    iocl_account = PumpAccount(
        pump_id=db_pump.id,
        name="IOCL Account",
        balance=0.0,
        is_constant=True
    )
    db.add(iocl_account)
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

    # Ensure default IOCL Account is seeded for this pump (for existing stations)
    from app.models.credit import PumpAccount
    iocl = db.query(PumpAccount).filter(PumpAccount.pump_id == pump_id, PumpAccount.name == "IOCL Account").first()
    if not iocl:
        iocl = PumpAccount(
            pump_id=pump_id,
            name="IOCL Account",
            balance=0.0,
            is_constant=True
        )
        db.add(iocl)
        db.commit()
        db.refresh(pump)
    
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
                "product_id": n.tank.product_id if n.tank else None,
                "name": n.name,
                "is_active": n.is_active,
                "tank_name": n.tank.name if n.tank else "Unknown Tank",
                "product_name": n.tank.product.name if (n.tank and n.tank.product) else "Unknown Product",
                "product_price": float(n.tank.product.current_price) if (n.tank and n.tank.product) else 0.0,
                "opening_reading": opening_reading
            })
            
    products = [ProductResponse.model_validate(p) for p in pump.products]
    credit_accounts = [CreditAccountResponse.model_validate(c) for c in pump.credit_accounts]
    
    # Compute current month and last month balances for ALL accounts from ledger
    from datetime import datetime, date, timedelta
    from zoneinfo import ZoneInfo
    from sqlalchemy import func
    from decimal import Decimal
    from app.models.credit import PumpAccountTransaction
    from app.models.log import DailyLogSession, DailyLogSessionStatus
    from sqlalchemy import or_

    IST = ZoneInfo("Asia/Kolkata")
    today_dt = datetime.now(IST).date()
    start_of_month = date(today_dt.year, today_dt.month, 1)

    end_of_last_month = start_of_month - timedelta(days=1)
    start_of_last_month = date(end_of_last_month.year, end_of_last_month.month, 1)

    for acc in pump.pump_accounts:
        acc.current_month_balance = db.query(func.sum(PumpAccountTransaction.amount)).outerjoin(
            DailyLogSession, DailyLogSession.id == PumpAccountTransaction.session_id
        ).filter(
            PumpAccountTransaction.account_id == acc.id,
            or_(
                PumpAccountTransaction.session_id == None,
                DailyLogSession.status == DailyLogSessionStatus.CLOSED
            ),
            PumpAccountTransaction.log_date >= start_of_month,
            PumpAccountTransaction.log_date <= today_dt
        ).scalar() or Decimal("0.0")

        acc.last_month_balance = db.query(func.sum(PumpAccountTransaction.amount)).outerjoin(
            DailyLogSession, DailyLogSession.id == PumpAccountTransaction.session_id
        ).filter(
            PumpAccountTransaction.account_id == acc.id,
            or_(
                PumpAccountTransaction.session_id == None,
                DailyLogSession.status == DailyLogSessionStatus.CLOSED
            ),
            PumpAccountTransaction.log_date >= start_of_last_month,
            PumpAccountTransaction.log_date <= end_of_last_month
        ).scalar() or Decimal("0.0")

    from app.schemas.credit import PumpAccountResponse
    pump_accounts = [PumpAccountResponse.model_validate(a) for a in pump.pump_accounts]

    # Fetch yesterday's Paytm 1 & Paytm 2 for live preview calculation
    from app.models.log import DailyLogSessionPayment, DailyLogSession, DailyLogSessionStatus
    yesterday = today_dt - timedelta(days=1)
    yesterday_session = db.query(DailyLogSession).filter(
        DailyLogSession.pump_id == pump_id,
        DailyLogSession.log_date == yesterday,
        DailyLogSession.status == DailyLogSessionStatus.CLOSED
    ).first()

    yesterday_paytm1 = Decimal("0.0")
    yesterday_paytm2 = Decimal("0.0")
    if yesterday_session:
        for pm_name, setter in [("Paytm 1", "yesterday_paytm1"), ("Paytm 2", "yesterday_paytm2")]:
            val = db.query(func.sum(DailyLogSessionPayment.amount)).filter(
                DailyLogSessionPayment.session_id == yesterday_session.id,
                DailyLogSessionPayment.payment_method == pm_name
            ).scalar()
            if setter == "yesterday_paytm1":
                yesterday_paytm1 = val or Decimal("0.0")
            else:
                yesterday_paytm2 = val or Decimal("0.0")

    has_logs = db.query(DailyLogSession).filter(
        DailyLogSession.pump_id == pump_id,
        DailyLogSession.status == "CLOSED",
        DailyLogSession.is_initialization == False
    ).first() is not None

    return {
        "pump": FuelPumpResponse.model_validate(pump),
        "tanks": tanks,
        "machines": machines,
        "nozzles": nozzles,
        "products": products,
        "credit_accounts": credit_accounts,
        "pump_accounts": pump_accounts,
        "yesterday_paytm1": yesterday_paytm1,
        "yesterday_paytm2": yesterday_paytm2,
        "has_logs": has_logs
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
    from app.models.log import DailyTankLog, DailyNozzleLog, DailyLogSession, DailyLogSessionStatus, DailyFinancialLog
    from datetime import datetime
    from zoneinfo import ZoneInfo
    from decimal import Decimal

    IST = ZoneInfo("Asia/Kolkata")
    now = datetime.now(IST)

    # Get or create today's daily log session
    session = db.query(DailyLogSession).filter(
        DailyLogSession.pump_id == pump_id,
        DailyLogSession.log_date == now.date()
    ).first()

    if session:
        if session.status == DailyLogSessionStatus.CLOSED:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot update station map layout because the daily session for today ({now.date()}) is already closed. Please reopen it first."
            )
    else:
        # Get opening cash balance from last created session
        last_session = db.query(DailyLogSession).filter(
            DailyLogSession.pump_id == pump_id,
            DailyLogSession.log_date < now.date()
        ).order_by(DailyLogSession.log_date.desc()).first()

        pump_obj = db.query(FuelPump).filter(FuelPump.id == pump_id).first()
        if last_session:
            opening_cash = last_session.closing_cash_balance if last_session.closing_cash_balance is not None else last_session.opening_cash_balance
        else:
            prev_fin_log = db.query(DailyFinancialLog).filter(
                DailyFinancialLog.pump_id == pump_id,
                DailyFinancialLog.log_date < now.date()
            ).order_by(DailyFinancialLog.log_date.desc()).first()
            opening_cash = prev_fin_log.closing_cash_balance if prev_fin_log else (pump_obj.opening_cash_balance if pump_obj else Decimal("0.0"))

        is_first_session = db.query(DailyLogSession).filter(DailyLogSession.pump_id == pump_id).first() is None
        session_date = DailyLogSession.get_next_valid_date(db, pump_id)
        session = DailyLogSession(
            pump_id=pump_id,
            log_date=session_date,
            status=DailyLogSessionStatus.OPEN,
            opened_at=now,
            opening_cash_balance=opening_cash,
            is_initialization=is_first_session,
            misc_cash=Decimal("0.0"),
            misc_digital=Decimal("0.0")
        )
        db.add(session)
        db.flush()

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
                    session_id=session.id,
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
                session_id=session.id,
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
                if noz_in.tank_id.startswith("temp-"):
                    if noz_in.tank_id not in tank_id_map:
                        raise HTTPException(status_code=400, detail=f"Nozzle refers to unresolved tank temp ID: {noz_in.tank_id}")
                    resolved_tank_id = tank_id_map[noz_in.tank_id]
                else:
                    try:
                        resolved_tank_id = int(noz_in.tank_id)
                    except ValueError:
                        raise HTTPException(status_code=400, detail=f"Invalid tank ID: {noz_in.tank_id}")
            else:
                resolved_tank_id = noz_in.tank_id

            # Lookup active product price
            price = Decimal("0.00")
            if resolved_tank_id:
                tank = db.query(Tank).filter(Tank.id == resolved_tank_id).first()
                if tank and tank.product:
                    price = tank.product.current_price or Decimal("0.00")

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
                        session_id=session.id,
                        nozzle_id=db_nozzle.id,
                        product_price=price,
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
                    session_id=session.id,
                    nozzle_id=db_nozzle.id,
                    product_price=price,
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


# --- Pump Account Endpoints ---
from app.models.credit import PumpAccount
from app.schemas.credit import PumpAccountCreate, PumpAccountResponse

@router.get("/{pump_id}/accounts", response_model=List[PumpAccountResponse])
def list_pump_accounts(pump_id: int, db: Session = Depends(get_db)):
    """List all accounts for a specific pump."""
    pump = db.query(FuelPump).filter(FuelPump.id == pump_id).first()
    if not pump:
        raise HTTPException(status_code=404, detail="Fuel Pump not found")

    from datetime import datetime, date, timedelta
    from zoneinfo import ZoneInfo
    from sqlalchemy import func
    from decimal import Decimal
    from app.models.credit import PumpAccountTransaction
    from app.models.log import DailyLogSession, DailyLogSessionStatus
    from sqlalchemy import or_

    IST = ZoneInfo("Asia/Kolkata")
    today_dt = datetime.now(IST).date()
    start_of_month = date(today_dt.year, today_dt.month, 1)

    end_of_last_month = start_of_month - timedelta(days=1)
    start_of_last_month = date(end_of_last_month.year, end_of_last_month.month, 1)

    for acc in pump.pump_accounts:
        acc.current_month_balance = db.query(func.sum(PumpAccountTransaction.amount)).outerjoin(
            DailyLogSession, DailyLogSession.id == PumpAccountTransaction.session_id
        ).filter(
            PumpAccountTransaction.account_id == acc.id,
            or_(
                PumpAccountTransaction.session_id == None,
                DailyLogSession.status == DailyLogSessionStatus.CLOSED
            ),
            PumpAccountTransaction.log_date >= start_of_month,
            PumpAccountTransaction.log_date <= today_dt
        ).scalar() or Decimal("0.0")

        acc.last_month_balance = db.query(func.sum(PumpAccountTransaction.amount)).outerjoin(
            DailyLogSession, DailyLogSession.id == PumpAccountTransaction.session_id
        ).filter(
            PumpAccountTransaction.account_id == acc.id,
            or_(
                PumpAccountTransaction.session_id == None,
                DailyLogSession.status == DailyLogSessionStatus.CLOSED
            ),
            PumpAccountTransaction.log_date >= start_of_last_month,
            PumpAccountTransaction.log_date <= end_of_last_month
        ).scalar() or Decimal("0.0")

    return pump.pump_accounts

@router.post("/{pump_id}/accounts", response_model=PumpAccountResponse, status_code=status.HTTP_201_CREATED)
def create_pump_account(pump_id: int, account: PumpAccountCreate, db: Session = Depends(get_db)):
    """Create a new custom account for a specific pump."""
    pump = db.query(FuelPump).filter(FuelPump.id == pump_id).first()
    if not pump:
        raise HTTPException(status_code=404, detail="Fuel Pump not found")
    
    # Check duplicate name
    existing = db.query(PumpAccount).filter(PumpAccount.pump_id == pump_id, PumpAccount.name == account.name.strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Account with name '{account.name}' already exists for this station.")

    if account.is_paytm_linked:
        db.query(PumpAccount).filter(
            PumpAccount.pump_id == pump_id,
            PumpAccount.is_paytm_linked == True
        ).update({PumpAccount.is_paytm_linked: False})

    from decimal import Decimal
    db_account = PumpAccount(
        pump_id=pump_id,
        name=account.name.strip(),
        balance=Decimal("0.0"),  # Always initialize with 0
        is_constant=False,
        is_paytm_linked=account.is_paytm_linked
    )
    db.add(db_account)
    db.commit()
    db.refresh(db_account)
    db_account.current_month_balance = Decimal("0.0")
    db_account.last_month_balance = Decimal("0.0")
    return db_account

@router.delete("/{pump_id}/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pump_account(pump_id: int, account_id: int, db: Session = Depends(get_db)):
    """Delete a custom account for a pump."""
    account = db.query(PumpAccount).filter(PumpAccount.id == account_id, PumpAccount.pump_id == pump_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    if account.is_constant:
        raise HTTPException(status_code=400, detail="Cannot delete constant 'IOCL Account'.")
        
    db.delete(account)
    db.commit()
    return
