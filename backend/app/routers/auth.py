from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
import logging

from app.database import get_db
from app.models.user import User, UserRole
from app.core.security import verify_google_token, create_access_token
from app.core.config import settings

router = APIRouter(tags=["Authentication"])
logger = logging.getLogger(__name__)

class GoogleAuthRequest(BaseModel):
    credential: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

@router.post("/auth/google", response_model=TokenResponse)
def google_auth(request: GoogleAuthRequest, db: Session = Depends(get_db)):
    # 1. Verify Google Token
    idinfo = verify_google_token(request.credential)
    
    email = idinfo.get("email")
    first_name = idinfo.get("given_name")
    last_name = idinfo.get("family_name")
    name = idinfo.get("name")
    
    if not email:
        raise HTTPException(status_code=400, detail="Google token did not contain an email")

    # 2. Check if user exists
    user = db.query(User).filter(User.email == email).first()
    
    # 3. Handle First Super Admin bootstrap
    if not user:
        if settings.FIRST_SUPER_ADMIN_EMAIL and email.lower() == settings.FIRST_SUPER_ADMIN_EMAIL.lower():
            logger.info(f"Bootstrapping first super admin: {email}")
            user = User(
                email=email,
                first_name=first_name,
                last_name=last_name,
                role=UserRole.super_admin,
                is_active=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            logger.warning(f"Unauthorized login attempt by: {email}")
            raise HTTPException(status_code=403, detail="Access Denied")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is disabled")
        
    # Update name if changed
    if (user.first_name != first_name) or (user.last_name != last_name):
        user.first_name = first_name
        user.last_name = last_name
        db.commit()

    # 4. Generate Internal JWT
    access_token = create_access_token(
        data={
            "user_id": user.id,
            "email": user.email,
            "name": name or f"{user.first_name} {user.last_name}".strip(),
            "role": user.role.value
        }
    )
    
    return {"access_token": access_token, "token_type": "bearer"}
