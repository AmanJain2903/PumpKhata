from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from app.database import get_db
from app.models.credit import CreditAccount, CreditTransaction, CreditTransactionType
from app.models.fuel_pump import FuelPump
from app.schemas.credit import (
    CreditAccountCreate,
    CreditAccountUpdate,
    CreditAccountResponse,
    CreditTransactionCreate,
    CreditTransactionResponse,
)

IST = ZoneInfo("Asia/Kolkata")

router = APIRouter(prefix="/credit", tags=["Credit Accounts & B2B Ledger"])

@router.get("/accounts", response_model=List[CreditAccountResponse])
def list_accounts(pump_id: Optional[int] = None, db: Session = Depends(get_db)):
    """List all credit accounts, filterable by pump_id."""
    query = db.query(CreditAccount)
    if pump_id is not None:
        query = query.filter(CreditAccount.pump_id == pump_id)
    return query.all()

@router.post("/accounts", response_model=CreditAccountResponse, status_code=status.HTTP_201_CREATED)
def create_account(account: CreditAccountCreate, db: Session = Depends(get_db)):
    """Create a new B2B client credit account."""
    pump = db.query(FuelPump).filter(FuelPump.id == account.pump_id, FuelPump.is_active == True).first()
    if not pump:
        raise HTTPException(status_code=400, detail="Specified Fuel Pump not found or inactive")

    # Check if unique name exists
    existing = db.query(CreditAccount).filter(CreditAccount.account_name == account.account_name).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this name already exists")

    db_account = CreditAccount(
        pump_id=account.pump_id,
        account_name=account.account_name,
        current_outstanding_balance=account.current_outstanding_balance
    )
    db.add(db_account)
    db.commit()
    db.refresh(db_account)
    return db_account

@router.get("/accounts/{account_id}", response_model=CreditAccountResponse)
def get_account(account_id: int, db: Session = Depends(get_db)):
    """Get details of a specific credit account."""
    account = db.query(CreditAccount).filter(CreditAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Credit account not found")
    return account

@router.put("/accounts/{account_id}", response_model=CreditAccountResponse)
def update_account(account_id: int, account_update: CreditAccountUpdate, db: Session = Depends(get_db)):
    """Update details of an existing credit account."""
    account = db.query(CreditAccount).filter(CreditAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Credit account not found")

    update_data = account_update.model_dump(exclude_unset=True)
    if "pump_id" in update_data:
        pump = db.query(FuelPump).filter(FuelPump.id == update_data["pump_id"], FuelPump.is_active == True).first()
        if not pump:
            raise HTTPException(status_code=400, detail="Specified Fuel Pump not found or inactive")

    for key, value in update_data.items():
        setattr(account, key, value)

    db.commit()
    db.refresh(account)
    return account

@router.delete("/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(account_id: int, db: Session = Depends(get_db)):
    """Delete a credit account (restricted to accounts with zero outstanding balance)."""
    account = db.query(CreditAccount).filter(CreditAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Credit account not found")

    if account.current_outstanding_balance != 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete account with a non-zero outstanding balance."
        )

    db.delete(account)
    db.commit()
    return

# --- Transaction Routes ---

@router.get("/accounts/{account_id}/transactions", response_model=List[CreditTransactionResponse])
def get_account_transactions(account_id: int, db: Session = Depends(get_db)):
    """List transaction history of a specific credit account ordered by date/timestamp."""
    # Verify account exists
    account = db.query(CreditAccount).filter(CreditAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Credit account not found")

    return db.query(CreditTransaction).filter(
        CreditTransaction.account_id == account_id
    ).order_by(CreditTransaction.log_timestamp.desc()).all()

@router.post("/accounts/{account_id}/transactions", response_model=CreditTransactionResponse, status_code=status.HTTP_201_CREATED)
def record_transaction(
    account_id: int,
    tx: CreditTransactionCreate,
    db: Session = Depends(get_db)
):
    """Record a credit transaction (CHARGE or PAYMENT) manually, updating outstanding balance."""
    account = db.query(CreditAccount).filter(CreditAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Credit account not found")

    # Double check that account matches payload if specified
    if tx.account_id != account_id:
        raise HTTPException(status_code=400, detail="Account ID mismatch in payload")

    from datetime import datetime
    from zoneinfo import ZoneInfo
    from decimal import Decimal
    from app.models.log import DailyLogSession, DailyLogSessionStatus, DailyFinancialLog
    from app.models.fuel_pump import FuelPump

    IST = ZoneInfo("Asia/Kolkata")
    log_date = tx.log_date or datetime.now(IST).date()
    log_timestamp = tx.log_timestamp or datetime.now(IST)

    # 1. Fetch or create today's daily log session
    session = db.query(DailyLogSession).filter(
        DailyLogSession.pump_id == account.pump_id,
        DailyLogSession.log_date == log_date
    ).first()

    if session:
        if session.status == DailyLogSessionStatus.CLOSED:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot add transaction because the session for {log_date} is already closed. Please reopen it first."
            )
    else:
        # Get pump details
        pump = db.query(FuelPump).filter(FuelPump.id == account.pump_id, FuelPump.is_active == True).first()
        if not pump:
            raise HTTPException(status_code=404, detail="Active fuel pump not found for this account")

        # Get opening cash balance from last created session
        last_session = db.query(DailyLogSession).filter(
            DailyLogSession.pump_id == account.pump_id,
            DailyLogSession.log_date < log_date
        ).order_by(DailyLogSession.log_date.desc()).first()

        if last_session:
            opening_cash = last_session.closing_cash_balance if last_session.closing_cash_balance is not None else last_session.opening_cash_balance
        else:
            prev_fin_log = db.query(DailyFinancialLog).filter(
                DailyFinancialLog.pump_id == account.pump_id,
                DailyFinancialLog.log_date < log_date
            ).order_by(DailyFinancialLog.log_date.desc()).first()
            opening_cash = prev_fin_log.closing_cash_balance if prev_fin_log else pump.opening_cash_balance

        # Create session
        is_first = db.query(DailyLogSession).filter(DailyLogSession.pump_id == account.pump_id).first() is None
        session = DailyLogSession(
            pump_id=account.pump_id,
            log_date=log_date,
            status=DailyLogSessionStatus.OPEN,
            opened_at=datetime.now(IST),
            opening_cash_balance=opening_cash,
            is_initialization=is_first,
            misc_cash=Decimal("0.0"),
            misc_digital=Decimal("0.0")
        )
        db.add(session)
        db.flush() # ensure session.id is populated

    db_tx = CreditTransaction(
        account_id=account_id,
        session_id=session.id,
        log_date=log_date,
        log_timestamp=log_timestamp,
        type=tx.type,
        amount=tx.amount,
        notes=tx.notes,
        payment_method=tx.payment_method or ("CASH" if tx.type == CreditTransactionType.PAYMENT else None)
    )
    db.add(db_tx)

    # Update balance
    if tx.type == CreditTransactionType.CHARGE:
        account.current_outstanding_balance += tx.amount
    elif tx.type == CreditTransactionType.PAYMENT:
        account.current_outstanding_balance -= tx.amount

    db.commit()
    db.refresh(db_tx)
    return db_tx
