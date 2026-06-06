from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, and_

from app.models.business import Customer, Supplier, Branch
from app.models.product import Product, ProductCategory
from app.models.purchase import PurchaseOrder, PurchaseEntry
from app.models.inventory import CurrentStock, StockTransaction
from app.models.sales import SalesOrder, Invoice, InvoiceItem
from app.models.finance import Payment
from app.schemas.transaction import (
    DashboardResponse, KPICardsOut, SalesByCategoryOut,
    MonthlySalesTrendOut, TopProductSalesOut, RecentTransactionOut,
    LedgerEntry, CustomerLedgerResponse, SupplierLedgerResponse
)


class ReportService:
    @staticmethod
    async def get_dashboard_metrics(db: AsyncSession, branch_id: Optional[UUID] = None) -> DashboardResponse:
        """Aggregate data to populate the primary KPI dashboard charts and tables."""
        today = date.today()
        start_of_today = datetime(today.year, today.month, today.day)
        start_of_month = datetime(today.year, today.month, 1)

        # ---------------------------------------------
        # 1. KPI CARDS SUMS
        # ---------------------------------------------
        # Today's Sales
        stmt_today = select(func.sum(Invoice.total_amount)).filter(Invoice.date >= start_of_today)
        if branch_id:
            stmt_today = stmt_today.filter(Invoice.branch_id == branch_id)
        q_today = await db.execute(stmt_today)
        today_sales = q_today.scalar() or 0.0

        # Monthly Sales
        stmt_month = select(func.sum(Invoice.total_amount)).filter(Invoice.date >= start_of_month)
        if branch_id:
            stmt_month = stmt_month.filter(Invoice.branch_id == branch_id)
        q_month = await db.execute(stmt_month)
        monthly_sales = q_month.scalar() or 0.0

        # Outstanding Payments
        stmt_out = select(func.sum(Invoice.total_amount)).filter(Invoice.status != "Paid")
        if branch_id:
            stmt_out = stmt_out.filter(Invoice.branch_id == branch_id)
        q_out = await db.execute(stmt_out)
        outstanding = q_out.scalar() or 0.0

        # Low Stock count
        # Select products where min_stock_level > current_stock
        stmt_low = select(func.count(Product.id)).outerjoin(
            CurrentStock, and_(CurrentStock.product_id == Product.id, CurrentStock.branch_id == branch_id) if branch_id else CurrentStock.product_id == Product.id
        ).filter(Product.min_stock_level > func.coalesce(CurrentStock.qty, 0.0))
        q_low = await db.execute(stmt_low)
        low_stock = q_low.scalar() or 0

        kpis = KPICardsOut(
            today_sales=today_sales,
            monthly_sales=monthly_sales,
            outstanding_payments=outstanding,
            low_stock_count=low_stock
        )

        # ---------------------------------------------
        # 2. SALES BY CATEGORY PIE CHART
        # ---------------------------------------------
        stmt_cat = (
            select(ProductCategory.name, func.sum(InvoiceItem.amount))
            .join(Product, Product.category_id == ProductCategory.id)
            .join(InvoiceItem, InvoiceItem.product_id == Product.id)
            .join(Invoice, Invoice.id == InvoiceItem.invoice_id)
        )
        if branch_id:
            stmt_cat = stmt_cat.filter(Invoice.branch_id == branch_id)
        stmt_cat = stmt_cat.group_by(ProductCategory.name)
        q_cat = await db.execute(stmt_cat)
        
        sales_by_category = [
            SalesByCategoryOut(category_name=row[0], total_sales=row[1] or 0.0)
            for row in q_cat.all()
        ]

        # ---------------------------------------------
        # 3. MONTHLY SALES TREND (LAST 12 MONTHS)
        # ---------------------------------------------
        # In a real system, we'd group by month using dates. Let's return realistic aggregated metrics.
        monthly_sales_trend = []
        months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        
        # Pull invoice sums grouped by month
        for idx, m_name in enumerate(months):
            stmt_trend = select(func.sum(Invoice.total_amount)).filter(func.extract('month', Invoice.date) == (idx + 1))
            if branch_id:
                stmt_trend = stmt_trend.filter(Invoice.branch_id == branch_id)
            q_trend = await db.execute(stmt_trend)
            monthly_sales_trend.append(
                MonthlySalesTrendOut(month=m_name, sales=q_trend.scalar() or 0.0)
            )

        # ---------------------------------------------
        # 4. TOP 10 PRODUCTS BY SALES VOLUME
        # ---------------------------------------------
        stmt_top = (
            select(Product.name, Product.sku, func.sum(InvoiceItem.qty), func.sum(InvoiceItem.amount))
            .join(InvoiceItem, InvoiceItem.product_id == Product.id)
            .join(Invoice, Invoice.id == InvoiceItem.invoice_id)
        )
        if branch_id:
            stmt_top = stmt_top.filter(Invoice.branch_id == branch_id)
        stmt_top = stmt_top.group_by(Product.name, Product.sku).order_by(func.sum(InvoiceItem.amount).desc()).limit(10)
        q_top = await db.execute(stmt_top)
        
        top_products = [
            TopProductSalesOut(product_name=row[0], sku=row[1], qty_sold=row[2] or 0.0, total_revenue=row[3] or 0.0)
            for row in q_top.all()
        ]

        # ---------------------------------------------
        # 5. RECENT TRANSACTIONS LOG
        # ---------------------------------------------
        # Fetch last 5 Sales Orders
        stmt_so = select(SalesOrder).options(selectinload(SalesOrder.customer)).order_by(SalesOrder.date.desc()).limit(5)
        if branch_id:
            stmt_so = stmt_so.filter(SalesOrder.branch_id == branch_id)
        q_so = await db.execute(stmt_so)
        
        # Fetch last 5 Purchase Orders
        stmt_po = select(PurchaseOrder).options(selectinload(PurchaseOrder.supplier)).order_by(PurchaseOrder.date.desc()).limit(5)
        if branch_id:
            stmt_po = stmt_po.filter(PurchaseOrder.branch_id == branch_id)
        q_po = await db.execute(stmt_po)

        recent_txs = []
        for so in q_so.scalars().all():
            recent_txs.append(
                RecentTransactionOut(
                    id=so.id,
                    tx_type="Sales Order",
                    reference_no=f"SO-{so.id.hex[:6].upper()}",
                    party_name=so.customer.name,
                    date=so.date,
                    amount=so.grand_total,
                    status=so.status
                )
            )
        
        for po in q_po.scalars().all():
            recent_txs.append(
                RecentTransactionOut(
                    id=po.id,
                    tx_type="Purchase Order",
                    reference_no=f"PO-{po.id.hex[:6].upper()}",
                    party_name=po.supplier.name,
                    date=po.date,
                    amount=po.grand_total,
                    status=po.status
                )
            )
        
        # Sort combined list by date desc
        recent_txs.sort(key=lambda x: x.date, reverse=True)
        recent_transactions = recent_txs[:10]

        return DashboardResponse(
            kpis=kpis,
            sales_by_category=sales_by_category,
            monthly_sales_trend=monthly_sales_trend,
            top_products=top_products,
            recent_transactions=recent_transactions
        )

    @staticmethod
    async def get_customer_ledger(
        db: AsyncSession,
        customer_id: UUID,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> CustomerLedgerResponse:
        # 1. Parse start and end datetimes
        start_dt = None
        end_dt = None
        if start_date:
            try:
                if len(start_date) == 7:
                    start_dt = datetime.strptime(start_date, "%Y-%m")
                else:
                    start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            except Exception:
                pass
        if end_date:
            try:
                if len(end_date) == 7:
                    year, month = map(int, end_date.split("-"))
                    if month == 12:
                        end_dt = datetime(year + 1, 1, 1) - timedelta(seconds=1)
                    else:
                        end_dt = datetime(year, month + 1, 1) - timedelta(seconds=1)
                else:
                    end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1) - timedelta(seconds=1)
            except Exception:
                pass

        # 2. Fetch Invoices
        stmt_inv = select(Invoice).filter(Invoice.customer_id == customer_id, Invoice.status != "Cancelled")
        if start_dt:
            stmt_inv = stmt_inv.filter(Invoice.date >= start_dt)
        if end_dt:
            stmt_inv = stmt_inv.filter(Invoice.date <= end_dt)
        q_inv = await db.execute(stmt_inv.order_by(Invoice.date.asc()))
        invoices = q_inv.scalars().all()

        # 3. Fetch Payments
        stmt_pay = select(Payment).filter(Payment.customer_id == customer_id)
        if start_dt:
            stmt_pay = stmt_pay.filter(Payment.payment_date >= start_dt)
        if end_dt:
            stmt_pay = stmt_pay.filter(Payment.payment_date <= end_dt)
        q_pay = await db.execute(stmt_pay.order_by(Payment.payment_date.asc()))
        payments = q_pay.scalars().all()

        # 4. Merge entries chronologically
        entries = []
        for inv in invoices:
            entries.append({
                "date": inv.date,
                "tx_type": "Invoice",
                "reference_no": inv.invoice_number,
                "debit": inv.total_amount,
                "credit": 0.0
            })
        for pay in payments:
            entries.append({
                "date": pay.payment_date,
                "tx_type": "Payment",
                "reference_no": pay.reference_number or "N/A",
                "debit": 0.0,
                "credit": pay.amount_paid
            })

        # Sort entries by date
        entries.sort(key=lambda x: x["date"])

        # Calculate running balance and totals
        total_billed = 0.0
        total_paid = 0.0
        running_balance = 0.0
        ledger_entries = []

        for e in entries:
            debit = e["debit"]
            credit = e["credit"]
            total_billed += debit
            total_paid += credit
            running_balance += (debit - credit)
            ledger_entries.append(
                LedgerEntry(
                    date=e["date"],
                    tx_type=e["tx_type"],
                    reference_no=e["reference_no"],
                    debit=debit,
                    credit=credit,
                    running_balance=running_balance
                )
            )

        return CustomerLedgerResponse(
            total_billed=total_billed,
            total_paid=total_paid,
            balance=running_balance,
            transactions=ledger_entries
        )

    @staticmethod
    async def get_supplier_ledger(
        db: AsyncSession,
        supplier_id: UUID,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> SupplierLedgerResponse:
        # 1. Parse start and end datetimes
        start_dt = None
        end_dt = None
        if start_date:
            try:
                if len(start_date) == 7:
                    start_dt = datetime.strptime(start_date, "%Y-%m")
                else:
                    start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            except Exception:
                pass
        if end_date:
            try:
                if len(end_date) == 7:
                    year, month = map(int, end_date.split("-"))
                    if month == 12:
                        end_dt = datetime(year + 1, 1, 1) - timedelta(seconds=1)
                    else:
                        end_dt = datetime(year, month + 1, 1) - timedelta(seconds=1)
                else:
                    end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1) - timedelta(seconds=1)
            except Exception:
                pass

        # 2. Fetch Bills (PurchaseEntry)
        stmt_bills = select(PurchaseEntry).filter(PurchaseEntry.supplier_id == supplier_id, PurchaseEntry.status != "Cancelled")
        if start_dt:
            stmt_bills = stmt_bills.filter(PurchaseEntry.billing_date >= start_dt)
        if end_dt:
            stmt_bills = stmt_bills.filter(PurchaseEntry.billing_date <= end_dt)
        q_bills = await db.execute(stmt_bills.order_by(PurchaseEntry.billing_date.asc()))
        bills = q_bills.scalars().all()

        # 3. Construct ledger entries
        entries = []
        for bill in bills:
            paid_amt = bill.total_amount if bill.status == "Paid" else 0.0
            entries.append({
                "date": bill.billing_date,
                "tx_type": "Purchase Bill",
                "reference_no": bill.invoice_number,
                "debit": bill.total_amount,
                "credit": paid_amt
            })

        # Sort entries by date
        entries.sort(key=lambda x: x["date"])

        total_purchased = 0.0
        total_paid = 0.0
        running_balance = 0.0
        ledger_entries = []

        for e in entries:
            debit = e["debit"]
            credit = e["credit"]
            total_purchased += debit
            total_paid += credit
            running_balance += (debit - credit)
            ledger_entries.append(
                LedgerEntry(
                    date=e["date"],
                    tx_type=e["tx_type"],
                    reference_no=e["reference_no"],
                    debit=debit,
                    credit=credit,
                    running_balance=running_balance
                )
            )

        return SupplierLedgerResponse(
            total_purchased=total_purchased,
            total_paid=total_paid,
            balance=running_balance,
            transactions=ledger_entries
        )
