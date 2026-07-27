from sqlalchemy import Column, Integer, String, DateTime, Enum, Boolean
from datetime import datetime
import enum
from .base import Base

class UserRole(str, enum.Enum):
    admin = "admin"
    super_admin = "super_admin"

class User(Base):
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    role = Column(Enum(UserRole), default=UserRole.admin, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
