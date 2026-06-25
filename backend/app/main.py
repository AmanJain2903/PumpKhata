from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import threading
import time
from contextlib import asynccontextmanager
from zoneinfo import ZoneInfo
from datetime import datetime

from app.database import SessionLocal
from app.routers.reports import generate_and_save_monthly_report
from app.routers import pumps, products, tanks, machines, credit, operations, reports

IST = ZoneInfo("Asia/Kolkata")

# Background scheduler loop running on a daemon thread
def report_scheduler_loop():
    print("[Scheduler] Starting automatic monthly report scheduler...")
    while True:
        try:
            now = datetime.now(IST)
            # On the 1st of the month, we generate the report for the previous month
            if now.day == 1:
                if now.month == 1:
                    prev_month = 12
                    prev_year = now.year - 1
                else:
                    prev_month = now.month - 1
                    prev_year = now.year
                
                # Check if report has already been generated
                dir_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../generated_reports"))
                pdf_filename = f"report_{prev_year}_{prev_month:02d}.pdf"
                pdf_path = os.path.join(dir_path, pdf_filename)
                
                if not os.path.exists(pdf_path):
                    print(f"[Scheduler] Generating monthly report for {prev_year}-{prev_month:02d}...")
                    db = SessionLocal()
                    try:
                        generate_and_save_monthly_report(db, prev_year, prev_month)
                    except Exception as e:
                        print(f"[Scheduler] Error running background report generation: {e}")
                    finally:
                        db.close()
            
            # Sleep for 1 hour before checking again
            time.sleep(3600)
        except Exception as e:
            print(f"[Scheduler] Error in scheduler loop: {e}")
            time.sleep(60)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start the monthly report scheduler thread on startup
    scheduler_thread = threading.Thread(target=report_scheduler_loop, daemon=True)
    scheduler_thread.start()
    yield

# Load environment configurations if any
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app = FastAPI(
    title="PumpKhata API",
    description="Fuel Pump Station Management Enterprise Ledger API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers under /api prefix
app.include_router(pumps.router, prefix="/api")
app.include_router(products.router, prefix="/api")
app.include_router(tanks.router, prefix="/api")
app.include_router(machines.router, prefix="/api")
app.include_router(credit.router, prefix="/api")
app.include_router(operations.router, prefix="/api")
app.include_router(reports.router, prefix="/api")

@app.get("/")
def read_root():
    return {
        "status": "healthy",
        "app": "PumpKhata API Gateway",
        "docs": "/docs"
    }
