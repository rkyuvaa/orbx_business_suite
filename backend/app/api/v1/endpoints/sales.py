from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import deps
from app.schemas.transaction import (
    SalesOrderOut, SalesOrderCreate,
    DeliveryOut, DeliveryCreate,
    InvoiceOut, InvoiceCreate
)
from app.services.tx_services import TxServices

router = APIRouter()


# ==========================================
# SALES ORDERS ENDPOINTS
# ==========================================
@router.get("/so", response_model=List[SalesOrderOut])
async def list_sales_orders(
    branch_id: Optional[UUID] = Query(None, description="Filter orders by branch"),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("sales", "view"))
):
    """Retrieve lists of sales orders."""
    return await TxServices.list_sales_orders(db, branch_id)


@router.post("/so", response_model=SalesOrderOut, status_code=status.HTTP_201_CREATED)
async def create_sales_order(
    so_data: SalesOrderCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("sales", "create"))
):
    """Create a new Sales Order."""
    return await TxServices.create_sales_order(db, so_data)


# ==========================================
# DELIVERIES ENDPOINTS
# ==========================================
@router.get("/deliveries", response_model=List[DeliveryOut])
async def list_deliveries(
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("sales", "view"))
):
    """List all shipment deliveries."""
    return await TxServices.list_deliveries(db)


@router.post("/deliveries", response_model=DeliveryOut, status_code=status.HTTP_201_CREATED)
async def record_delivery(
    delivery_data: DeliveryCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("sales", "create"))
):
    """Record a cargo delivery and decrement live warehouse stock."""
    return await TxServices.create_delivery(db, delivery_data)


# ==========================================
# TAX INVOICES ENDPOINTS
# ==========================================
@router.get("/invoices", response_model=List[InvoiceOut])
async def list_invoices(
    branch_id: Optional[UUID] = Query(None, description="Filter invoices by branch"),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("sales", "view"))
):
    """List all registered Tax Invoices."""
    return await TxServices.list_invoices(db, branch_id)


@router.post("/invoices", response_model=InvoiceOut, status_code=status.HTTP_201_CREATED)
async def generate_invoice(
    inv_data: InvoiceCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("sales", "create"))
):
    """Generate a sequential Tax Invoice with automatic CGST+SGST/IGST breakdown."""
    return await TxServices.create_invoice(db, inv_data)
