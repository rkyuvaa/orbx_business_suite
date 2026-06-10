from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import deps
from app.schemas.master import CustomerOut, CustomerCreate, CustomerUpdate
from app.services.master_services import MasterServices

router = APIRouter()


@router.get("/", response_model=List[CustomerOut])
async def list_customers(
    branch_id: Optional[UUID] = Query(None, description="Filter customers by branch"),
    search: Optional[str] = Query(None, description="Search term for name or code"),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("masters", "view"))
):
    """Retrieve list of customers."""
    return await MasterServices.list_customers(db, branch_id, search)


@router.post("/", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
async def create_customer(
    customer_data: CustomerCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("masters", "create"))
):
    """Create a new customer master record."""
    return await MasterServices.create_customer(db, customer_data)


@router.put("/{customer_id}", response_model=CustomerOut)
async def update_customer(
    customer_id: UUID,
    customer_data: CustomerUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("masters", "edit"))
):
    """Update customer master record details."""
    return await MasterServices.update_customer(db, customer_id, customer_data)


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(
    customer_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("masters", "delete"))
):
    """Delete customer master record."""
    await MasterServices.delete_customer(db, customer_id)
    return None
