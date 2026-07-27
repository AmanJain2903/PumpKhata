from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import threading
import time
from contextlib import asynccontextmanager
from zoneinfo import ZoneInfo
from datetime import datetime

from app.database import SessionLocal
from app.routers import pumps, products, tanks, machines, credit, operations, reports

IST = ZoneInfo("Asia/Kolkata")


# Load environment configurations if any
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app = FastAPI(
    title="PumpKhata API",
    description="Fuel Pump Station Management Enterprise Ledger API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
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
