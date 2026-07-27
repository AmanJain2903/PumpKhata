from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import List

from app.database import get_db
from app.models.user import User, UserRole
from app.core.security import require_super_admin

router = APIRouter(prefix="/users", tags=["User Management"])

class UserResponse(BaseModel):
    id: int
    email: str
    first_name: str | None
    last_name: str | None
    role: UserRole
    is_active: bool
    
    class Config:
        from_attributes = True

class UserCreate(BaseModel):
    email: EmailStr
    role: UserRole = UserRole.admin

class UserUpdate(BaseModel):
    role: UserRole | None = None
    is_active: bool | None = None

@router.get("", response_model=List[UserResponse])
def get_users(db: Session = Depends(get_db), current_admin: User = Depends(require_super_admin)):
    return db.query(User).all()

@router.post("", response_model=UserResponse)
def create_user(user_in: UserCreate, db: Session = Depends(get_db), current_admin: User = Depends(require_super_admin)):
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")
        
    new_user = User(
        email=user_in.email,
        role=user_in.role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

def _check_super_admin_redundancy(db: Session, target_user: User, action: str):
    if target_user.role == UserRole.super_admin:
        active_super_admins_count = db.query(User).filter(
            User.role == UserRole.super_admin, 
            User.is_active == True,
            User.id != target_user.id
        ).count()
        if active_super_admins_count == 0:
            raise HTTPException(status_code=400, detail=f"Cannot {action} because there must be at least one active super admin remaining in the system.")

@router.patch("/{user_id}", response_model=UserResponse)
def update_user(user_id: int, user_in: UserUpdate, db: Session = Depends(get_db), current_admin: User = Depends(require_super_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user_in.role is not None and user_in.role != user.role:
        if user.role == UserRole.super_admin:
            _check_super_admin_redundancy(db, user, "demote this super admin")
        user.role = user_in.role
        
    if user_in.is_active is not None and user_in.is_active != user.is_active:
        if user.role == UserRole.super_admin and user_in.is_active is False:
            _check_super_admin_redundancy(db, user, "deactivate this super admin")
        user.is_active = user_in.is_active
        
    db.commit()
    db.refresh(user)
    return user

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db), current_admin: User = Depends(require_super_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.role == UserRole.super_admin:
        _check_super_admin_redundancy(db, user, "delete this super admin")
        
    db.delete(user)
    db.commit()
    return None
