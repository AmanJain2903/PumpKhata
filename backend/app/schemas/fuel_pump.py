from pydantic import BaseModel, ConfigDict
from typing import Optional

class FuelPumpBase(BaseModel):
    name: str
    location: Optional[str] = None
    is_active: bool = True

class FuelPumpCreate(FuelPumpBase):
    pass

class FuelPumpUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    is_active: Optional[bool] = None

class FuelPumpResponse(FuelPumpBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

from typing import List, Union
from decimal import Decimal

class TankUpdateConfig(BaseModel):
    id: Optional[int] = None
    temp_id: Optional[str] = None
    name: str
    product_id: int
    max_capacity: Decimal
    actual_dip_volume: Decimal
    variance: Decimal

class NozzleUpdateConfig(BaseModel):
    id: Optional[int] = None
    name: str
    tank_id: Union[int, str]
    opening_reading: Optional[Decimal] = Decimal('0.00')
    is_active: bool = True

class MachineUpdateConfig(BaseModel):
    id: Optional[int] = None
    temp_id: Optional[str] = None
    name: str
    is_active: bool = True
    nozzles: List[NozzleUpdateConfig]

class PumpConfigUpdateRequest(BaseModel):
    tanks: List[TankUpdateConfig]
    machines: List[MachineUpdateConfig]
