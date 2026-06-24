from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional
from decimal import Decimal
from datetime import date, datetime
from app.schemas.timezone_helper import localize_datetime

# --- Daily Nozzle Log Schemas ---
class DailyNozzleLogBase(BaseModel):
    nozzle_id: int
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
    nozzle_id: Optional[int] = None
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


# --- Daily Financial Log Schemas ---
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
