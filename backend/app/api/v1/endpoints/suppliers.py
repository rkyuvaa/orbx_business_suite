from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import deps
from app.schemas.master import SupplierOut, SupplierCreate, SupplierUpdate
from app.services.master_services import MasterServices

router = APIRouter()


@router.get("/", response_model=List[SupplierOut])
async def list_suppliers(
    branch_id: Optional[UUID] = Query(None, description="Filter suppliers by branch"),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("masters", "view"))
):
    """Retrieve list of operating suppliers."""
    return await MasterServices.list_suppliers(db, branch_id)


@router.post("/", response_model=SupplierOut, status_code=status.HTTP_201_CREATED)
async def create_supplier(
    supplier_data: SupplierCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("masters", "create"))
):
    """Create a new supplier master record."""
    return await MasterServices.create_supplier(db, supplier_data)


@router.put("/{supplier_id}", response_model=SupplierOut)
async def update_supplier(
    supplier_id: UUID,
    supplier_data: SupplierUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("masters", "edit"))
):
    """Update supplier profile details."""
    return await MasterServices.update_supplier(db, supplier_id, supplier_data)
