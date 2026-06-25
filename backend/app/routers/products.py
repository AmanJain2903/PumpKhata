from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from decimal import Decimal
from pydantic import BaseModel

from app.database import get_db
from app.models.product import Product, ProductPriceHistory
from app.models.fuel_pump import FuelPump
from app.schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    ProductPriceHistoryResponse,
)

IST = ZoneInfo("Asia/Kolkata")

router = APIRouter(prefix="/products", tags=["Products"])

class PriceUpdateRequest(BaseModel):
    selling_price: Decimal
    cost_margin: Decimal

@router.get("", response_model=List[ProductResponse])
def list_products(db: Session = Depends(get_db)):
    """List all products."""
    return db.query(Product).all()

@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    """Create a new product and seed its initial price/margin history."""
    # Look up linked pumps
    pumps = db.query(FuelPump).filter(FuelPump.id.in_(product.pump_ids), FuelPump.is_active == True).all()
    if len(pumps) != len(product.pump_ids):
        raise HTTPException(
            status_code=400,
            detail="One or more specified fuel pump IDs are invalid or inactive."
        )

    db_product = Product(
        name=product.name,
        current_price=product.current_price,
        current_margin=product.current_margin,
        pumps=pumps
    )
    db.add(db_product)
    db.flush()  # to get db_product.id

    # Create initial price history entry
    now = datetime.now(IST)
    history_entry = ProductPriceHistory(
        product_id=db_product.id,
        selling_price=db_product.current_price,
        cost_margin=db_product.current_margin,
        valid_from=now,
        valid_to=None
    )
    db.add(history_entry)
    db.commit()
    db.refresh(db_product)
    return db_product

@router.get("/{product_id}", response_model=ProductResponse)
def get_product(product_id: int, db: Session = Depends(get_db)):
    """Get details of a specific product."""
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    return db_product

@router.put("/{product_id}", response_model=ProductResponse)
def update_product(product_id: int, product_update: ProductUpdate, db: Session = Depends(get_db)):
    """Update a product's name or pump associations (pricing is updated via /price endpoint)."""
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")

    update_data = product_update.model_dump(exclude_unset=True)
    if "pump_ids" in update_data:
        pump_ids = update_data.pop("pump_ids")
        pumps = db.query(FuelPump).filter(FuelPump.id.in_(pump_ids), FuelPump.is_active == True).all()
        if len(pumps) != len(pump_ids):
            raise HTTPException(
                status_code=400,
                detail="One or more specified fuel pump IDs are invalid or inactive."
            )
        db_product.pumps = pumps

    for key, value in update_data.items():
        setattr(db_product, key, value)

    db.commit()
    db.refresh(db_product)
    return db_product

@router.put("/{product_id}/price", response_model=ProductResponse)
def update_product_price(product_id: int, req: PriceUpdateRequest, db: Session = Depends(get_db)):
    """Update dynamic selling price & cost margin, writing to price history."""
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")

    now = datetime.now(IST)

    # 1. Update existing active history record(s) valid_to
    active_history = db.query(ProductPriceHistory).filter(
        ProductPriceHistory.product_id == product_id,
        ProductPriceHistory.valid_to == None
    ).all()
    for hist in active_history:
        hist.valid_to = now

    # 2. Create new history record
    new_history = ProductPriceHistory(
        product_id=product_id,
        selling_price=req.selling_price,
        cost_margin=req.cost_margin,
        valid_from=now,
        valid_to=None
    )
    db.add(new_history)

    # 3. Update current price/margin in product table
    db_product.current_price = req.selling_price
    db_product.current_margin = req.cost_margin

    db.commit()
    db.refresh(db_product)
    return db_product

@router.get("/{product_id}/price-history", response_model=List[ProductPriceHistoryResponse])
def get_product_price_history(product_id: int, db: Session = Depends(get_db)):
    """Get the full pricing/margin history of a product."""
    # Verify product exists
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")

    return db.query(ProductPriceHistory).filter(
        ProductPriceHistory.product_id == product_id
    ).order_by(ProductPriceHistory.valid_from.desc()).all()
