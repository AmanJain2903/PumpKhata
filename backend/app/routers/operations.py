from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo
from pydantic import BaseModel

from app.database import get_db
from app.models.fuel_pump import FuelPump
from app.models.machine import Machine, Nozzle
from app.models.tank import Tank
from app.models.product import Product, ProductPriceHistory
from app.models.log import DailyNozzleLog, DailyTankLog, DailyFinancialLog, DailyLogSession, DailyLogSessionStatus
from app.models.credit import CreditAccount, CreditTransaction, CreditTransactionType, PaymentMethodType
from app.schemas.timezone_helper import localize_datetime
from app.schemas.log import (
    DailyNozzleLogResponse,
    DailyTankLogResponse,
    DailyLogSessionResponse,
    DailyLogSessionDetailResponse
)
from app.schemas.credit import CreditTransactionResponse

IST = ZoneInfo("Asia/Kolkata")

router = APIRouter(prefix="/operations", tags=["Daily Operations & Shift Logs"])

# --- Request Pydantic Schemas ---

class NozzleReadingEntry(BaseModel):
    closing_reading: Decimal
    product_price: Decimal
    is_reset: bool = False

class NozzleReadingsSave(BaseModel):
    nozzle_id: int
    entries: List[NozzleReadingEntry]

class TankReadingsSave(BaseModel):
    tank_id: int
    testing_liters: Decimal = Decimal("0.0")
    fuel_received: Decimal = Decimal("0.0")
    actual_dip_volume: Decimal

class CreditChargeCreate(BaseModel):
    account_id: int
    amount: Decimal
    notes: Optional[str] = None

class CreditPaymentCreate(BaseModel):
    account_id: int
    amount: Decimal
    payment_method: Optional[str] = "CASH"
    notes: Optional[str] = None

class MiscSave(BaseModel):
    misc_cash: Decimal = Decimal("0.0")
    misc_notes: Optional[str] = None


class SessionCollectionInput(BaseModel):
    payment_method: str
    amount: Decimal

class CashDepositInput(BaseModel):
    account_id: int
    amount: Decimal

class CloseSessionRequest(BaseModel):
    fuel_collections: List[SessionCollectionInput]
    cash_deposits: Optional[List[CashDepositInput]] = None
    prior_period_adjustment: Decimal = Decimal("0.0")
    adjustment_notes: Optional[str] = None

# Legacy Request Schemas
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
    has_price_change: bool = False
    old_price: Optional[Decimal] = None

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
    """Retrieve the current price and margin for the product directly from the database."""
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

    # 1. Fetch yesterday's closing cash (first search new sessions, fallback to legacy logs)
    prev_session = db.query(DailyLogSession).filter(
        DailyLogSession.pump_id == pump_id,
        DailyLogSession.log_date < log_date
    ).order_by(DailyLogSession.log_date.desc()).first()
    
    if prev_session:
        opening_cash_balance = prev_session.closing_cash_balance if prev_session.closing_cash_balance is not None else prev_session.opening_cash_balance
    else:
        prev_fin_log = db.query(DailyFinancialLog).filter(
            DailyFinancialLog.pump_id == pump_id,
            DailyFinancialLog.log_date < log_date
        ).order_by(DailyFinancialLog.log_date.desc()).first()
        opening_cash_balance = prev_fin_log.closing_cash_balance if prev_fin_log else pump.opening_cash_balance

    # 2. Fetch nozzles and their opening meter readings
    # Pre-compute price change info per product for today
    # A price change today means a ProductPriceHistory record was closed (valid_to set) today
    price_change_cache = {}  # product_id -> old_price or None
    today_start = datetime.combine(log_date, time.min).replace(tzinfo=IST)
    today_end = datetime.combine(log_date, time.max).replace(tzinfo=IST)

    for product in pump.products:
        # Find history records that were closed today (valid_to is today)
        closed_today = db.query(ProductPriceHistory).filter(
            ProductPriceHistory.product_id == product.id,
            ProductPriceHistory.valid_to >= today_start,
            ProductPriceHistory.valid_to <= today_end
        ).order_by(ProductPriceHistory.valid_from.asc()).all()

        if closed_today:
            # Use the earliest record's selling_price as the "old price"
            price_change_cache[product.id] = closed_today[0].selling_price
        else:
            price_change_cache[product.id] = None

    prefill_nozzles = []
    for machine in pump.machines:
        if not machine.is_active:
            continue
        for nozzle in machine.nozzles:
            if not nozzle.is_active:
                continue
            
            # Yesterday's closing reading (new session logs first, fallback to legacy)
            prev_nozzle_log = db.query(DailyNozzleLog).filter(
                DailyNozzleLog.nozzle_id == nozzle.id,
                DailyNozzleLog.log_date < log_date
            ).order_by(DailyNozzleLog.log_date.desc(), DailyNozzleLog.entry_index.desc()).first()
            
            opening_reading = prev_nozzle_log.closing_reading if prev_nozzle_log else Decimal("0.0")

            # Active product price
            price, _ = get_historical_price_and_margin(db, nozzle.tank.product_id, log_timestamp)

            # Check if this product had a price change today
            old_price = price_change_cache.get(nozzle.tank.product_id)
            has_price_change = old_price is not None and old_price != price

            prefill_nozzles.append(PrefillNozzleResponse(
                nozzle_id=nozzle.id,
                nozzle_name=nozzle.name,
                machine_name=machine.name,
                opening_reading=opening_reading,
                product_id=nozzle.tank.product_id,
                product_name=nozzle.tank.product.name,
                product_price=price,
                has_price_change=has_price_change,
                old_price=old_price if has_price_change else None
            ))

    # 3. Fetch tanks and their opening dip volumes
    prefill_tanks = []
    for tank in pump.tanks:
        # Yesterday's closing dip volume
        prev_tank_log = db.query(DailyTankLog).filter(
            DailyTankLog.tank_id == tank.id,
            DailyTankLog.log_date < log_date
        ).order_by(DailyTankLog.log_date.desc()).first()
        
        opening_dip_volume = prev_tank_log.actual_dip_volume if prev_tank_log else tank.actual_dip_volume

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


# --- New Session Endpoints ---

@router.get("/session/{pump_id}", response_model=DailyLogSessionDetailResponse)
def get_or_create_session(pump_id: int, date_str: Optional[str] = None, db: Session = Depends(get_db)):
    """Retrieves or creates a daily log session for the pump for the next valid sequential date."""
    pump = db.query(FuelPump).filter(FuelPump.id == pump_id, FuelPump.is_active == True).first()
    if not pump:
        raise HTTPException(status_code=404, detail="Active fuel pump not found")

    log_date = DailyLogSession.get_next_valid_date(db, pump_id)

    session = db.query(DailyLogSession).filter(
        DailyLogSession.pump_id == pump_id,
        DailyLogSession.log_date == log_date
    ).first()

    if session:
        return session

    # Get opening cash balance from last created session
    last_session = db.query(DailyLogSession).filter(
        DailyLogSession.pump_id == pump_id,
        DailyLogSession.log_date < log_date
    ).order_by(DailyLogSession.log_date.desc()).first()

    pump = db.query(FuelPump).filter(FuelPump.id == pump_id).first()
    if last_session:
        opening_cash = last_session.closing_cash_balance if last_session.closing_cash_balance is not None else last_session.opening_cash_balance
    else:
        # Fallback to legacy logs
        prev_fin_log = db.query(DailyFinancialLog).filter(
            DailyFinancialLog.pump_id == pump_id,
            DailyFinancialLog.log_date < log_date
        ).order_by(DailyFinancialLog.log_date.desc()).first()
        opening_cash = prev_fin_log.closing_cash_balance if prev_fin_log else (pump.opening_cash_balance if pump else Decimal("0.0"))

    is_first_session = db.query(DailyLogSession).filter(DailyLogSession.pump_id == pump_id).first() is None

    # Create new session
    session = DailyLogSession(
        pump_id=pump_id,
        log_date=log_date,
        status=DailyLogSessionStatus.OPEN,
        opened_at=datetime.now(IST),
        opening_cash_balance=opening_cash,
        is_initialization=is_first_session,
        misc_cash=Decimal("0.0"),
        misc_digital=Decimal("0.0")
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session

@router.get("/session/{pump_id}/summary")
def get_session_summary(pump_id: int, date_str: Optional[str] = None, db: Session = Depends(get_db)):
    """Lightweight endpoint returning logged status of each section for today."""
    if date_str:
        log_date = date.fromisoformat(date_str)
    else:
        log_date = datetime.now(IST).date()

    session = db.query(DailyLogSession).filter(
        DailyLogSession.pump_id == pump_id,
        DailyLogSession.log_date == log_date
    ).first()

    if not session:
        return {
            "status": "NOT_LOGGED",
            "session_id": None,
            "nozzle_readings_logged": False,
            "tank_readings_logged": False,
            "credit_sales_count": 0,
            "credit_payments_count": 0,
            "misc_logged": False
        }

    nozzle_count = db.query(func.count(DailyNozzleLog.id)).filter(DailyNozzleLog.session_id == session.id).scalar()
    tank_count = db.query(func.count(DailyTankLog.id)).filter(DailyTankLog.session_id == session.id).scalar()
    
    credit_sales_count = db.query(func.count(CreditTransaction.id)).filter(
        CreditTransaction.session_id == session.id,
        CreditTransaction.type == CreditTransactionType.CHARGE
    ).scalar()

    credit_payments_count = db.query(func.count(CreditTransaction.id)).filter(
        CreditTransaction.session_id == session.id,
        CreditTransaction.type == CreditTransactionType.PAYMENT
    ).scalar()

    misc_logged = (session.misc_cash > 0 or session.misc_digital > 0 or session.misc_notes is not None)

    return {
        "status": session.status,
        "session_id": session.id,
        "nozzle_readings_logged": nozzle_count > 0,
        "tank_readings_logged": tank_count > 0,
        "credit_sales_count": credit_sales_count,
        "credit_payments_count": credit_payments_count,
        "misc_logged": misc_logged
    }

@router.post("/session/{session_id}/reopen")
def reopen_session(session_id: int, db: Session = Depends(get_db)):
    """Re-opens a closed session. Only permitted for today's date in IST."""
    session = db.query(DailyLogSession).filter(DailyLogSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    today = datetime.now(IST).date()
    if session.log_date != today:
        raise HTTPException(status_code=400, detail="Only today's logging session can be re-opened.")

    # Reverse ALL account ledger entries for this session (IOCL, Paytm, etc.)
    from app.models.credit import PumpAccount, PumpAccountTransaction
    from sqlalchemy import func
    from decimal import Decimal

    # Get all ledger entries grouped by account for this session
    ledger_entries = db.query(PumpAccountTransaction).filter(
        PumpAccountTransaction.session_id == session_id
    ).all()

    for entry in ledger_entries:
        # Reverse the balance
        account = db.query(PumpAccount).filter(PumpAccount.id == entry.account_id).first()
        if account:
            account.balance -= entry.amount

    session.status = DailyLogSessionStatus.OPEN
    session.closed_at = None
    db.commit()
    return {"status": "success", "message": "Session re-opened successfully"}

@router.put("/session/{session_id}/nozzle-readings")
def save_nozzle_readings(session_id: int, readings: List[NozzleReadingsSave], db: Session = Depends(get_db)):
    """Atomically replaces all nozzle readings for this session."""
    session = db.query(DailyLogSession).filter(DailyLogSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status == DailyLogSessionStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Cannot edit readings for a closed session")

    # Delete existing nozzle readings for this session
    db.query(DailyNozzleLog).filter(DailyNozzleLog.session_id == session_id).delete()

    for r in readings:
        nozzle = db.query(Nozzle).filter(Nozzle.id == r.nozzle_id).first()
        if not nozzle:
            raise HTTPException(status_code=404, detail=f"Nozzle {r.nozzle_id} not found")

        # Establish base opening reading
        prev_log = db.query(DailyNozzleLog).join(DailyLogSession).filter(
            DailyNozzleLog.nozzle_id == r.nozzle_id,
            DailyLogSession.log_date < session.log_date
        ).order_by(DailyLogSession.log_date.desc(), DailyNozzleLog.entry_index.desc()).first()

        opening_reading = prev_log.closing_reading if prev_log else Decimal("0.0")

        for idx, entry in enumerate(r.entries):
            if entry.closing_reading < 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Closing reading cannot be negative on Nozzle {nozzle.name}."
                )
            # Check rollover logic
            if entry.closing_reading < opening_reading:
                if not entry.is_reset:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Rollover detected on Nozzle {nozzle.name}. Closing {entry.closing_reading} < Opening {opening_reading}."
                    )
                gross = entry.closing_reading
            else:
                gross = entry.closing_reading - opening_reading

            db_log = DailyNozzleLog(
                session_id=session_id,
                nozzle_id=r.nozzle_id,
                entry_index=idx,
                product_price=entry.product_price,
                log_date=session.log_date,
                log_timestamp=datetime.now(IST),
                opening_reading=opening_reading,
                closing_reading=entry.closing_reading,
                is_reset=entry.is_reset,
                gross_liters_sold=gross
            )
            db.add(db_log)
            # Opening reading for next index is current closing reading
            opening_reading = entry.closing_reading

    db.commit()
    return {"status": "success", "message": "Nozzle readings saved successfully"}

@router.put("/session/{session_id}/tank-readings")
def save_tank_readings(session_id: int, readings: List[TankReadingsSave], db: Session = Depends(get_db)):
    """Atomically replaces all tank dip readings for this session."""
    session = db.query(DailyLogSession).filter(DailyLogSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status == DailyLogSessionStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Cannot edit readings for a closed session")

    # Delete existing tank logs for this session
    db.query(DailyTankLog).filter(DailyTankLog.session_id == session_id).delete()

    # Get nozzles and their gross dispensed quantities in this session to calculate variance
    nozzle_logs = db.query(DailyNozzleLog).filter(DailyNozzleLog.session_id == session_id).all()
    nozzle_dispensed = {} # nozzle_id -> gross_liters
    for nl in nozzle_logs:
        nozzle_dispensed[nl.nozzle_id] = nozzle_dispensed.get(nl.nozzle_id, Decimal("0.0")) + nl.gross_liters_sold

    for r in readings:
        if r.testing_liters < 0 or r.fuel_received < 0 or r.actual_dip_volume < 0:
            raise HTTPException(
                status_code=400,
                detail="Testing liters, fuel received, and actual dip volume cannot be negative."
            )
        tank = db.query(Tank).filter(Tank.id == r.tank_id).first()
        if not tank:
            raise HTTPException(status_code=404, detail=f"Tank {r.tank_id} not found")

        # Get previous dip volume
        prev_log = db.query(DailyTankLog).join(DailyLogSession).filter(
            DailyTankLog.tank_id == r.tank_id,
            DailyLogSession.log_date < session.log_date
        ).order_by(DailyLogSession.log_date.desc()).first()

        opening_dip = prev_log.actual_dip_volume if prev_log else tank.actual_dip_volume

        # Compute total gross sold from nozzles connected to this tank in this session
        gross_sold = Decimal("0.0")
        for nozzle in tank.nozzles:
            gross_sold += nozzle_dispensed.get(nozzle.id, Decimal("0.0"))

        book_stock = opening_dip + r.fuel_received - gross_sold + r.testing_liters
        variance = r.actual_dip_volume - book_stock

        db_log = DailyTankLog(
            session_id=session_id,
            tank_id=r.tank_id,
            log_date=session.log_date,
            log_timestamp=datetime.now(IST),
            testing_liters=r.testing_liters,
            fuel_received=r.fuel_received,
            actual_dip_volume=r.actual_dip_volume,
            calculated_variance=variance
        )
        db.add(db_log)

    db.commit()
    return {"status": "success", "message": "Tank readings saved successfully"}

@router.post("/session/{session_id}/credit-charge", response_model=CreditTransactionResponse)
def add_session_credit_charge(session_id: int, req: CreditChargeCreate, db: Session = Depends(get_db)):
    """Records a single B2B credit sale charge linked to the session."""
    session = db.query(DailyLogSession).filter(DailyLogSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status == DailyLogSessionStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Cannot edit a closed session")

    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Credit sale amount must be positive.")

    account = db.query(CreditAccount).filter(CreditAccount.id == req.account_id, CreditAccount.pump_id == session.pump_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Credit account not found or mismatch")

    tx = CreditTransaction(
        account_id=req.account_id,
        session_id=session_id,
        log_date=session.log_date,
        log_timestamp=datetime.now(IST),
        type=CreditTransactionType.CHARGE,
        amount=req.amount,
        notes=req.notes
    )
    db.add(tx)
    account.current_outstanding_balance += req.amount
    db.commit()
    db.refresh(tx)
    return tx

@router.delete("/session/{session_id}/credit-charge/{tx_id}")
def delete_session_credit_charge(session_id: int, tx_id: int, db: Session = Depends(get_db)):
    """Removes a linked B2B credit charge from the session, reversing the account balance change."""
    session = db.query(DailyLogSession).filter(DailyLogSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status == DailyLogSessionStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Cannot edit a closed session")

    tx = db.query(CreditTransaction).filter(
        CreditTransaction.id == tx_id,
        CreditTransaction.session_id == session_id,
        CreditTransaction.type == CreditTransactionType.CHARGE
    ).first()

    if not tx:
        raise HTTPException(status_code=404, detail="Credit charge transaction not found in this session")

    account = tx.account
    account.current_outstanding_balance -= tx.amount
    db.delete(tx)
    db.commit()
    return {"status": "success", "message": "Credit charge removed"}

@router.post("/session/{session_id}/credit-payment", response_model=CreditTransactionResponse)
def add_session_credit_payment(session_id: int, req: CreditPaymentCreate, db: Session = Depends(get_db)):
    """Records a B2B client credit payment received linked to the session."""
    session = db.query(DailyLogSession).filter(DailyLogSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status == DailyLogSessionStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Cannot edit a closed session")

    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be positive.")

    account = db.query(CreditAccount).filter(CreditAccount.id == req.account_id, CreditAccount.pump_id == session.pump_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Credit account not found or mismatch")

    pay_method = req.payment_method or "CASH"

    tx = CreditTransaction(
        account_id=req.account_id,
        session_id=session_id,
        log_date=session.log_date,
        log_timestamp=datetime.now(IST),
        type=CreditTransactionType.PAYMENT,
        amount=req.amount,
        payment_method=pay_method,
        notes=req.notes
    )
    db.add(tx)
    account.current_outstanding_balance -= req.amount
    db.commit()
    db.refresh(tx)
    return tx

@router.delete("/session/{session_id}/credit-payment/{tx_id}")
def delete_session_credit_payment(session_id: int, tx_id: int, db: Session = Depends(get_db)):
    """Removes a linked B2B payment transaction from the session, reversing the account balance change."""
    session = db.query(DailyLogSession).filter(DailyLogSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status == DailyLogSessionStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Cannot edit a closed session")

    tx = db.query(CreditTransaction).filter(
        CreditTransaction.id == tx_id,
        CreditTransaction.session_id == session_id,
        CreditTransaction.type == CreditTransactionType.PAYMENT
    ).first()

    if not tx:
        raise HTTPException(status_code=404, detail="Credit payment transaction not found in this session")

    account = tx.account
    account.current_outstanding_balance += tx.amount
    db.delete(tx)
    db.commit()
    return {"status": "success", "message": "Credit payment removed"}

@router.put("/session/{session_id}/misc")
def save_session_misc(session_id: int, req: MiscSave, db: Session = Depends(get_db)):
    """Saves miscellaneous expenditure totals for the daily session."""
    session = db.query(DailyLogSession).filter(DailyLogSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status == DailyLogSessionStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Cannot edit a closed session.")

    if req.misc_cash < 0:
        raise HTTPException(status_code=400, detail="Miscellaneous cash expenditure cannot be negative.")

    session.misc_cash = req.misc_cash
    session.misc_digital = Decimal("0.0")
    session.misc_notes = req.misc_notes
    db.commit()
    return {"status": "success", "message": "Miscellaneous expenditure saved"}

@router.post("/session/{session_id}/close")
def close_session(session_id: int, req: CloseSessionRequest, db: Session = Depends(get_db)):
    """Atomically computes reconciliation calculations, updates tank baselines, and closes the session."""
    session = db.query(DailyLogSession).filter(DailyLogSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status == DailyLogSessionStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Session is already closed")

    # 1. Validation check - Nozzle and Tank logs must exist
    nozzle_logs = db.query(DailyNozzleLog).filter(DailyNozzleLog.session_id == session_id).all()
    tank_logs = db.query(DailyTankLog).filter(DailyTankLog.session_id == session_id).all()

    if not nozzle_logs:
        raise HTTPException(status_code=400, detail="Cannot close day: Nozzle readings must be saved first.")
    if not tank_logs:
        raise HTTPException(status_code=400, detail="Cannot close day: Tank dip volumes must be saved first.")

    # 2. Expected revenue calculation (Rounded per tank)
    from decimal import ROUND_HALF_UP

    # Map nozzles to tanks
    nozzle_tank_map = {}
    for nl in nozzle_logs:
        nozzle = db.query(Nozzle).filter(Nozzle.id == nl.nozzle_id).first()
        if nozzle:
            nozzle_tank_map[nl.nozzle_id] = nozzle.tank_id

    tanks_set = set(nozzle_tank_map.values())
    for tl in tank_logs:
        tanks_set.add(tl.tank_id)

    expected_revenue = Decimal("0.0")

    for tank_id in tanks_set:
        if not tank_id:
            continue
            
        tank_rev = Decimal("0.0")
        
        # Add nozzle sales for this tank
        for nl in nozzle_logs:
            if nozzle_tank_map.get(nl.nozzle_id) == tank_id:
                tank_rev += nl.gross_liters_sold * nl.product_price
                
        # Deduct testing liters for this tank
        for tl in tank_logs:
            if tl.tank_id == tank_id and tl.testing_liters > 0:
                price, _ = get_historical_price_and_margin(db, tl.tank.product_id, tl.log_timestamp)
                tank_rev -= tl.testing_liters * price
                
        expected_revenue += tank_rev.quantize(Decimal('1'), rounding=ROUND_HALF_UP)

    # 3. Sum credit sales charges logged today
    credit_sales_total = db.query(func.sum(CreditTransaction.amount)).filter(
        CreditTransaction.session_id == session_id,
        CreditTransaction.type == CreditTransactionType.CHARGE
    ).scalar() or Decimal("0.0")

    # 4. Save and calculate payment method collections breakdown
    from app.models.log import DailyLogSessionPayment
    db.query(DailyLogSessionPayment).filter(DailyLogSessionPayment.session_id == session_id).delete()
    
    fuel_digital_collected = Decimal("0.0")
    misc_expenditure = Decimal("0.0")
    
    for col in req.fuel_collections:
        if col.amount < 0:
            raise HTTPException(status_code=400, detail=f"Collection amount for {col.payment_method} cannot be negative.")
        col_db = DailyLogSessionPayment(
            session_id=session_id,
            payment_method=col.payment_method,
            amount=col.amount,
            log_date=session.log_date
        )
        db.add(col_db)
        if col.payment_method == "Miscellaneous":
            misc_expenditure += col.amount
        else:
            fuel_digital_collected += col.amount

    # Daily fuel cash is automatically calculated as the remainder of expected revenue
    fuel_cash_collected = expected_revenue - credit_sales_total - fuel_digital_collected

    # 5. Shortage/Overage = actual fuel collected (cash + digital) + credit charges - expected revenue
    # Under auto-calculated cash model, this balances perfectly to 0.0
    shortage_overage = Decimal("0.00")

    # 6. Sum credit payments received today (CASH only vs ACCOUNT_TRANSFER)
    credit_payments_cash = db.query(func.sum(CreditTransaction.amount)).filter(
        CreditTransaction.session_id == session_id,
        CreditTransaction.type == CreditTransactionType.PAYMENT,
        CreditTransaction.payment_method == "CASH"
    ).scalar() or Decimal("0.0")

    credit_payments_digital = db.query(func.sum(CreditTransaction.amount)).filter(
        CreditTransaction.session_id == session_id,
        CreditTransaction.type == CreditTransactionType.PAYMENT,
        CreditTransaction.payment_method == "ACCOUNT_TRANSFER"
    ).scalar() or Decimal("0.0")

    # 7. Compute closing cash balance
    # Closing Cash = Opening Cash + Fuel Cash + Credit Cash Payments + Misc Cash (Other Items Income) - Miscellaneous Expenditure - Total Cash Deposits +/- Prior Period Adjustment
    cash_balance_before = session.opening_cash_balance + fuel_cash_collected + credit_payments_cash + session.misc_cash - misc_expenditure + req.prior_period_adjustment
    
    total_deposited = Decimal("0.0")
    if req.cash_deposits:
        for deposit in req.cash_deposits:
            if deposit.amount < 0:
                raise HTTPException(status_code=400, detail="Cash deposit amounts cannot be negative.")
            if deposit.amount > 0:
                total_deposited += deposit.amount
                
        if total_deposited > cash_balance_before:
            raise HTTPException(
                status_code=400,
                detail=f"Total cash deposited (₹{total_deposited}) cannot exceed the total cash balance available before deposits (₹{cash_balance_before})."
            )
        
    closing_cash = cash_balance_before - total_deposited


    # Update session summary values
    session.status = DailyLogSessionStatus.CLOSED
    session.closed_at = datetime.now(IST)
    session.fuel_cash_collected = fuel_cash_collected
    session.fuel_digital_collected = fuel_digital_collected
    session.credit_sales_total = credit_sales_total
    session.expected_revenue = expected_revenue
    session.shortage_overage = shortage_overage
    session.credit_payments_cash_total = credit_payments_cash
    session.credit_payments_digital_total = credit_payments_digital
    session.closing_cash_balance = closing_cash
    session.prior_period_adjustment = req.prior_period_adjustment
    session.adjustment_notes = req.adjustment_notes

    # Propagate tank updates to the Tank model itself (baseline dip & variance)
    for tl in tank_logs:
        tank = tl.tank
        tank.actual_dip_volume = tl.actual_dip_volume
        tank.variance = tl.calculated_variance

    # Update Station IOCL Account balance with XTRA Power and XTRA Reward collections
    from app.models.credit import PumpAccount, PumpAccountTransaction
    
    # Clear existing ledger transactions of this session before recreating them
    db.query(PumpAccountTransaction).filter(
        PumpAccountTransaction.session_id == session_id
    ).delete()
    
    iocl_inflow = sum(col.amount for col in req.fuel_collections if col.payment_method in ["XTRA Power", "XTRA Reward"])
    if iocl_inflow > 0:
        iocl_account = db.query(PumpAccount).filter(PumpAccount.pump_id == session.pump_id, PumpAccount.name == "IOCL Account").first()
        if not iocl_account:
            iocl_account = PumpAccount(
                pump_id=session.pump_id,
                name="IOCL Account",
                balance=Decimal("0.0"),
                is_constant=True
            )
            db.add(iocl_account)
            db.flush()  # ensure iocl_account.id is available
        iocl_account.balance += iocl_inflow

        # Insert ledger entry
        ledger_entry = PumpAccountTransaction(
            account_id=iocl_account.id,
            session_id=session.id,
            amount=iocl_inflow,
            log_date=session.log_date,
            description="XTRA Power + XTRA Reward collections"
        )
        db.add(ledger_entry)

    # Update Paytm-linked account: today's Paytm 3 + yesterday's Paytm 1 & Paytm 2
    paytm_credited_today = Decimal("0.0")

    paytm_account = db.query(PumpAccount).filter(
        PumpAccount.pump_id == session.pump_id,
        PumpAccount.is_paytm_linked == True
    ).first()

    if paytm_account:
        # Today's Paytm 3
        today_paytm3 = sum(col.amount for col in req.fuel_collections if col.payment_method == "Paytm 3")

        # Yesterday's Paytm 1 & Paytm 2 from closed session
        yesterday = session.log_date - timedelta(days=1)
        yesterday_session = db.query(DailyLogSession).filter(
            DailyLogSession.pump_id == session.pump_id,
            DailyLogSession.log_date == yesterday,
            DailyLogSession.status == DailyLogSessionStatus.CLOSED
        ).first()

        yesterday_paytm1 = Decimal("0.0")
        yesterday_paytm2 = Decimal("0.0")
        if yesterday_session:
            yesterday_paytm1 = db.query(func.sum(DailyLogSessionPayment.amount)).filter(
                DailyLogSessionPayment.session_id == yesterday_session.id,
                DailyLogSessionPayment.payment_method == "Paytm 1"
            ).scalar() or Decimal("0.0")
            yesterday_paytm2 = db.query(func.sum(DailyLogSessionPayment.amount)).filter(
                DailyLogSessionPayment.session_id == yesterday_session.id,
                DailyLogSessionPayment.payment_method == "Paytm 2"
            ).scalar() or Decimal("0.0")

        paytm_inflow = today_paytm3 + yesterday_paytm1 + yesterday_paytm2
        if paytm_inflow > 0:
            paytm_account.balance += paytm_inflow
            paytm_ledger = PumpAccountTransaction(
                account_id=paytm_account.id,
                session_id=session.id,
                amount=paytm_inflow,
                log_date=session.log_date,
                description="Paytm collections (Paytm 3 today + Paytm 1 & 2 yesterday)"
            )
            db.add(paytm_ledger)
            paytm_credited_today = paytm_inflow
    # Process cash deposits if any
    if req.cash_deposits:
        for deposit in req.cash_deposits:
            if deposit.amount > 0:
                custom_acc = db.query(PumpAccount).filter(
                    PumpAccount.id == deposit.account_id,
                    PumpAccount.pump_id == session.pump_id,
                    PumpAccount.name != "IOCL Account"
                ).first()
                if custom_acc:
                    custom_acc.balance += deposit.amount
                    deposit_ledger = PumpAccountTransaction(
                        account_id=custom_acc.id,
                        session_id=session.id,
                        amount=deposit.amount,
                        log_date=session.log_date,
                        description="Cash deposited from station cash balance"
                    )
                    db.add(deposit_ledger)

    # --- Price Change Gain/Loss Calculation ---
    from app.models.price_change import PriceChangeGainLoss
    # Clear any existing price change records for this session (idempotent)
    db.query(PriceChangeGainLoss).filter(PriceChangeGainLoss.session_id == session_id).delete()

    price_change_total = Decimal("0.0")
    today_start = datetime.combine(session.log_date, time.min).replace(tzinfo=IST)
    today_end = datetime.combine(session.log_date, time.max).replace(tzinfo=IST)

    pump = session.pump
    for product in pump.products:
        # Check if this product had a price change today
        closed_today = db.query(ProductPriceHistory).filter(
            ProductPriceHistory.product_id == product.id,
            ProductPriceHistory.valid_to >= today_start,
            ProductPriceHistory.valid_to <= today_end
        ).order_by(ProductPriceHistory.valid_from.asc()).all()

        if not closed_today:
            continue

        old_price = closed_today[0].selling_price  # earliest old price
        new_price = product.current_price  # latest (current) price

        if old_price == new_price:
            continue

        # Find all tanks for this product at this pump
        product_tanks = [t for t in pump.tanks if t.product_id == product.id]
        for tank in product_tanks:
            # Get opening dip volume for this tank (from prefill / previous day)
            prev_tank_log = db.query(DailyTankLog).filter(
                DailyTankLog.tank_id == tank.id,
                DailyTankLog.log_date < session.log_date
            ).order_by(DailyTankLog.log_date.desc()).first()
            opening_dip = prev_tank_log.actual_dip_volume if prev_tank_log else tank.actual_dip_volume

            # Sum fuel sold at old price from all nozzles connected to this tank (entry_index = 0)
            tank_nozzle_ids = [n.id for n in tank.nozzles if n.is_active]
            fuel_sold_old = Decimal("0.0")
            if tank_nozzle_ids:
                result = db.query(func.sum(DailyNozzleLog.gross_liters_sold)).filter(
                    DailyNozzleLog.session_id == session_id,
                    DailyNozzleLog.nozzle_id.in_(tank_nozzle_ids),
                    DailyNozzleLog.entry_index == 0
                ).scalar()
                fuel_sold_old = result or Decimal("0.0")

            stock_at_change = opening_dip - fuel_sold_old
            gain_loss = (new_price - old_price) * stock_at_change

            pc_record = PriceChangeGainLoss(
                session_id=session_id,
                product_id=product.id,
                tank_id=tank.id,
                old_price=old_price,
                new_price=new_price,
                opening_dip_volume=opening_dip,
                fuel_sold_at_old_price=fuel_sold_old,
                stock_at_change=stock_at_change,
                gain_loss_amount=gain_loss,
                log_date=session.log_date
            )
            db.add(pc_record)
            price_change_total += gain_loss

    session.price_change_gain_loss_total = price_change_total if price_change_total != Decimal("0.0") else None

    db.commit()
    
    return {
        "status": "success",
        "calculations": {
            "expected_revenue": expected_revenue,
            "credit_sales_total": credit_sales_total,
            "shortage_overage": shortage_overage,
            "opening_cash_balance": session.opening_cash_balance,
            "closing_cash_balance": closing_cash,
            "paytm_credited_today": paytm_credited_today,
            "price_change_gain_loss": price_change_total if price_change_total != Decimal("0.0") else None
        }
    }

@router.get("/log-status")
def get_bulk_log_status(date_str: Optional[str] = None, db: Session = Depends(get_db)):
    """Returns today's (or given date's) log status for all active pumps."""
    if date_str:
        try:
            log_date = date.fromisoformat(date_str)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format")
    else:
        log_date = datetime.now(IST).date()

    active_pumps = db.query(FuelPump).filter(FuelPump.is_active == True).all()
    pumps_status = {}

    for pump in active_pumps:
        session = db.query(DailyLogSession).filter(
            DailyLogSession.pump_id == pump.id,
            DailyLogSession.log_date == log_date
        ).first()
        pumps_status[pump.id] = session.status if session else "NOT_LOGGED"

    return pumps_status

# --- Legacy Wrapper ---

@router.post("/submit/{pump_id}", status_code=status.HTTP_201_CREATED)
def submit_shift_log_legacy(pump_id: int, req: ShiftSubmitRequest, db: Session = Depends(get_db)):
    """Legacy wrapper: wraps new daily log session API rules inside a single atomic submit."""
    pump = db.query(FuelPump).filter(FuelPump.id == pump_id, FuelPump.is_active == True).first()
    if not pump:
        raise HTTPException(status_code=404, detail="Active fuel pump not found")

    # Check if a session already exists for this date
    existing_session = db.query(DailyLogSession).filter(
        DailyLogSession.pump_id == pump_id,
        DailyLogSession.log_date == req.log_date
    ).first()
    if existing_session and existing_session.status == DailyLogSessionStatus.CLOSED:
        raise HTTPException(status_code=400, detail=f"A closed shift log session already exists for {req.log_date}.")

    # 1. Fetch or create log session
    if not existing_session:
        # Get opening cash balance
        last_session = db.query(DailyLogSession).filter(
            DailyLogSession.pump_id == pump_id,
            DailyLogSession.log_date < req.log_date
        ).order_by(DailyLogSession.log_date.desc()).first()
        opening_cash = last_session.closing_cash_balance if (last_session and last_session.closing_cash_balance is not None) else (last_session.opening_cash_balance if last_session else pump.opening_cash_balance)
        
        is_first = db.query(DailyLogSession).filter(DailyLogSession.pump_id == pump_id).first() is None
        session = DailyLogSession(
            pump_id=pump_id,
            log_date=req.log_date,
            status=DailyLogSessionStatus.OPEN,
            opened_at=req.log_timestamp,
            opening_cash_balance=opening_cash,
            is_initialization=is_first,
            misc_cash=Decimal("0.0"),
            misc_digital=Decimal("0.0")
        )
        db.add(session)
        db.flush()
    else:
        session = existing_session

    session_id = session.id

    # 2. Save nozzle logs
    readings_save_payload = []
    # Group by nozzle_id (in case of multiple entries in legacy request)
    nozzle_payload_map = {}
    for nl in req.nozzle_logs:
        # Active price valid at log_timestamp
        price, _ = get_historical_price_and_margin(db, db.query(Nozzle).filter(Nozzle.id == nl.nozzle_id).first().tank.product_id, req.log_timestamp)
        entry = NozzleReadingEntry(
            closing_reading=nl.closing_reading,
            product_price=price,
            is_reset=nl.is_reset
        )
        if nl.nozzle_id not in nozzle_payload_map:
            nozzle_payload_map[nl.nozzle_id] = []
        nozzle_payload_map[nl.nozzle_id].append(entry)

    for nozzle_id, entries in nozzle_payload_map.items():
        readings_save_payload.append(NozzleReadingsSave(nozzle_id=nozzle_id, entries=entries))

    save_nozzle_readings(session_id, readings_save_payload, db)

    # 3. Save tank logs
    tank_save_payload = []
    for tl in req.tank_logs:
        tank_save_payload.append(TankReadingsSave(
            tank_id=tl.tank_id,
            testing_liters=tl.testing_liters,
            fuel_received=tl.fuel_received,
            actual_dip_volume=tl.actual_dip_volume
        ))
    save_tank_readings(session_id, tank_save_payload, db)

    # 4. Save credit charges
    # Clear existing credit charges linked to this session
    db.query(CreditTransaction).filter(
        CreditTransaction.session_id == session_id,
        CreditTransaction.type == CreditTransactionType.CHARGE
    ).delete()

    for cs in req.credit_sales:
        add_session_credit_charge(session_id, CreditChargeCreate(
            account_id=cs.account_id,
            amount=cs.amount,
            notes=cs.notes or f"Legacy API submission credit sale"
        ), db)

    # 5. Close session
    legacy_collections = [
        SessionCollectionInput(payment_method="Cash", amount=req.cash_collected),
        SessionCollectionInput(payment_method="Miscellaneous", amount=req.digital_collected)
    ]
    res = close_session(session_id, CloseSessionRequest(
        fuel_collections=legacy_collections
    ), db)

    return {
        "status": "success",
        "message": "Shift logs submitted and validated successfully.",
        "calculations": res["calculations"]
    }
