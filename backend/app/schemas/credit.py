from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional
from decimal import Decimal
from datetime import date, datetime
from app.models.credit import CreditTransactionType
from app.schemas.timezone_helper import localize_datetime

# --- Credit Transaction Schemas ---
class CreditTransactionBase(BaseModel):
    account_id: int
    session_id: Optional[int] = None
    log_date: date
    log_timestamp: datetime
    type: CreditTransactionType
    amount: Decimal
    notes: Optional[str] = None
    payment_method: Optional[str] = None

    @field_validator("log_timestamp", mode="after", check_fields=False)
    @classmethod
    def validate_timezone(cls, v):
        if v is not None:
            return localize_datetime(v)
        return v

class CreditTransactionCreate(CreditTransactionBase):
    pass

class CreditTransactionUpdate(BaseModel):
    account_id: Optional[int] = None
    session_id: Optional[int] = None
    log_date: Optional[date] = None
    log_timestamp: Optional[datetime] = None
    type: Optional[CreditTransactionType] = None
    amount: Optional[Decimal] = None
    notes: Optional[str] = None
    payment_method: Optional[str] = None

    @field_validator("log_timestamp", mode="after", check_fields=False)
    @classmethod
    def validate_timezone(cls, v):
        if v is not None:
            return localize_datetime(v)
        return v


class CreditTransactionResponse(CreditTransactionBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# --- Credit Account Schemas ---
class CreditAccountBase(BaseModel):
    pump_id: int
    account_name: str
    current_outstanding_balance: Decimal

class CreditAccountCreate(CreditAccountBase):
    pass

class CreditAccountUpdate(BaseModel):
    pump_id: Optional[int] = None
    account_name: Optional[str] = None
    current_outstanding_balance: Optional[Decimal] = None

class CreditAccountResponse(CreditAccountBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# --- Pump Account Schemas ---
class PumpAccountBase(BaseModel):
    pump_id: int
    name: str
    balance: Decimal
    is_constant: bool
    is_paytm_linked: bool

class PumpAccountCreate(BaseModel):
    name: str
    is_paytm_linked: bool = False

class PumpAccountResponse(PumpAccountBase):
    id: int
    current_month_balance: Decimal = Decimal("0.0")
    last_month_balance: Decimal = Decimal("0.0")

    model_config = ConfigDict(from_attributes=True)


class PumpAccountTransactionResponse(BaseModel):
    id: int
    account_id: int
    session_id: Optional[int] = None
    amount: Decimal
    log_date: date
    description: Optional[str] = None
    created_at: datetime

    @field_validator("created_at", mode="after", check_fields=False)
    @classmethod
    def validate_timezone(cls, v):
        if v is not None:
            return localize_datetime(v)
        return v

    model_config = ConfigDict(from_attributes=True)

