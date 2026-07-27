from pydantic import BaseModel, Field
from typing import Dict
from datetime import date
from decimal import Decimal

class ReportGenerateRequest(BaseModel):
    start_date: date
    end_date: date
    margins: Dict[int, Decimal] = Field(..., description="Mapping of product_id to margin")
    bank_expenditure: Decimal = Decimal('0')
    iocl_expenditure: Decimal = Decimal('0')
    salary_expenditure: Decimal = Decimal('0')
    misc_expenditure: Decimal = Decimal('0')
