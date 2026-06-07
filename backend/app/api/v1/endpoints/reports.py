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


# ==========================================
# PHASE 2 & 3 COMPLIANCE & BOOKS ENDPOINTS
# ==========================================
from app.services.compliance_service import ComplianceService

@router.get("/balance-sheet")
async def get_balance_sheet(
    as_of_date: Optional[date] = Query(None, description="As of date (YYYY-MM-DD)"),
    branch_id: Optional[UUID] = Query(None, description="Filter by branch"),
    format: Optional[str] = Query(None, description="Output format (json or xlsx)"),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("reports", "view"))
):
    """Retrieve Schedule III Balance Sheet."""
    effective_date = as_of_date or current_fy_dates()[1]
    result = await ComplianceService.get_balance_sheet(db, as_of_date=effective_date, branch_id=branch_id)
    
    if format == "xlsx":
        headers = ["Schedule III Line Items / Particulars", "Ledger Amount", "Group Total"]
        rows = []
        rows.append(["EQUITY AND LIABILITIES", "", ""])
        for cat in result["sections"]["equity_and_liabilities"]["categories"]:
            rows.append(["  " + cat["name"], "", cat["balance"]])
            for sub in cat["subgroups"]:
                rows.append(["    " + sub["name"], "", sub["balance"]])
                for ledg in sub["ledgers"]:
                    rows.append(["      " + ledg["name"], ledg["balance"], ""])
        rows.append(["TOTAL EQUITY AND LIABILITIES", "", result["sections"]["equity_and_liabilities"]["total"]])
        
        rows.append(["", "", ""])
        rows.append(["ASSETS", "", ""])
        for cat in result["sections"]["assets"]["categories"]:
            rows.append(["  " + cat["name"], "", cat["balance"]])
            for sub in cat["subgroups"]:
                rows.append(["    " + sub["name"], "", sub["balance"]])
                for ledg in sub["ledgers"]:
                    rows.append(["      " + ledg["name"], ledg["balance"], ""])
        rows.append(["TOTAL ASSETS", "", result["sections"]["assets"]["total"]])

        return build_xlsx_response(
            headers=headers,
            rows=rows,
            sheet_name="Balance Sheet",
            report_name="Balance_Sheet",
            start_date=effective_date,
            end_date=effective_date
        )
    return result


@router.get("/profit-loss")
async def get_profit_loss(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    branch_id: Optional[UUID] = Query(None, description="Filter by branch"),
    format: Optional[str] = Query(None, description="Output format (json or xlsx)"),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("reports", "view"))
):
    """Retrieve Schedule III Profit & Loss Statement."""
    effective_start = start_date
    effective_end = end_date
    if effective_start is None or effective_end is None:
        def_start, def_end = current_fy_dates()
        effective_start = effective_start or def_start
        effective_end = effective_end or def_end

    result = await ComplianceService.get_profit_loss(db, effective_start, effective_end, branch_id)

    if format == "xlsx":
        headers = ["Income & Expense Line Items", "Ledger Account Balance", "Group Total"]
        rows = []
        rows.append(["INCOME", "", ""])
        for cat in result["income"]["categories"]:
            rows.append(["  " + cat["name"], "", cat["balance"]])
            for ledg in cat["ledgers"]:
                rows.append(["    " + ledg["name"], ledg["balance"], ""])
        rows.append(["TOTAL INCOME", "", result["income"]["total"]])
        
        rows.append(["", "", ""])
        rows.append(["EXPENSES", "", ""])
        for cat in result["expense"]["categories"]:
            rows.append(["  " + cat["name"], "", cat["balance"]])
            for ledg in cat["ledgers"]:
                rows.append(["    " + ledg["name"], ledg["balance"], ""])
        rows.append(["TOTAL EXPENSES", "", result["expense"]["total"]])
        
        rows.append(["", "", ""])
        rows.append(["NET PROFIT / (LOSS)", "", result["net_profit"]])

        return build_xlsx_response(
            headers=headers,
            rows=rows,
            sheet_name="Profit & Loss",
            report_name="Profit_and_Loss",
            start_date=effective_start,
            end_date=effective_end
        )
    return result


@router.get("/cash-flow")
async def get_cash_flow(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    method: str = Query("indirect", description="Method (direct or indirect)"),
    format: Optional[str] = Query(None, description="Output format (json or xlsx)"),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("reports", "view"))
):
    """Retrieve AS-3 Cash Flow Statement."""
    effective_start = start_date
    effective_end = end_date
    if effective_start is None or effective_end is None:
        def_start, def_end = current_fy_dates()
        effective_start = effective_start or def_start
        effective_end = effective_end or def_end

    if method.lower() == "direct":
        result = await ComplianceService.get_cash_flow_direct(db, effective_start, effective_end)
    else:
        result = await ComplianceService.get_cash_flow_indirect(db, effective_start, effective_end)

    if format == "xlsx":
        headers = ["Cash Flow Activities & Line Items", "Amount (INR)"]
        rows = []
        if method.lower() == "direct":
            rows.append(["Cash Flow from Operating Activities (Direct Method)", ""])
            rows.append(["  Cash Receipts from Customers", result["operating_activities"]["cash_receipts"]])
            rows.append(["  Cash Payments to Suppliers / Employees", -result["operating_activities"]["cash_payments"]])
            rows.append(["  Net Cash from Operating Activities", result["operating_activities"]["net_cash_operating"]])
        else:
            rows.append(["Cash Flow from Operating Activities (Indirect Method)", ""])
            rows.append(["  Net Profit before Tax", result["operating_activities"]["net_profit_before_tax"]])
            rows.append(["  Adjustments for:", ""])
            rows.append(["    Depreciation & Amortization", result["operating_activities"]["adjustments"]["depreciation_amortization"]])
            rows.append(["    Finance Costs", result["operating_activities"]["adjustments"]["finance_costs"]])
            rows.append(["  Operating Profit before Working Capital Changes", result["operating_activities"]["operating_profit_before_wc"]])
            rows.append(["  Working Capital Adjustments:", ""])
            rows.append(["    Increase/Decrease in Receivables", result["operating_activities"]["wc_changes"]["receivables_change"]])
            rows.append(["    Increase/Decrease in Payables", result["operating_activities"]["wc_changes"]["payables_change"]])
            rows.append(["    Increase/Decrease in Inventory", result["operating_activities"]["wc_changes"]["inventory_change"]])
            rows.append(["  Net Cash from Operating Activities", result["operating_activities"]["net_cash_operating"]])
        
        rows.append(["", ""])
        rows.append(["Cash Flow from Investing Activities", ""])
        rows.append(["  Sale of Assets / Inflows", result["investing_activities"]["fixed_assets_change"] if method.lower() == "direct" else result["investing_activities"]["fixed_assets_change"]])
        rows.append(["  Purchase of Assets / Investments", result["investing_activities"]["investments_change"] if method.lower() == "direct" else result["investing_activities"]["investments_change"]])
        rows.append(["  Net Cash from Investing Activities", result["investing_activities"]["net_cash_investing"]])
        
        rows.append(["", ""])
        rows.append(["Cash Flow from Financing Activities", ""])
        rows.append(["  Proceeds from Capital / Borrowings", result["financing_activities"]["capital_change"] if method.lower() != "indirect" else result["financing_activities"]["capital_change"]])
        rows.append(["  Repayment of Borrowings / Finance Costs Paid", result["financing_activities"]["finance_costs_paid"] if method.lower() == "indirect" else result["financing_activities"]["capital_borrowings_repayments"]])
        rows.append(["  Net Cash from Financing Activities", result["financing_activities"]["net_cash_financing"]])
        
        rows.append(["", ""])
        rows.append(["Net Increase / (Decrease) in Cash", result["net_cash_change"]])
        rows.append(["Cash at Beginning of Period", result["cash_reconciliation"]["opening_balance"]])
        rows.append(["Cash at End of Period", result["cash_reconciliation"]["closing_balance"]])

        return build_xlsx_response(
            headers=headers,
            rows=rows,
            sheet_name="Cash Flow Statement",
            report_name=f"Cash_Flow_{method}",
            start_date=effective_start,
            end_date=effective_end
        )
    return result


@router.get("/gstr1")
async def get_gstr1(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    format: Optional[str] = Query(None, description="Output format (json or xlsx)"),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("reports", "view"))
):
    """Retrieve GSTR-1 outward supplies return summary."""
    effective_start = start_date
    effective_end = end_date
    if effective_start is None or effective_end is None:
        def_start, def_end = current_fy_dates()
        effective_start = effective_start or def_start
        effective_end = effective_end or def_end

    result = await ComplianceService.get_gstr1(db, effective_start, effective_end)

    if format == "xlsx":
        headers = ["Supply Category", "GSTIN", "Name/Place of Supply", "Invoice No", "Date", "Total Value", "Taxable Value", "Tax Amount"]
        rows = []
        rows.append(["B2B Outward Supplies", "", "", "", "", "", "", ""])
        for r in result["b2b"]["invoices"]:
            rows.append(["B2B", r["gstin"], r["customer_name"], r["invoice_no"], r["date"], r["value"], r["taxable_value"], r["tax_amount"]])
        rows.append(["TOTAL B2B", "", "", "", "", "", result["b2b"]["total_taxable_value"], result["b2b"]["total_tax_amount"]])
        
        rows.append(["", "", "", "", "", "", "", ""])
        rows.append(["B2C Small Outward Supplies", "", "", "", "", "", "", ""])
        for r in result["b2cs"]["invoices"]:
            rows.append(["B2CS", "", r["place_of_supply"], r["invoice_no"], r["date"], r["value"], r["taxable_value"], r["tax_amount"]])
        rows.append(["TOTAL B2CS", "", "", "", "", "", result["b2cs"]["total_taxable_value"], result["b2cs"]["total_tax_amount"]])

        rows.append(["", "", "", "", "", "", "", ""])
        rows.append(["B2C Large Outward Supplies", "", "", "", "", "", "", ""])
        for r in result["b2cl"]["invoices"]:
            rows.append(["B2CL", "", r["place_of_supply"], r["invoice_no"], r["date"], r["value"], r["taxable_value"], r["tax_amount"]])
        rows.append(["TOTAL B2CL", "", "", "", "", "", result["b2cl"]["total_taxable_value"], result["b2cl"]["total_tax_amount"]])

        return build_xlsx_response(
            headers=headers,
            rows=rows,
            sheet_name="GSTR-1 Summary",
            report_name="GSTR1_Outward_Supplies",
            start_date=effective_start,
            end_date=effective_end
        )
    return result


@router.get("/gstr3b")
async def get_gstr3b(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    format: Optional[str] = Query(None, description="Output format (json or xlsx)"),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("reports", "view"))
):
    """Retrieve GSTR-3B monthly summary."""
    effective_start = start_date
    effective_end = end_date
    if effective_start is None or effective_end is None:
        def_start, def_end = current_fy_dates()
        effective_start = effective_start or def_start
        effective_end = effective_end or def_end

    result = await ComplianceService.get_gstr3b(db, effective_start, effective_end)

    if format == "xlsx":
        headers = ["GSTR-3B Section", "Taxable Value (INR)", "CGST (INR)", "SGST (INR)", "IGST (INR)", "Total Tax/Credit"]
        rows = [
            [
                result["section_3_1"]["description"],
                result["section_3_1"]["taxable_value"],
                result["section_3_1"]["cgst"],
                result["section_3_1"]["sgst"],
                result["section_3_1"]["igst"],
                result["section_3_1"]["total_tax"]
            ],
            [
                result["section_4"]["description"],
                result["section_4"]["taxable_value"],
                result["section_4"]["cgst"],
                result["section_4"]["sgst"],
                result["section_4"]["igst"],
                result["section_4"]["total_itc"]
            ]
        ]
        return build_xlsx_response(
            headers=headers,
            rows=rows,
            sheet_name="GSTR-3B Summary",
            report_name="GSTR3B_Tax_Summary",
            start_date=effective_start,
            end_date=effective_end
        )
    return result


@router.get("/tds-payable")
async def get_tds_payable(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    format: Optional[str] = Query(None, description="Output format (json or xlsx)"),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("reports", "view"))
):
    """Retrieve TDS section-wise payable summary."""
    effective_start = start_date
    effective_end = end_date
    if effective_start is None or effective_end is None:
        def_start, def_end = current_fy_dates()
        effective_start = effective_start or def_start
        effective_end = effective_end or def_end

    result = await ComplianceService.get_tds_summary(db, effective_start, effective_end)

    if format == "xlsx":
        headers = ["TDS Section", "Transaction Count", "Total Taxable Amount", "TDS Rate (%)", "Total TDS Deducted"]
        rows = []
        tot_taxable = 0.0
        tot_tds = 0.0
        for r in result:
            rows.append([
                r["section"],
                r["count"],
                r["taxable_amount"],
                r["tds_rate"],
                r["tds_amount"]
            ])
            tot_taxable += r["taxable_amount"]
            tot_tds += r["tds_amount"]
            
        rows.append(["TOTAL", len(result), tot_taxable, "", tot_tds])
        return build_xlsx_response(
            headers=headers,
            rows=rows,
            sheet_name="TDS Payable Summary",
            report_name="TDS_Payable_Summary",
            start_date=effective_start,
            end_date=effective_end
        )
    return result


@router.get("/audit-trail")
async def get_audit_trail(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    format: Optional[str] = Query(None, description="Output format (json or xlsx)"),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("admin", "view"))
):
    """Retrieve system edit logs complying with MCA 2021 audit trail mandates."""
    effective_start = start_date
    effective_end = end_date
    if effective_start is None or effective_end is None:
        def_start, def_end = current_fy_dates()
        effective_start = effective_start or def_start
        effective_end = effective_end or def_end

    service_limit = 1000000 if format == "xlsx" else limit
    service_skip = 0 if format == "xlsx" else skip

    result = await ComplianceService.get_audit_trail(
        db, start_date=start_date, end_date=end_date, skip=service_skip, limit=service_limit
    )

    if format == "xlsx":
        headers = ["Timestamp", "User Email", "User Name", "IP Address", "Action", "Table Name", "Record ID", "Old Values", "New Values"]
        rows = []
        for r in result["records"]:
            rows.append([
                r["timestamp"],
                r["user"]["email"],
                r["user"]["full_name"],
                r["ip_address"],
                r["action"],
                r["table_name"],
                r["record_id"],
                json.dumps(r["old_values"]),
                json.dumps(r["new_values"])
            ])
        return build_xlsx_response(
            headers=headers,
            rows=rows,
            sheet_name="MCA 2021 Audit Trail",
            report_name="Audit_Trail_Report",
            start_date=effective_start,
            end_date=effective_end
        )
    return result


@router.get("/cash-book")
async def get_cash_book(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    format: Optional[str] = Query(None, description="Output format (json or xlsx)"),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("reports", "view"))
):
    """Retrieve Cash Book transaction log."""
    effective_start = start_date
    effective_end = end_date
    if effective_start is None or effective_end is None:
        def_start, def_end = current_fy_dates()
        effective_start = effective_start or def_start
        effective_end = effective_end or def_end

    service_limit = 1000000 if format == "xlsx" else limit
    service_skip = 0 if format == "xlsx" else skip

    result = await ReportService.get_cash_book(
        db, start_date=start_date, end_date=end_date, skip=service_skip, limit=service_limit
    )

    if format == "xlsx":
        headers = ["Date", "Voucher Number", "Particulars/Ledgers", "Cash Account", "Narration", "Debit (Dr)", "Credit (Cr)", "Running Balance"]
        rows = []
        rows.append([effective_start, "", "Opening Balance", "", "", "", "", result["opening_balance"]])
        for r in result["records"]:
            rows.append([
                r["date"],
                r["voucher_number"],
                r["particulars"],
                r["ledger_name"],
                r["narration"],
                r["debit"],
                r["credit"],
                r["running_balance"]
            ])
        rows.append([
            "TOTAL MOVEMENT", "", "", "", "",
            result["total_debit"],
            result["total_credit"],
            ""
        ])
        rows.append([
            "CLOSING BALANCE", "", "", "", "",
            "", "",
            result["closing_balance"]
        ])
        return build_xlsx_response(
            headers=headers,
            rows=rows,
            sheet_name="Cash Book",
            report_name="Cash_Book",
            start_date=effective_start,
            end_date=effective_end
        )
    return result


@router.get("/bank-book")
async def get_bank_book(
    bank_ledger_id: Optional[UUID] = Query(None, description="Specific Bank ledger ID"),
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    format: Optional[str] = Query(None, description="Output format (json or xlsx)"),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("reports", "view"))
):
    """Retrieve Bank Book transaction log."""
    effective_start = start_date
    effective_end = end_date
    if effective_start is None or effective_end is None:
        def_start, def_end = current_fy_dates()
        effective_start = effective_start or def_start
        effective_end = effective_end or def_end

    service_limit = 1000000 if format == "xlsx" else limit
    service_skip = 0 if format == "xlsx" else skip

    result = await ReportService.get_bank_book(
        db, bank_ledger_id=bank_ledger_id, start_date=start_date, end_date=end_date, skip=service_skip, limit=service_limit
    )

    if format == "xlsx":
        headers = ["Date", "Voucher Number", "Particulars/Ledgers", "Bank Account", "Narration", "Debit (Dr)", "Credit (Cr)", "Running Balance"]
        rows = []
        rows.append([effective_start, "", "Opening Balance", "", "", "", "", result["opening_balance"]])
        for r in result["records"]:
            rows.append([
                r["date"],
                r["voucher_number"],
                r["particulars"],
                r["ledger_name"],
                r["narration"],
                r["debit"],
                r["credit"],
                r["running_balance"]
            ])
        rows.append([
            "TOTAL MOVEMENT", "", "", "", "",
            result["total_debit"],
            result["total_credit"],
            ""
        ])
        rows.append([
            "CLOSING BALANCE", "", "", "", "",
            "", "",
            result["closing_balance"]
        ])
        return build_xlsx_response(
            headers=headers,
            rows=rows,
            sheet_name="Bank Book",
            report_name="Bank_Book",
            start_date=effective_start,
            end_date=effective_end
        )
    return result


@router.get("/journal-register")
async def get_journal_register(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    format: Optional[str] = Query(None, description="Output format (json or xlsx)"),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("reports", "view"))
):
    """Retrieve Journal Register listing all journal entries."""
    effective_start = start_date
    effective_end = end_date
    if effective_start is None or effective_end is None:
        def_start, def_end = current_fy_dates()
        effective_start = effective_start or def_start
        effective_end = effective_end or def_end

    service_limit = 1000000 if format == "xlsx" else limit
    service_skip = 0 if format == "xlsx" else skip

    result = await ReportService.get_journal_register(
        db, start_date=start_date, end_date=end_date, skip=service_skip, limit=service_limit
    )

    if format == "xlsx":
        headers = ["Date", "Voucher Number", "Voucher Type", "Narration", "Ledger Code", "Ledger Name", "Debit", "Credit", "Line Narration"]
        rows = []
        for r in result["records"]:
            first_line = True
            for l in r["lines"]:
                dr = l["amount"] if l["dr_cr"] == "Dr" else ""
                cr = l["amount"] if l["dr_cr"] == "Cr" else ""
                rows.append([
                    r["date"] if first_line else "",
                    r["voucher_number"] if first_line else "",
                    r["voucher_type"] if first_line else "",
                    r["narration"] if first_line else "",
                    l["ledger_code"],
                    l["ledger_name"],
                    dr,
                    cr,
                    l["narration"]
                ])
                first_line = False
        return build_xlsx_response(
            headers=headers,
            rows=rows,
            sheet_name="Journal Register",
            report_name="Journal_Register",
            start_date=effective_start,
            end_date=effective_end
        )
    return result


