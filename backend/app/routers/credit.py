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

    db_tx = CreditTransaction(
        account_id=account_id,
        log_date=tx.log_date,
        log_timestamp=tx.log_timestamp,
        type=tx.type,
        amount=tx.amount,
        notes=tx.notes
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
