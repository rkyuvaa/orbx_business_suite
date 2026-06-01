from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from jose import jwt, JWTError

from app.core import deps
from app.core.config import settings
from app.core.security import ALGORITHM
from app.models.auth import User, Role
from app.schemas.auth import UserLogin, Token, UserOut, TokenPayload
from app.services.auth_service import AuthService

router = APIRouter()


@router.post("/login", response_model=Token)
async def login(
    login_data: UserLogin,
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """
    Log in a user by validating email and password,
    returning JWT access and refresh tokens.
    """
    user = await AuthService.authenticate_user(db, login_data)
    tokens = await AuthService.create_user_tokens(db, user)
    return tokens


@router.post("/refresh", response_model=Token)
async def refresh_token(
    refresh_token_str: str,
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """
    Refresh JWT access and refresh tokens using a valid refresh token.
    Enforces refresh token rotation.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid refresh token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            refresh_token_str, settings.SECRET_KEY, algorithms=[ALGORITHM]
        )
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        if user_id is None or token_type != "refresh":
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    query = await db.execute(select(User).filter(User.id == user_id, User.is_active == True))
    user = query.scalar_one_or_none()
    if user is None:
        raise credentials_exception

    tokens = await AuthService.create_user_tokens(db, user)
    return tokens


@router.get("/me", response_model=UserOut)
async def read_users_me(
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """Get details of the currently authenticated user session."""
    return current_user


@router.post("/logout")
async def logout(current_user: User = Depends(deps.get_current_user)) -> Any:
    """Log out the current user session by notifying the client."""
    return {"success": True, "message": "Successfully logged out"}
