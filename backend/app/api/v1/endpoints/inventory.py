from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import deps
from app.schemas.transaction import CurrentStockOut, StockTransactionOut, StockTransactionCreate
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
