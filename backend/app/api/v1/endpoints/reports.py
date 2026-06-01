from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import deps
from app.schemas.transaction import DashboardResponse
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
