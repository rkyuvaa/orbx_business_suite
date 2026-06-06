from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import deps
from app.schemas.transaction import DashboardResponse, CustomerLedgerResponse, SupplierLedgerResponse
from app.services.report_service import ReportService

router = APIRouter()


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard_analytics(
    branch_id: Optional[UUID] = Query(None, description="Filter dashboard by branch"),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("reports", "view"))
):
    """Retrieve full analytics payload containing KPI counts, categorical charts, and transaction histories."""
    return await ReportService.get_dashboard_metrics(db, branch_id)


@router.get("/customer-ledger/{customer_id}", response_model=CustomerLedgerResponse)
async def get_customer_ledger(
    customer_id: UUID,
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM)"),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("reports", "view"))
):
    """Retrieve detailed ledger report and metrics for a Customer."""
    return await ReportService.get_customer_ledger(db, customer_id, start_date, end_date)


@router.get("/supplier-ledger/{supplier_id}", response_model=SupplierLedgerResponse)
async def get_supplier_ledger(
    supplier_id: UUID,
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM)"),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("reports", "view"))
):
    """Retrieve detailed ledger report and metrics for a Supplier."""
    return await ReportService.get_supplier_ledger(db, supplier_id, start_date, end_date)
