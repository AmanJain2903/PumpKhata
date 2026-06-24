from sqlalchemy import Column, Integer, BigInteger, String, Numeric, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from app.models.base import Base

# Association table for Many-to-Many relationship between Products and FuelPumps
product_pumps = Table(
    "product_pumps",
    Base.metadata,
    Column("product_id", Integer, ForeignKey("products.id", ondelete="CASCADE"), primary_key=True),
    Column("pump_id", Integer, ForeignKey("fuel_pumps.id", ondelete="CASCADE"), primary_key=True)
)

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    current_price = Column(Numeric(10, 2), nullable=False)
    current_margin = Column(Numeric(10, 2), nullable=False)

    # Relationships
    pumps = relationship("FuelPump", secondary=product_pumps, back_populates="products")
    price_history = relationship("ProductPriceHistory", back_populates="product", cascade="all, delete-orphan")
    tanks = relationship("Tank", back_populates="product")

    @property
    def pump_ids(self) -> list[int]:
        return [pump.id for pump in self.pumps]


class ProductPriceHistory(Base):
    __tablename__ = "product_price_history"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    selling_price = Column(Numeric(10, 2), nullable=False)
    valid_from = Column(DateTime(timezone=True), nullable=False)
    valid_to = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    product = relationship("Product", back_populates="price_history")
