from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import date, datetime
from decimal import Decimal
from zoneinfo import ZoneInfo
from pydantic import BaseModel

from app.database import get_db
from app.models.fuel_pump import FuelPump
from app.models.machine import Machine, Nozzle
from app.models.tank import Tank
from app.models.product import Product, ProductPriceHistory
from app.models.log import DailyNozzleLog, DailyTankLog, DailyFinancialLog
from app.models.credit import CreditAccount, CreditTransaction, CreditTransactionType
from app.schemas.timezone_helper import localize_datetime

IST = ZoneInfo("Asia/Kolkata")

router = APIRouter(prefix="/operations", tags=["Daily Operations & Shift Logs"])

# --- Request/Response Pydantic Schemas ---

class NozzleLogEntry(BaseModel):
    nozzle_id: int
    closing_reading: Decimal
    is_reset: bool = False

class TankLogEntry(BaseModel):
    tank_id: int
    testing_liters: Decimal = Decimal("0.0")
    fuel_received: Decimal = Decimal("0.0")
    actual_dip_volume: Decimal

class CreditSaleEntry(BaseModel):
    account_id: int
    amount: Decimal
    notes: Optional[str] = None

class ShiftSubmitRequest(BaseModel):
    log_date: date
    log_timestamp: datetime
    nozzle_logs: List[NozzleLogEntry]
    tank_logs: List[TankLogEntry]
    cash_collected: Decimal
    digital_collected: Decimal
    credit_sales_logged: Decimal
    credit_sales: List[CreditSaleEntry] = []

class PrefillNozzleResponse(BaseModel):
    nozzle_id: int
    nozzle_name: str
    machine_name: str
    opening_reading: Decimal
    product_id: int
    product_name: str
    product_price: Decimal

class PrefillTankResponse(BaseModel):
    tank_id: int
    tank_name: str
    product_id: int
    product_name: str
    opening_dip_volume: Decimal

class PrefillResponse(BaseModel):
    log_date: date
    log_timestamp: datetime
    opening_cash_balance: Decimal
    nozzles: List[PrefillNozzleResponse]
    tanks: List[PrefillTankResponse]

# --- Helper Functions ---

def get_historical_price_and_margin(db: Session, product_id: int, timestamp: datetime):
    """Retrieve the price and margin valid at the given timestamp from history, fallback to current values."""
    hist = db.query(ProductPriceHistory).filter(
        ProductPriceHistory.product_id == product_id,
        ProductPriceHistory.valid_from <= timestamp
    ).filter(
        (ProductPriceHistory.valid_to == None) | (ProductPriceHistory.valid_to > timestamp)
    ).order_by(ProductPriceHistory.valid_from.desc()).first()

    if hist:
        return hist.selling_price, hist.cost_margin
    
    product = db.query(Product).filter(Product.id == product_id).first()
    if product:
        return product.current_price, product.current_margin
    return Decimal("0.0"), Decimal("0.0")

# --- Routes ---

@router.get("/prefill/{pump_id}", response_model=PrefillResponse)
def prefill_shift_log(pump_id: int, log_timestamp: Optional[datetime] = None, db: Session = Depends(get_db)):
    """Prefills the daily shift log with yesterday's closing readings, cash, and dip volumes based on the timestamp."""
    # Default to current datetime in IST
    if log_timestamp is None:
        log_timestamp = datetime.now(IST)
    else:
        log_timestamp = localize_datetime(log_timestamp)
    log_date = log_timestamp.date()

    pump = db.query(FuelPump).filter(FuelPump.id == pump_id, FuelPump.is_active == True).first()
    if not pump:
        raise HTTPException(status_code=404, detail="Fuel Pump not found")

    # 1. Fetch yesterday's closing cash
    prev_fin_log = db.query(DailyFinancialLog).filter(
        DailyFinancialLog.pump_id == pump_id,
        DailyFinancialLog.log_timestamp < log_timestamp
    ).order_by(DailyFinancialLog.log_timestamp.desc()).first()
    opening_cash_balance = prev_fin_log.closing_cash_balance if prev_fin_log else Decimal("0.0")

    # 2. Fetch nozzles and their opening meter readings
    prefill_nozzles = []
    for machine in pump.machines:
        if not machine.is_active:
            continue
        for nozzle in machine.nozzles:
            if not nozzle.is_active:
                continue
            
            # Yesterday's closing reading
            prev_nozzle_log = db.query(DailyNozzleLog).filter(
                DailyNozzleLog.nozzle_id == nozzle.id,
                DailyNozzleLog.log_timestamp < log_timestamp
            ).order_by(DailyNozzleLog.log_timestamp.desc()).first()
            opening_reading = prev_nozzle_log.closing_reading if prev_nozzle_log else Decimal("0.0")

            # Active product price
            price, _ = get_historical_price_and_margin(db, nozzle.tank.product_id, log_timestamp)

            prefill_nozzles.append(PrefillNozzleResponse(
                nozzle_id=nozzle.id,
                nozzle_name=nozzle.name,
                machine_name=machine.name,
                opening_reading=opening_reading,
                product_id=nozzle.tank.product_id,
                product_name=nozzle.tank.product.name,
                product_price=price
            ))

    # 3. Fetch tanks and their opening dip volumes
    prefill_tanks = []
    for tank in pump.tanks:
        # Yesterday's closing dip volume
        prev_tank_log = db.query(DailyTankLog).filter(
            DailyTankLog.tank_id == tank.id,
            DailyTankLog.log_timestamp < log_timestamp
        ).order_by(DailyTankLog.log_timestamp.desc()).first()
        opening_dip_volume = prev_tank_log.actual_dip_volume if prev_tank_log else Decimal("0.0")

        prefill_tanks.append(PrefillTankResponse(
            tank_id=tank.id,
            tank_name=tank.name,
            product_id=tank.product_id,
            product_name=tank.product.name,
            opening_dip_volume=opening_dip_volume
        ))

    return PrefillResponse(
        log_date=log_date,
        log_timestamp=log_timestamp,
        opening_cash_balance=opening_cash_balance,
        nozzles=prefill_nozzles,
        tanks=prefill_tanks
    )

@router.post("/submit/{pump_id}", status_code=status.HTTP_201_CREATED)
def submit_shift_log(pump_id: int, req: ShiftSubmitRequest, db: Session = Depends(get_db)):
    """Submits the daily shift logs, performs reconciliations, and updates balances in a single atomic transaction."""
    pump = db.query(FuelPump).filter(FuelPump.id == pump_id, FuelPump.is_active == True).first()
    if not pump:
        raise HTTPException(status_code=404, detail="Fuel pump not found")

    # Ensure no duplicate log for the same pump and timestamp
    existing_financial = db.query(DailyFinancialLog).filter(
        DailyFinancialLog.pump_id == pump_id,
        DailyFinancialLog.log_timestamp == req.log_timestamp
    ).first()
    if existing_financial:
        raise HTTPException(
            status_code=400,
            detail=f"A shift log has already been submitted for this pump at timestamp {req.log_timestamp}."
        )

    # Validate credit sales sum matches credit_sales_logged
    credit_sales_sum = sum(cs.amount for cs in req.credit_sales)
    if req.credit_sales_logged != credit_sales_sum:
        raise HTTPException(
            status_code=400,
            detail=f"Credit sales sum ({credit_sales_sum}) does not match credit_sales_logged ({req.credit_sales_logged})"
        )

    # 1. Map request logs for easy lookup
    req_nozzles = {nl.nozzle_id: nl for nl in req.nozzle_logs}
    req_tanks = {tl.tank_id: tl for tl in req.tank_logs}

    # Track nozzle sold quantities per tank to calculate book stock
    tank_dispensed = {tank.id: Decimal("0.0") for tank in pump.tanks}
    nozzle_prices = {}

    # Process Nozzle Logs
    for machine in pump.machines:
        if not machine.is_active:
            continue
        for nozzle in machine.nozzles:
            if not nozzle.is_active:
                continue

            if nozzle.id not in req_nozzles:
                raise HTTPException(
                    status_code=400,
                    detail=f"Missing reading input for Nozzle: {nozzle.name} (ID: {nozzle.id})"
                )

            log_entry = req_nozzles[nozzle.id]

            # Fetch previous reading
            prev_log = db.query(DailyNozzleLog).filter(
                DailyNozzleLog.nozzle_id == nozzle.id,
                DailyNozzleLog.log_timestamp < req.log_timestamp
            ).order_by(DailyNozzleLog.log_timestamp.desc()).first()
            opening_reading = prev_log.closing_reading if prev_log else Decimal("0.0")

            # Check rollover logic
            if log_entry.closing_reading < opening_reading:
                if not log_entry.is_reset:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Meter rollover/reset detected on Nozzle {nozzle.name}. "
                               f"Closing reading ({log_entry.closing_reading}) is less than opening reading ({opening_reading}). "
                               f"Please confirm rollover override."
                    )
                # If override is active, gross liters is exactly the closing reading
                gross_liters_sold = log_entry.closing_reading
            else:
                gross_liters_sold = log_entry.closing_reading - opening_reading

            # Save nozzle log
            db_nozzle_log = DailyNozzleLog(
                nozzle_id=nozzle.id,
                log_date=req.log_date,
                log_timestamp=req.log_timestamp,
                opening_reading=opening_reading,
                closing_reading=log_entry.closing_reading,
                is_reset=log_entry.is_reset,
                gross_liters_sold=gross_liters_sold
            )
            db.add(db_nozzle_log)

            # Store mapping to calculate expected revenue and tank volumes
            tank_dispensed[nozzle.tank_id] = tank_dispensed.get(nozzle.tank_id, Decimal("0.0")) + gross_liters_sold
            
            # Get pricing active at log_timestamp
            price, _ = get_historical_price_and_margin(db, nozzle.tank.product_id, req.log_timestamp)
            nozzle_prices[nozzle.id] = (gross_liters_sold, price)

    # Process Tank Logs
    for tank in pump.tanks:
        if tank.id not in req_tanks:
            raise HTTPException(
                status_code=400,
                detail=f"Missing inventory logs for Tank: {tank.name} (ID: {tank.id})"
            )

        tank_entry = req_tanks[tank.id]

        # Fetch previous tank log to establish the opening physical stock baseline
        prev_tank_log = db.query(DailyTankLog).filter(
            DailyTankLog.tank_id == tank.id,
            DailyTankLog.log_timestamp < req.log_timestamp
        ).order_by(DailyTankLog.log_timestamp.desc()).first()
        
        if prev_tank_log:
            # Baseline is yesterday's actual physical closing stock (dip volume)
            yesterday_physical_stock = prev_tank_log.actual_dip_volume
        else:
            yesterday_physical_stock = Decimal("0.0")

        # Book Stock Calculation
        # Expected Book Stock = Yesterday's Physical Stock + Fuel Received - Gross Dispensed + Testing Liters (poured back)
        sum_gross_nozzles = tank_dispensed.get(tank.id, Decimal("0.0"))
        expected_book_stock = yesterday_physical_stock + tank_entry.fuel_received - sum_gross_nozzles + tank_entry.testing_liters

        # Calculate Variance
        calculated_variance = tank_entry.actual_dip_volume - expected_book_stock

        db_tank_log = DailyTankLog(
            tank_id=tank.id,
            log_date=req.log_date,
            log_timestamp=req.log_timestamp,
            testing_liters=tank_entry.testing_liters,
            fuel_received=tank_entry.fuel_received,
            actual_dip_volume=tank_entry.actual_dip_volume,
            calculated_variance=calculated_variance
        )
        db.add(db_tank_log)

    # 3. Calculate Financials
    # Expected Revenue = sum(Nozzle Gross Liters * Nozzle Product Price) - sum(Tank Testing Liters * Tank Product Price)
    gross_nozzle_revenue = sum(gross * price for gross, price in nozzle_prices.values())
    
    testing_deductions = Decimal("0.0")
    for tank in pump.tanks:
        tank_entry = req_tanks[tank.id]
        if tank_entry.testing_liters > 0:
            # Price of the product in this tank
            price, _ = get_historical_price_and_margin(db, tank.product_id, req.log_timestamp)
            testing_deductions += tank_entry.testing_liters * price

    expected_revenue = gross_nozzle_revenue - testing_deductions

    # Shortage/Overage
    total_reported = req.cash_collected + req.digital_collected + req.credit_sales_logged
    shortage_overage = total_reported - expected_revenue

    # Fetch previous closing cash
    prev_fin_log = db.query(DailyFinancialLog).filter(
        DailyFinancialLog.pump_id == pump_id,
        DailyFinancialLog.log_timestamp < req.log_timestamp
    ).order_by(DailyFinancialLog.log_timestamp.desc()).first()
    opening_cash_balance = prev_fin_log.closing_cash_balance if prev_fin_log else Decimal("0.0")
    closing_cash_balance = opening_cash_balance + req.cash_collected

    db_financial_log = DailyFinancialLog(
        pump_id=pump_id,
        log_date=req.log_date,
        log_timestamp=req.log_timestamp,
        opening_cash_balance=opening_cash_balance,
        expected_revenue=expected_revenue,
        cash_collected=req.cash_collected,
        digital_collected=req.digital_collected,
        credit_sales_logged=req.credit_sales_logged,
        closing_cash_balance=closing_cash_balance,
        shortage_overage=shortage_overage
    )
    db.add(db_financial_log)

    # 4. Handle Credit Transactions
    for cs in req.credit_sales:
        account = db.query(CreditAccount).filter(CreditAccount.id == cs.account_id, CreditAccount.pump_id == pump_id).first()
        if not account:
            raise HTTPException(
                status_code=400,
                detail=f"Credit account ID {cs.account_id} not found or doesn't belong to this pump."
            )

        db_tx = CreditTransaction(
            account_id=cs.account_id,
            log_date=req.log_date,
            log_timestamp=req.log_timestamp,
            type=CreditTransactionType.CHARGE,
            amount=cs.amount,
            notes=cs.notes or f"Daily credit sales on shift {req.log_date}"
        )
        db.add(db_tx)
        account.current_outstanding_balance += cs.amount

    db.commit()

    return {
        "status": "success",
        "message": "Shift logs submitted and validated successfully.",
        "calculations": {
            "expected_revenue": expected_revenue,
            "total_reported": total_reported,
            "shortage_overage": shortage_overage,
            "opening_cash_balance": opening_cash_balance,
            "closing_cash_balance": closing_cash_balance,
        }
    }
