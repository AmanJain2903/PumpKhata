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
