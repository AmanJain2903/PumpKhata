from pydantic import BaseModel, ConfigDict
from typing import Optional
from decimal import Decimal
from datetime import date

# --- Nozzle Initialize Schema ---
class NozzleInitialize(BaseModel):
    opening_reading: Decimal
    log_date: Optional[date] = None

# --- Nozzle Schemas ---
class NozzleBase(BaseModel):
    machine_id: int
    tank_id: int
    name: str
    is_active: bool = True

class NozzleCreate(NozzleBase):
    pass

class NozzleUpdate(BaseModel):
    machine_id: Optional[int] = None
    tank_id: Optional[int] = None
    name: Optional[str] = None
    is_active: Optional[bool] = None

class NozzleResponse(NozzleBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# --- Machine Schemas ---
class MachineBase(BaseModel):
    pump_id: int
    name: str
    number_of_nozzles: int
    is_active: bool = True

class MachineCreate(MachineBase):
    pass

class MachineUpdate(BaseModel):
    pump_id: Optional[int] = None
    name: Optional[str] = None
    number_of_nozzles: Optional[int] = None
    is_active: Optional[bool] = None

class MachineResponse(MachineBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
