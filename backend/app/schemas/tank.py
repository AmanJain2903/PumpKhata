from pydantic import BaseModel, ConfigDict
from typing import Optional
from decimal import Decimal

class TankBase(BaseModel):
    pump_id: int
    product_id: int
    name: str
    max_capacity: Decimal
    actual_dip_volume: Decimal
    variance: Decimal

class TankCreate(TankBase):
    pass

class TankUpdate(BaseModel):
    pump_id: Optional[int] = None
    product_id: Optional[int] = None
    name: Optional[str] = None
    max_capacity: Optional[Decimal] = None
    actual_dip_volume: Optional[Decimal] = None
    variance: Optional[Decimal] = None

class TankResponse(TankBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
