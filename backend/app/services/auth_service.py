from datetime import timedelta
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core import security
from app.models.auth import User, Role
from app.schemas.auth import UserLogin, Token


class AuthService:
    @staticmethod
    async def authenticate_user(db: AsyncSession, login_data: UserLogin) -> User:
        """Authenticate a user with their email and password."""
        query = await db.execute(select(User).filter(User.email == login_data.email, User.is_active == True))
        user = query.scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
            )
        if not security.verify_password(login_data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
            )
        return user

    @staticmethod
    async def create_user_tokens(db: AsyncSession, user: User) -> Token:
        """Generate Access and Refresh tokens for an authenticated user."""
        # Query role name to attach, or standard subject encoding
        query_role = await db.execute(select(Role).filter(Role.id == user.role_id))
        role = query_role.scalar_one_or_none()
        role_name = role.name if role else "User"

        access_token = security.create_access_token(
            subject=user.id,
            expires_delta=timedelta(minutes=30)
        )
        refresh_token = security.create_refresh_token(
            subject=user.id,
            expires_delta=timedelta(days=7)
        )
        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer"
        )
