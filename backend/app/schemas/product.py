from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional, List
from decimal import Decimal
from datetime import datetime
from app.schemas.timezone_helper import localize_datetime

# --- Product Price History Schemas ---
class ProductPriceHistoryBase(BaseModel):
    product_id: int
    selling_price: Decimal
    valid_from: datetime
    valid_to: Optional[datetime] = None

    @field_validator("valid_from", "valid_to", mode="after", check_fields=False)
    @classmethod
    def validate_timezone(cls, v):
        if v is not None:
            return localize_datetime(v)
        return v

class ProductPriceHistoryCreate(ProductPriceHistoryBase):
    pass

class ProductPriceHistoryUpdate(BaseModel):
    selling_price: Optional[Decimal] = None
    valid_from: Optional[datetime] = None
    valid_to: Optional[datetime] = None

    @field_validator("valid_from", "valid_to", mode="after", check_fields=False)
    @classmethod
    def validate_timezone(cls, v):
        if v is not None:
            return localize_datetime(v)
        return v

class ProductPriceHistoryResponse(ProductPriceHistoryBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# --- Product Schemas ---
class ProductBase(BaseModel):
    name: str
    current_price: Decimal
    current_margin: Decimal
    pump_ids: List[int]

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    current_price: Optional[Decimal] = None
    current_margin: Optional[Decimal] = None
    pump_ids: Optional[List[int]] = None

class ProductResponse(ProductBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

