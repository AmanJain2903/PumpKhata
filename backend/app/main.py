from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
import os
import threading
import time
from contextlib import asynccontextmanager
from zoneinfo import ZoneInfo
from datetime import datetime

from app.database import SessionLocal
from app.routers import pumps, products, tanks, machines, credit, operations, reports, auth, users
from app.core.security import get_current_user

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

# Public routers
app.include_router(auth.router, prefix="/api")

# Protected routers
protected = [Depends(get_current_user)]
app.include_router(pumps.router, prefix="/api", dependencies=protected)
app.include_router(products.router, prefix="/api", dependencies=protected)
app.include_router(tanks.router, prefix="/api", dependencies=protected)
app.include_router(machines.router, prefix="/api", dependencies=protected)
app.include_router(credit.router, prefix="/api", dependencies=protected)
app.include_router(operations.router, prefix="/api", dependencies=protected)
app.include_router(reports.router, prefix="/api", dependencies=protected)
app.include_router(users.router, prefix="/api", dependencies=protected)

@app.get("/")
def read_root():
    return {
        "status": "healthy",
        "app": "PumpKhata API Gateway",
        "docs": "/docs"
    }
