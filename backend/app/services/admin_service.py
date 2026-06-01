from typing import List, Optional
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.security import get_password_hash
from app.models.auth import Role, Permission, User
from app.models.business import Company, Branch
from app.schemas.admin import (
    CompanyUpdate, BranchCreate, BranchUpdate, RoleCreate, RoleUpdate
)
from app.schemas.auth import UserCreate, UserUpdate


class AdminService:
    # ==========================================
    # COMPANY CONFIG SERVICES
    # ==========================================
    @staticmethod
    async def get_company(db: AsyncSession) -> Company:
        """Fetch the primary company singleton configuration or create one if empty."""
        query = await db.execute(select(Company))
        company = query.scalars().first()
        if not company:
            # Create a fallback default company
            company = Company(
                name="ORBX Corporation",
                logo="",
                address="123 Corporate Blvd, Silicon Valley",
                gstin="22AAAAA0000A1Z5",
                email="info@orbx.com",
                phone="+1-555-0199",
                financial_year_start="2026-04-01"
            )
            db.add(company)
            await db.commit()
            await db.refresh(company)
        return company

    @staticmethod
    async def update_company(db: AsyncSession, company_data: CompanyUpdate) -> Company:
        """Update company profile information."""
        company = await AdminService.get_company(db)
        for key, value in company_data.model_dump(exclude_unset=True).items():
            setattr(company, key, value)
        db.add(company)
        await db.commit()
        await db.refresh(company)
        return company

    # ==========================================
    # BRANCHES SERVICES
    # ==========================================
    @staticmethod
    async def list_branches(db: AsyncSession) -> List[Branch]:
        """Fetch all branches."""
        query = await db.execute(select(Branch))
        return list(query.scalars().all())

    @staticmethod
    async def create_branch(db: AsyncSession, branch_data: BranchCreate) -> Branch:
        """Create a new branch linked to the primary company."""
        company = await AdminService.get_company(db)
        
        # Check duplicate code
        query_check = await db.execute(select(Branch).filter(Branch.code == branch_data.code))
        if query_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Branch code '{branch_data.code}' already exists."
            )

        branch = Branch(
            company_id=company.id,
            **branch_data.model_dump()
        )
        db.add(branch)
        await db.commit()
        await db.refresh(branch)
        return branch

    @staticmethod
    async def update_branch(db: AsyncSession, branch_id: UUID, branch_data: BranchUpdate) -> Branch:
        """Update a branch configuration (including invoice sequencing)."""
        query = await db.execute(select(Branch).filter(Branch.id == branch_id))
        branch = query.scalar_one_or_none()
        if not branch:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Branch not found."
            )
        
        for key, value in branch_data.model_dump(exclude_unset=True).items():
            setattr(branch, key, value)
        
        db.add(branch)
        await db.commit()
        await db.refresh(branch)
        return branch

    # ==========================================
    # ROLES & PERMISSIONS SERVICES
    # ==========================================
    @staticmethod
    async def list_roles(db: AsyncSession) -> List[Role]:
        """Fetch all roles including their permission checklists."""
        query = await db.execute(select(Role).options(selectinload(Role.permissions)))
        return list(query.scalars().all())

    @staticmethod
    async def create_role(db: AsyncSession, role_data: RoleCreate) -> Role:
        """Create a new role and seed its permission matrix."""
        query_check = await db.execute(select(Role).filter(Role.name == role_data.name))
        if query_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Role '{role_data.name}' already exists."
            )

        role = Role(
            name=role_data.name,
            description=role_data.description
        )
        db.add(role)
        await db.commit()
        await db.refresh(role)

        # Seed permissions if provided
        if role_data.permissions:
            for perm in role_data.permissions:
                db_perm = Permission(
                    role_id=role.id,
                    module=perm.module,
                    action=perm.action,
                    is_allowed=perm.is_allowed
                )
                db.add(db_perm)
            await db.commit()

        # Re-fetch role with seeded permissions
        query_final = await db.execute(
            select(Role)
            .filter(Role.id == role.id)
            .options(selectinload(Role.permissions))
        )
        return query_final.scalar_one()

    @staticmethod
    async def update_role(db: AsyncSession, role_id: UUID, role_data: RoleUpdate) -> Role:
        """Update role description and rewrite/modify its permission matrix."""
        query = await db.execute(select(Role).filter(Role.id == role_id))
        role = query.scalar_one_or_none()
        if not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Role not found."
            )

        if role_data.name:
            role.name = role_data.name
        if role_data.description:
            role.description = role_data.description
        db.add(role)

        # Update permissions
        if role_data.permissions is not None:
            # Let's perform a drop & write for this role's permissions
            # to make permissions update simple and atomic.
            query_old = await db.execute(select(Permission).filter(Permission.role_id == role.id))
            for p in query_old.scalars().all():
                await db.delete(p)
            
            for perm in role_data.permissions:
                db_perm = Permission(
                    role_id=role.id,
                    module=perm.module,
                    action=perm.action,
                    is_allowed=perm.is_allowed
                )
                db.add(db_perm)
        
        await db.commit()
        
        query_final = await db.execute(
            select(Role)
            .filter(Role.id == role.id)
            .options(selectinload(Role.permissions))
        )
        return query_final.scalar_one()

    # ==========================================
    # USER MANAGEMENT SERVICES
    # ==========================================
    @staticmethod
    async def list_users(db: AsyncSession) -> List[User]:
        """List all users."""
        query = await db.execute(select(User))
        return list(query.scalars().all())

    @staticmethod
    async def create_user(db: AsyncSession, user_data: UserCreate) -> User:
        """Create a user with a hashed password."""
        query_check = await db.execute(select(User).filter(User.email == user_data.email))
        if query_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User email '{user_data.email}' already registered."
            )

        # Verify role exists
        query_role = await db.execute(select(Role).filter(Role.id == user_data.role_id))
        if not query_role.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assigned role does not exist."
            )

        # Verify branch exists if provided
        if user_data.branch_id:
            query_branch = await db.execute(select(Branch).filter(Branch.id == user_data.branch_id))
            if not query_branch.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Assigned branch does not exist."
                )

        user = User(
            email=user_data.email,
            hashed_password=get_password_hash(user_data.password),
            full_name=user_data.full_name,
            role_id=user_data.role_id,
            branch_id=user_data.branch_id
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

    @staticmethod
    async def update_user(db: AsyncSession, user_id: UUID, user_data: UserUpdate) -> User:
        """Update user details."""
        query = await db.execute(select(User).filter(User.id == user_id))
        user = query.scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found."
            )

        data = user_data.model_dump(exclude_unset=True)
        if "password" in data and data["password"]:
            user.hashed_password = get_password_hash(data.pop("password"))
        
        for key, value in data.items():
            setattr(user, key, value)

        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user
