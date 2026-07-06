from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional, List
from decimal import Decimal
from datetime import date, datetime
from app.schemas.timezone_helper import localize_datetime
from app.schemas.credit import CreditTransactionResponse, PumpAccountTransactionResponse

# --- Daily Nozzle Log Schemas ---
class DailyNozzleLogBase(BaseModel):
    session_id: int
    nozzle_id: int
    entry_index: int = 0
    product_price: Decimal
    log_date: date
    log_timestamp: datetime
    opening_reading: Decimal
    closing_reading: Decimal
    is_reset: bool = False
    gross_liters_sold: Decimal

    @field_validator("log_timestamp", mode="after", check_fields=False)
    @classmethod
    def validate_timezone(cls, v):
        if v is not None:
            return localize_datetime(v)
        return v

class DailyNozzleLogCreate(DailyNozzleLogBase):
    pass

class DailyNozzleLogUpdate(BaseModel):
    session_id: Optional[int] = None
    nozzle_id: Optional[int] = None
    entry_index: Optional[int] = None
    product_price: Optional[Decimal] = None
    log_date: Optional[date] = None
    log_timestamp: Optional[datetime] = None
    opening_reading: Optional[Decimal] = None
    closing_reading: Optional[Decimal] = None
    is_reset: Optional[bool] = None
    gross_liters_sold: Optional[Decimal] = None

    @field_validator("log_timestamp", mode="after", check_fields=False)
    @classmethod
    def validate_timezone(cls, v):
        if v is not None:
            return localize_datetime(v)
        return v

class DailyNozzleLogResponse(DailyNozzleLogBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# --- Daily Tank Log Schemas ---
class DailyTankLogBase(BaseModel):
    session_id: int
    tank_id: int
    log_date: date
    log_timestamp: datetime
    testing_liters: Decimal
    fuel_received: Decimal
    actual_dip_volume: Decimal
    calculated_variance: Decimal

    @field_validator("log_timestamp", mode="after", check_fields=False)
    @classmethod
    def validate_timezone(cls, v):
        if v is not None:
            return localize_datetime(v)
        return v

class DailyTankLogCreate(DailyTankLogBase):
    pass

class DailyTankLogUpdate(BaseModel):
    session_id: Optional[int] = None
    tank_id: Optional[int] = None
    log_date: Optional[date] = None
    log_timestamp: Optional[datetime] = None
    testing_liters: Optional[Decimal] = None
    fuel_received: Optional[Decimal] = None
    actual_dip_volume: Optional[Decimal] = None
    calculated_variance: Optional[Decimal] = None

    @field_validator("log_timestamp", mode="after", check_fields=False)
    @classmethod
    def validate_timezone(cls, v):
        if v is not None:
            return localize_datetime(v)
        return v

class DailyTankLogResponse(DailyTankLogBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# --- Daily Financial Log Schemas (Legacy/Deprecated) ---
class DailyFinancialLogBase(BaseModel):
    pump_id: int
    log_date: date
    log_timestamp: datetime
    opening_cash_balance: Decimal
    expected_revenue: Decimal
    cash_collected: Decimal
    digital_collected: Decimal
    credit_sales_logged: Decimal
    closing_cash_balance: Decimal
    shortage_overage: Decimal

    @field_validator("log_timestamp", mode="after", check_fields=False)
    @classmethod
    def validate_timezone(cls, v):
        if v is not None:
            return localize_datetime(v)
        return v

class DailyFinancialLogCreate(DailyFinancialLogBase):
    pass

class DailyFinancialLogUpdate(BaseModel):
    pump_id: Optional[int] = None
    log_date: Optional[date] = None
    log_timestamp: Optional[datetime] = None
    opening_cash_balance: Optional[Decimal] = None
    expected_revenue: Optional[Decimal] = None
    cash_collected: Optional[Decimal] = None
    digital_collected: Optional[Decimal] = None
    credit_sales_logged: Optional[Decimal] = None
    closing_cash_balance: Optional[Decimal] = None
    shortage_overage: Optional[Decimal] = None

    @field_validator("log_timestamp", mode="after", check_fields=False)
    @classmethod
    def validate_timezone(cls, v):
        if v is not None:
            return localize_datetime(v)
        return v

class DailyFinancialLogResponse(DailyFinancialLogBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# --- Daily Log Session Schemas ---
class DailyLogSessionBase(BaseModel):
    pump_id: int
    log_date: date
    status: str
    opened_at: datetime
    closed_at: Optional[datetime] = None
    opening_cash_balance: Decimal
    fuel_cash_collected: Optional[Decimal] = None
    fuel_digital_collected: Optional[Decimal] = None
    credit_sales_total: Optional[Decimal] = None
    expected_revenue: Optional[Decimal] = None
    shortage_overage: Optional[Decimal] = None
    credit_payments_cash_total: Optional[Decimal] = None
    credit_payments_digital_total: Optional[Decimal] = None
    misc_cash: Decimal = Decimal("0.0")
    misc_digital: Decimal = Decimal("0.0")
    misc_notes: Optional[str] = None
    closing_cash_balance: Optional[Decimal] = None

    @field_validator("opened_at", "closed_at", mode="after", check_fields=False)
    @classmethod
    def validate_timezone(cls, v):
        if v is not None:
            return localize_datetime(v)
        return v

class DailyLogSessionCreate(BaseModel):
    pump_id: int
    log_date: date
    opened_at: datetime
    opening_cash_balance: Decimal

    @field_validator("opened_at", mode="after", check_fields=False)
    @classmethod
    def validate_timezone(cls, v):
        if v is not None:
            return localize_datetime(v)
        return v

class DailyLogSessionUpdate(BaseModel):
    status: Optional[str] = None
    closed_at: Optional[datetime] = None
    fuel_cash_collected: Optional[Decimal] = None
    fuel_digital_collected: Optional[Decimal] = None
    credit_sales_total: Optional[Decimal] = None
    expected_revenue: Optional[Decimal] = None
    shortage_overage: Optional[Decimal] = None
    credit_payments_cash_total: Optional[Decimal] = None
    credit_payments_digital_total: Optional[Decimal] = None
    misc_cash: Optional[Decimal] = None
    misc_digital: Optional[Decimal] = None
    misc_notes: Optional[str] = None
    closing_cash_balance: Optional[Decimal] = None

    @field_validator("closed_at", mode="after", check_fields=False)
    @classmethod
    def validate_timezone(cls, v):
        if v is not None:
            return localize_datetime(v)
        return v

class DailyLogSessionResponse(DailyLogSessionBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

# --- Daily Log Session Payment Schemas ---
class DailyLogSessionPaymentBase(BaseModel):
    session_id: int
    payment_method: str
    amount: Decimal

class DailyLogSessionPaymentResponse(DailyLogSessionPaymentBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

class DailyLogSessionDetailResponse(DailyLogSessionResponse):
    nozzle_logs: List[DailyNozzleLogResponse] = []
    tank_logs: List[DailyTankLogResponse] = []
    credit_transactions: List[CreditTransactionResponse] = []
    collections: List[DailyLogSessionPaymentResponse] = []
    account_transactions: List[PumpAccountTransactionResponse] = []


