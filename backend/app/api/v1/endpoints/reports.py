from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import deps
from app.core.account_constants import current_fy_dates
from app.utils.report_export import build_xlsx_response
from app.schemas.transaction import DashboardResponse, CustomerLedgerResponse, SupplierLedgerResponse
from app.schemas.accounts import (
    TrialBalanceResponse,
    GeneralLedgerResponse,
    DayBookResponse,
    PurchaseRegisterResponse,
    SalesRegisterResponse,
)
from app.services.report_service import ReportService

router = APIRouter()


@router.get("/", response_model=List[Dict[str, Any]])
async def list_reports(
    current_user = Depends(deps.PermissionChecker("reports", "view"))
):
    """List available reports and their filter configurations."""
    return [
        {"id": "trial-balance", "name": "Trial Balance", "params": ["start_date", "end_date"]},
        {"id": "general-ledger", "name": "General Ledger", "params": ["ledger_id", "start_date", "end_date", "skip", "limit"]},
        {"id": "day-book", "name": "Day Book", "params": ["start_date", "end_date", "branch_id", "skip", "limit"]},
        {"id": "purchase-register", "name": "Purchase Register", "params": ["start_date", "end_date", "supplier_id", "branch_id", "skip", "limit"]},
        {"id": "sales-register", "name": "Sales Register", "params": ["start_date", "end_date", "customer_id", "branch_id", "skip", "limit"]}
    ]


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


@router.get("/sales-summary")
async def get_sales_summary(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    branch_id: Optional[UUID] = Query(None, description="Filter by branch"),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("reports", "view"))
):
    """Retrieve tabular rows for the Excel sales summary sheet."""
    return await ReportService.get_sales_summary_data(db, start_date, end_date, branch_id)


@router.get("/sales-summary/excel")
async def get_sales_summary_excel(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    branch_id: Optional[UUID] = Query(None, description="Filter by branch"),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("reports", "view"))
):
    """Generate and download the professional Excel sales summary sheet."""
    from fastapi.responses import StreamingResponse
    rows = await ReportService.get_sales_summary_data(db, start_date, end_date, branch_id)
    excel_file = ReportService.generate_sales_summary_excel(rows)
    filename = f"Sales_Summary_{start_date or 'all'}_to_{end_date or 'all'}.xlsx"
    return StreamingResponse(
        excel_file,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/trial-balance", response_model=TrialBalanceResponse)
async def get_trial_balance(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    format: Optional[str] = Query(None, description="Output format (json or xlsx)"),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("reports", "view"))
):
    """Retrieve Trial Balance report."""
    effective_start = start_date
    effective_end = end_date
    if effective_start is None or effective_end is None:
        def_start, def_end = current_fy_dates()
        effective_start = effective_start or def_start
        effective_end = effective_end or def_end

    result = await ReportService.get_trial_balance(db, start_date, end_date)
    if format == "xlsx":
        headers = [
            "Ledger Code", "Ledger Name", "Account Group",
            "Opening Debit", "Opening Credit",
            "Debit Movement", "Credit Movement",
            "Closing Debit", "Closing Credit"
        ]
        rows = []
        for r in result.rows:
            rows.append([
                r.code,
                r.name,
                r.group_name,
                r.opening_dr,
                r.opening_cr,
                r.movement_dr,
                r.movement_cr,
                r.closing_dr,
                r.closing_cr
            ])
        rows.append([
            "TOTAL",
            "",
            "",
            result.totals.opening_dr_total,
            result.totals.opening_cr_total,
            result.totals.movement_dr_total,
            result.totals.movement_cr_total,
            result.totals.closing_dr_total,
            result.totals.closing_cr_total
        ])
        return build_xlsx_response(
            headers=headers,
            rows=rows,
            sheet_name="Trial Balance",
            report_name="Trial_Balance",
            start_date=effective_start,
            end_date=effective_end
        )
    return result


@router.get("/general-ledger/{ledger_id}", response_model=GeneralLedgerResponse)
async def get_general_ledger(
    ledger_id: UUID,
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    format: Optional[str] = Query(None, description="Output format (json or xlsx)"),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("reports", "view"))
):
    """Retrieve General Ledger for a specific ledger account."""
    effective_start = start_date
    effective_end = end_date
    if effective_start is None or effective_end is None:
        def_start, def_end = current_fy_dates()
        effective_start = effective_start or def_start
        effective_end = effective_end or def_end

    service_limit = 1000000 if format == "xlsx" else limit
    service_skip = 0 if format == "xlsx" else skip

    result = await ReportService.get_general_ledger(
        db, ledger_id, start_date, end_date, skip=service_skip, limit=service_limit
    )

    if format == "xlsx":
        headers = [
            "Date", "Voucher Type", "Voucher Number",
            "Particulars", "Narration",
            "Debit", "Credit", "Running Balance"
        ]
        rows = []
        op_dr = result.opening_balance if result.opening_balance_type == "Dr" else Decimal("0.00")
        op_cr = result.opening_balance if result.opening_balance_type == "Cr" else Decimal("0.00")
        rows.append([
            effective_start,
            "Opening Balance",
            "",
            "Opening Balance",
            "",
            op_dr,
            op_cr,
            result.opening_balance
        ])
        for line in result.lines:
            rows.append([
                line.date,
                line.voucher_type,
                line.reference_no,
                line.particulars,
                line.narration or "",
                line.debit,
                line.credit,
                line.running_balance
            ])
        rows.append([
            effective_end,
            "Closing Balance",
            "",
            "Closing Balance",
            "",
            result.total_debit,
            result.total_credit,
            result.closing_balance
        ])
        return build_xlsx_response(
            headers=headers,
            rows=rows,
            sheet_name="General Ledger",
            report_name=f"General_Ledger_{result.code}",
            start_date=effective_start,
            end_date=effective_end
        )
    return result


@router.get("/day-book", response_model=DayBookResponse)
async def get_day_book(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    branch_id: Optional[UUID] = Query(None, description="Filter by branch"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    format: Optional[str] = Query(None, description="Output format (json or xlsx)"),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("reports", "view"))
):
    """Retrieve chronological Day Book entries."""
    effective_start = start_date
    effective_end = end_date
    if effective_start is None or effective_end is None:
        def_start, def_end = current_fy_dates()
        effective_start = effective_start or def_start
        effective_end = effective_end or def_end

    service_limit = 1000000 if format == "xlsx" else limit
    service_skip = 0 if format == "xlsx" else skip

    result = await ReportService.get_day_book(
        db, start_date, end_date, branch_id, skip=service_skip, limit=service_limit
    )

    if format == "xlsx":
        headers = [
            "Date", "Voucher Type", "Voucher Number",
            "Ledger Code", "Ledger Name",
            "Debit", "Credit", "Line Narration", "Entry Narration", "Status"
        ]
        rows = []
        for entry in result.entries:
            status_str = "REVERSED" if entry.is_reversed else "Active"
            for line in entry.lines:
                rows.append([
                    entry.date,
                    entry.voucher_type,
                    entry.voucher_number,
                    line.ledger_code,
                    line.ledger_name,
                    line.amount if line.dr_cr == "Dr" else Decimal("0.00"),
                    line.amount if line.dr_cr == "Cr" else Decimal("0.00"),
                    line.narration or "",
                    entry.narration or "",
                    status_str
                ])
        rows.append([
            "TOTAL",
            "",
            "",
            "",
            "",
            result.total_debit,
            result.total_credit,
            "",
            "",
            ""
        ])
        return build_xlsx_response(
            headers=headers,
            rows=rows,
            sheet_name="Day Book",
            report_name="Day_Book",
            start_date=effective_start,
            end_date=effective_end
        )
    return result


@router.get("/purchase-register", response_model=PurchaseRegisterResponse)
async def get_purchase_register(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    supplier_id: Optional[UUID] = Query(None, description="Filter by supplier ID"),
    branch_id: Optional[UUID] = Query(None, description="Filter by branch ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    format: Optional[str] = Query(None, description="Output format (json or xlsx)"),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("reports", "view"))
):
    """Retrieve Purchase Register report."""
    effective_start = start_date
    effective_end = end_date
    if effective_start is None or effective_end is None:
        def_start, def_end = current_fy_dates()
        effective_start = effective_start or def_start
        effective_end = effective_end or def_end

    service_limit = 1000000 if format == "xlsx" else limit
    service_skip = 0 if format == "xlsx" else skip

    result = await ReportService.get_purchase_register(
        db, start_date, end_date, supplier_id, branch_id, skip=service_skip, limit=service_limit
    )

    if format == "xlsx":
        headers = [
            "Billing Date", "Invoice Number", "Supplier Name",
            "Supplier GSTIN", "Place of Supply", "Taxable Value",
            "CGST Amount", "SGST Amount", "IGST Amount",
            "Total Tax", "Total Amount", "Status"
        ]
        rows = []
        for r in result.rows:
            rows.append([
                r.billing_date,
                r.invoice_number,
                r.supplier_name,
                r.supplier_gstin,
                r.place_of_supply,
                r.taxable_value,
                r.cgst_amount,
                r.sgst_amount,
                r.igst_amount,
                r.total_tax,
                r.total_amount,
                r.status
            ])
        rows.append([
            "TOTAL",
            "",
            "",
            "",
            "",
            result.totals.taxable_value_total,
            result.totals.cgst_amount_total,
            result.totals.sgst_amount_total,
            result.totals.igst_amount_total,
            result.totals.total_tax_total,
            result.totals.total_amount_total,
            ""
        ])
        return build_xlsx_response(
            headers=headers,
            rows=rows,
            sheet_name="Purchase Register",
            report_name="Purchase_Register",
            start_date=effective_start,
            end_date=effective_end
        )
    return result


@router.get("/sales-register", response_model=SalesRegisterResponse)
async def get_sales_register(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    customer_id: Optional[UUID] = Query(None, description="Filter by customer ID"),
    branch_id: Optional[UUID] = Query(None, description="Filter by branch ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    format: Optional[str] = Query(None, description="Output format (json or xlsx)"),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("reports", "view"))
):
    """Retrieve Sales Register report."""
    effective_start = start_date
    effective_end = end_date
    if effective_start is None or effective_end is None:
        def_start, def_end = current_fy_dates()
        effective_start = effective_start or def_start
        effective_end = effective_end or def_end

    service_limit = 1000000 if format == "xlsx" else limit
    service_skip = 0 if format == "xlsx" else skip

    result = await ReportService.get_sales_register(
        db, start_date, end_date, customer_id, branch_id, skip=service_skip, limit=service_limit
    )

    if format == "xlsx":
        headers = [
            "Invoice Date", "Invoice Number", "Customer Name",
            "Customer GSTIN", "Place of Supply", "Taxable Value",
            "CGST Amount", "SGST Amount", "IGST Amount",
            "Total Tax", "Total Amount", "Status"
        ]
        rows = []
        for r in result.rows:
            rows.append([
                r.invoice_date,
                r.invoice_number,
                r.customer_name,
                r.customer_gstin,
                r.place_of_supply,
                r.taxable_value,
                r.cgst_amount,
                r.sgst_amount,
                r.igst_amount,
                r.total_tax,
                r.total_amount,
                r.status
            ])
        rows.append([
            "TOTAL",
            "",
            "",
            "",
            "",
            result.totals.taxable_value_total,
            result.totals.cgst_amount_total,
            result.totals.sgst_amount_total,
            result.totals.igst_amount_total,
            result.totals.total_tax_total,
            result.totals.total_amount_total,
            ""
        ])
        return build_xlsx_response(
            headers=headers,
            rows=rows,
            sheet_name="Sales Register",
            report_name="Sales_Register",
            start_date=effective_start,
            end_date=effective_end
        )
    return result

