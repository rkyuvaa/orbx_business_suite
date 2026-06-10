from typing import AsyncGenerator, Callable
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.core.security import ALGORITHM
from app.db.session import SessionLocal

# Reusable OAuth2 password bearer
reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login"
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency to retrieve a database session and close it after the request completes."""
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_current_user(
    db: AsyncSession = Depends(get_db), token: str = Depends(reusable_oauth2)
):
    """
    Dependency to authenticate the user using the JWT access token.
    Loads and returns the User object from the database.
    """
    # Circular imports solution
    from app.models.auth import User

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[ALGORITHM]
        )
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        if user_id is None or token_type != "access":
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Query the user
    from sqlalchemy.orm import selectinload
    query = await db.execute(
        select(User)
        .filter(User.id == user_id, User.is_active == True)
        .options(selectinload(User.role))
    )
    user = query.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    
    # Set audit context variable
    from app.core.audit_context import current_user_id as context_user_id
    context_user_id.set(user.id)
    
    return user


class PermissionChecker:
    """
    Dependency to enforce Role-Based Access Control (RBAC).
    Checks if the authenticated user has permission to perform an action on a module.
    """
    def __init__(self, module: str, action: str):
        self.module = module
        self.action = action

    async def __call__(
        self,
        current_user = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
    ):
        from app.models.auth import Permission, Role

        # Super admin role check (we can assume role named 'Super Admin' has all permissions)
        # Fetch the user's role
        query_role = await db.execute(select(Role).filter(Role.id == current_user.role_id))
        role = query_role.scalar_one_or_none()
        if not role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User has no assigned role",
            )

        if role.name == "Super Admin":
            return current_user

        # Query the exact permission record
        query_perm = await db.execute(
            select(Permission).filter(
                Permission.role_id == role.id,
                Permission.module == self.module,
                Permission.action == self.action,
                Permission.is_allowed == True
            )
        )
        permission = query_perm.scalar_one_or_none()
        if not permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required permission: {self.module} ({self.action})",
            )

        return current_user
