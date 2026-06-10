from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import deps
from app.schemas.master import (
    ProductOut, ProductCreate, ProductUpdate,
    ProductCategoryOut, ProductCategoryCreate
)
from app.services.master_services import MasterServices

router = APIRouter()


# ==========================================
# PRODUCT CATEGORY ENDPOINTS
# ==========================================
@router.get("/categories", response_model=List[ProductCategoryOut])
async def list_categories(
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("masters", "view"))
):
    """List all product categories."""
    return await MasterServices.list_categories(db)


@router.post("/categories", response_model=ProductCategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(
    category_data: ProductCategoryCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("masters", "create"))
):
    """Create a new product category."""
    return await MasterServices.create_category(db, category_data)


@router.put("/categories/{category_id}", response_model=ProductCategoryOut)
async def update_category(
    category_id: UUID,
    category_data: ProductCategoryCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("masters", "edit"))
):
    """Update an existing category's details."""
    return await MasterServices.update_category(db, category_id, category_data)


# ==========================================
# PRODUCT MASTER ENDPOINTS
# ==========================================
@router.get("/", response_model=List[ProductOut])
async def list_products(
    search: Optional[str] = Query(None, description="Search term for product name or SKU"),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("masters", "view"))
):
    """Retrieve lists of catalog products and price configs."""
    return await MasterServices.list_products(db, search)


@router.post("/", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
async def create_product(
    product_data: ProductCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("masters", "create"))
):
    """Create a new product master record."""
    return await MasterServices.create_product(db, product_data)


@router.put("/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: UUID,
    product_data: ProductUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("masters", "edit"))
):
    """Update product SKU parameters or pricing overrides."""
    return await MasterServices.update_product(db, product_id, product_data)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("masters", "delete"))
):
    """Delete product master record."""
    await MasterServices.delete_product(db, product_id)
    return None
