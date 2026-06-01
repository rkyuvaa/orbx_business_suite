from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import deps
from app.schemas.admin import (
    CompanyOut, CompanyUpdate, BranchOut, BranchCreate, BranchUpdate,
    RoleOut, RoleCreate, RoleUpdate
)
from app.schemas.auth import UserOut, UserCreate, UserUpdate
from app.services.admin_service import AdminService

router = APIRouter()


# ==========================================
# COMPANY ENDPOINTS
# ==========================================
@router.get("/company", response_model=CompanyOut)
async def get_company(
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("admin", "view"))
):
    """Fetch company profile configuration."""
    return await AdminService.get_company(db)


@router.put("/company", response_model=CompanyOut)
async def update_company(
    company_data: CompanyUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("admin", "edit"))
):
    """Update company details."""
    return await AdminService.update_company(db, company_data)


# ==========================================
# BRANCHES ENDPOINTS
# ==========================================
@router.get("/branches", response_model=List[BranchOut])
async def list_branches(
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("admin", "view"))
):
    """List all operating branches."""
    return await AdminService.list_branches(db)


@router.post("/branches", response_model=BranchOut, status_code=status.HTTP_201_CREATED)
async def create_branch(
    branch_data: BranchCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("admin", "create"))
):
    """Create a new branch."""
    return await AdminService.create_branch(db, branch_data)


@router.put("/branches/{branch_id}", response_model=BranchOut)
async def update_branch(
    branch_id: UUID,
    branch_data: BranchUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("admin", "edit"))
):
    """Update an existing branch configuration or invoice sequence."""
    return await AdminService.update_branch(db, branch_id, branch_data)


# ==========================================
# ROLES ENDPOINTS
# ==========================================
@router.get("/roles", response_model=List[RoleOut])
async def list_roles(
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("admin", "view"))
):
    """List all user roles and permissions."""
    return await AdminService.list_roles(db)


@router.post("/roles", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
async def create_role(
    role_data: RoleCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("admin", "create"))
):
    """Create a new user role with a permission matrix."""
    return await AdminService.create_role(db, role_data)


@router.put("/roles/{role_id}", response_model=RoleOut)
async def update_role(
    role_id: UUID,
    role_data: RoleUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("admin", "edit"))
):
    """Update a role and its permission checklist."""
    return await AdminService.update_role(db, role_id, role_data)


# ==========================================
# USER MANAGEMENT ENDPOINTS
# ==========================================
@router.get("/users", response_model=List[UserOut])
async def list_users(
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("admin", "view"))
):
    """List all system user profiles."""
    return await AdminService.list_users(db)


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("admin", "create"))
):
    """Create a new user account."""
    return await AdminService.create_user(db, user_data)


@router.put("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: UUID,
    user_data: UserUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("admin", "edit"))
):
    """Update a user's details, active status, branch mapping, or password."""
    return await AdminService.update_user(db, user_id, user_data)
