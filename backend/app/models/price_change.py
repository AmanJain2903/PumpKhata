from sqlalchemy import Column, Integer, BigInteger, Numeric, Date, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.models.base import Base


class PriceChangeGainLoss(Base):
    __tablename__ = "price_change_gain_loss"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    session_id = Column(BigInteger, ForeignKey("daily_log_sessions.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    tank_id = Column(Integer, ForeignKey("tanks.id"), nullable=False)
    old_price = Column(Numeric(10, 2), nullable=False)
    new_price = Column(Numeric(10, 2), nullable=False)
    opening_dip_volume = Column(Numeric(12, 2), nullable=False)
    fuel_sold_at_old_price = Column(Numeric(12, 2), nullable=False)
    stock_at_change = Column(Numeric(12, 2), nullable=False)
    gain_loss_amount = Column(Numeric(12, 2), nullable=False)
    log_date = Column(Date, nullable=False)

    __table_args__ = (
        UniqueConstraint("session_id", "tank_id", name="uq_session_tank_price_change"),
    )

    # Relationships
    session = relationship("DailyLogSession", back_populates="price_change_records")
    product = relationship("Product")
    tank = relationship("Tank")
