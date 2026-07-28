from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.models.log import DailyLogSession, DailyLogSessionStatus
from app.models.fuel_pump import FuelPump
from app.schemas.report import ReportGenerateRequest
from app.services.pdf_generator import generate_report_zip
from app.core.security import get_current_user
from app.models.user import User
from fastapi.responses import StreamingResponse
import io

router = APIRouter(prefix="/reports", tags=["Reports & BI"])

class ReportBoundariesResponse(BaseModel):
    min_date: Optional[date] = None
    max_date: Optional[date] = None

@router.get("/boundaries/{pump_id}", response_model=ReportBoundariesResponse)
def get_report_boundaries(pump_id: int, db: Session = Depends(get_db)):
    """
    Get the valid date range for generating reports for a specific pump.
    - min_date: The earliest non-initialization log date.
    - max_date: The latest closed log date.
    """
    
    # Get the earliest non-initialization log date
    earliest_log = db.query(DailyLogSession).filter(
        DailyLogSession.pump_id == pump_id,
        DailyLogSession.is_initialization == False,
        DailyLogSession.status == DailyLogSessionStatus.CLOSED
    ).order_by(DailyLogSession.log_date.asc()).first()
    
    # Get the latest closed log date
    latest_closed_log = db.query(DailyLogSession).filter(
        DailyLogSession.pump_id == pump_id,
        DailyLogSession.is_initialization == False,
        DailyLogSession.status == DailyLogSessionStatus.CLOSED
    ).order_by(DailyLogSession.log_date.desc()).first()
    
    return ReportBoundariesResponse(
        min_date=earliest_log.log_date if earliest_log else None,
        max_date=latest_closed_log.log_date if latest_closed_log else None
    )

@router.post("/generate/{pump_id}")
def generate_reports(
    pump_id: int, 
    request: ReportGenerateRequest, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Fetch sessions
    sessions = db.query(DailyLogSession).filter(
        DailyLogSession.pump_id == pump_id,
        DailyLogSession.log_date >= request.start_date,
        DailyLogSession.log_date <= request.end_date,
        DailyLogSession.status == DailyLogSessionStatus.CLOSED,
        DailyLogSession.is_initialization == False
    ).order_by(DailyLogSession.log_date.asc()).all()

    if not sessions:
        raise HTTPException(status_code=404, detail="No closed sessions found for this date range.")

    pump = db.query(FuelPump).filter(FuelPump.id == pump_id).first()
    if not pump:
        raise HTTPException(status_code=404, detail="Pump not found.")

    # 2. Extract expenditures map
    exps = {
        'bank': request.bank_expenditure,
        'iocl': request.iocl_expenditure,
        'salary': request.salary_expenditure,
        'misc': request.misc_expenditure
    }

    # 3. Generate ZIP buffer
    user_name = f"{current_user.first_name} {current_user.last_name}".strip() if current_user else "System"
    
    zip_bytes = generate_report_zip(
        pump=pump,
        sessions=sessions,
        margins=request.margins,
        exps=exps,
        start_date=request.start_date,
        end_date=request.end_date,
        generated_by=user_name
    )

    # 4. Return as StreamingResponse
    return StreamingResponse(
        io.BytesIO(zip_bytes),
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename=PumpKhata_Reports_{request.start_date}_to_{request.end_date}.zip"
        }
    )
