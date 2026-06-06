from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import deps
from app.schemas.transaction import (
    CurrentStockOut, StockTransactionOut, StockTransactionCreate,
    StockTransferOut, StockTransferCreate
)
from app.services.tx_services import TxServices

router = APIRouter()


@router.get("/stock", response_model=List[CurrentStockOut])
async def current_stock_positions(
    branch_id: Optional[UUID] = Query(None, description="Filter stock by branch"),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("inventory", "view"))
):
    """View active quantities per product, per branch."""
    return await TxServices.get_current_stock(db, branch_id)


@router.get("/ledger", response_model=List[StockTransactionOut])
async def inventory_ledger(
    product_id: Optional[UUID] = Query(None, description="Filter transactions by product"),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("inventory", "view"))
):
    """Query chronological list of inventory additions, deductions, or adjustments."""
    return await TxServices.get_stock_movement(db, product_id)


@router.post("/adjust", response_model=CurrentStockOut, status_code=status.HTTP_200_OK)
async def manual_inventory_transaction(
    tx_data: StockTransactionCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("inventory", "create"))
):
    """Execute a manual stock adjust correction, manual intake, or manual stock write-off."""
    return await TxServices.manual_stock_transaction(db, tx_data)


@router.post("/transfers", response_model=StockTransferOut)
async def create_transfer(
    transfer_data: StockTransferCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("inventory", "create"))
):
    """Create a stock transfer or customer delivery challan in Draft state."""
    return await TxServices.create_stock_transfer(db, transfer_data)


@router.get("/transfers", response_model=List[StockTransferOut])
async def list_transfers(
    branch_id: Optional[UUID] = Query(None),
    customer_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("inventory", "view"))
):
    """List stock transfers / delivery challans."""
    return await TxServices.list_stock_transfers(db, branch_id=branch_id, customer_id=customer_id)


@router.get("/transfers/{transfer_id}", response_model=StockTransferOut)
async def get_transfer_by_id(
    transfer_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("inventory", "view"))
):
    """Fetch details of a single stock transfer / delivery challan."""
    return await TxServices.get_stock_transfer(db, transfer_id)


@router.post("/transfers/{transfer_id}/dispatch", response_model=StockTransferOut)
async def dispatch_transfer(
    transfer_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("inventory", "create"))
):
    """Dispatch the stock transfer / delivery challan (decrements source branch, increments destination branch if applicable)."""
    return await TxServices.dispatch_stock_transfer(db, transfer_id)


@router.post("/transfers/{transfer_id}/cancel", response_model=StockTransferOut)
async def cancel_transfer(
    transfer_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("inventory", "create"))
):
    """Cancel the stock transfer / delivery challan (reverses stock adjustments if already transferred)."""
    return await TxServices.cancel_stock_transfer(db, transfer_id)
