from datetime import datetime
from typing import List, Optional
from uuid import UUID, uuid4
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.models.auth import User
from app.models.business import Customer, Supplier, Branch, Company
from app.models.product import Product
from app.models.purchase import PurchaseOrder, PurchaseOrderItem, GRN, GRNItem, PurchaseEntry
from app.models.inventory import StockTransaction, CurrentStock
from app.models.sales import SalesOrder, SalesOrderItem, Invoice, InvoiceItem, Delivery
from app.models.finance import Payment, PaymentReceipt
from app.schemas.transaction import (
    PurchaseOrderCreate, GRNCreate, PurchaseEntryCreate,
    StockTransactionCreate, SalesOrderCreate, InvoiceCreate,
    DeliveryCreate, PaymentCreate
)


class TxServices:
    # ==========================================
    # CORE STOCK HELPER METHODS
    # ==========================================
    @staticmethod
    async def update_stock(
        db: AsyncSession,
        product_id: UUID,
        branch_id: UUID,
        qty_change: float,  # Positive for addition, negative for deduction
        tx_type: str,       # In, Out, Adjustment
        ref_type: str,      # GRN, Sales Delivery, Manual Stock In, etc.
        ref_id: Optional[UUID] = None,
        reason: Optional[str] = None
    ) -> None:
        """Update live CurrentStock and log in StockTransaction log."""
        # 1. Fetch or initialize CurrentStock record
        q_stock = await db.execute(
            select(CurrentStock).filter(
                CurrentStock.product_id == product_id,
                CurrentStock.branch_id == branch_id
            )
        )
        stock = q_stock.scalar_one_or_none()
        if not stock:
            stock = CurrentStock(
                product_id=product_id,
                branch_id=branch_id,
                qty=0.0
            )
            db.add(stock)

        stock.qty += qty_change
        
        if stock.qty < 0:
            # We can log a warning or support negative inventory based on configs,
            # but let's keep a floor of 0 or allow it for flexibility.
            pass
            
        db.add(stock)

        # 2. Write StockTransaction log
        tx = StockTransaction(
            product_id=product_id,
            branch_id=branch_id,
            qty=qty_change,
            transaction_type=tx_type,
            reference_type=ref_type,
            reference_id=ref_id,
            reason=reason,
            date=datetime.utcnow()
        )
        db.add(tx)
        await db.flush()

    # ==========================================
    # PURCHASE SERVICES
    # ==========================================
    @staticmethod
    async def create_purchase_order(db: AsyncSession, po_data: PurchaseOrderCreate) -> PurchaseOrder:
        """Create a Purchase Order and calculate dynamic taxes/totals."""
        po = PurchaseOrder(
            supplier_id=po_data.supplier_id,
            branch_id=po_data.branch_id,
            expected_delivery=po_data.expected_delivery,
            status="Draft",
            total_amount=0.0,
            tax_amount=0.0,
            grand_total=0.0
        )
        db.add(po)
        await db.flush() # Yield PO ID

        total_amount = 0.0
        tax_amount = 0.0

        for item in po_data.items:
            # Fetch product details for validation
            q_p = await db.execute(select(Product).filter(Product.id == item.product_id))
            product = q_p.scalar_one_or_none()
            if not product:
                raise HTTPException(status_code=400, detail="Invalid product ID.")

            item_amount = item.qty * item.rate
            item_tax = item_amount * (item.tax_rate / 100)
            
            total_amount += item_amount
            tax_amount += item_tax

            po_item = PurchaseOrderItem(
                purchase_order_id=po.id,
                product_id=item.product_id,
                qty=item.qty,
                rate=item.rate,
                tax_rate=item.tax_rate,
                tax_amount=item_tax,
                amount=item_amount
            )
            db.add(po_item)

        po.total_amount = total_amount
        po.tax_amount = tax_amount
        po.grand_total = total_amount + tax_amount
        
        db.add(po)
        await db.commit()

        # Re-fetch
        q_final = await db.execute(
            select(PurchaseOrder)
            .filter(PurchaseOrder.id == po.id)
            .options(
                selectinload(PurchaseOrder.supplier),
                selectinload(PurchaseOrder.items).selectinload(PurchaseOrderItem.product)
            )
        )
        o = q_final.scalar_one()
        o.supplier_name = o.supplier.name if o.supplier else "Unknown"
        for item in o.items:
            item.product_name = item.product.name if item.product else "Unknown"
            item.sku = item.product.sku if item.product else ""
        return o

    @staticmethod
    async def list_purchase_orders(db: AsyncSession, branch_id: Optional[UUID] = None) -> List[PurchaseOrder]:
        """Fetch all purchase orders."""
        stmt = (
            select(PurchaseOrder)
            .options(
                selectinload(PurchaseOrder.supplier),
                selectinload(PurchaseOrder.items).selectinload(PurchaseOrderItem.product)
            )
        )
        if branch_id:
            stmt = stmt.filter(PurchaseOrder.branch_id == branch_id)
        query = await db.execute(stmt)
        orders = list(query.scalars().all())
        for o in orders:
            o.supplier_name = o.supplier.name if o.supplier else "Unknown"
            for item in o.items:
                item.product_name = item.product.name if item.product else "Unknown"
                item.sku = item.product.sku if item.product else ""
        return orders

    @staticmethod
    async def create_grn(db: AsyncSession, grn_data: GRNCreate, received_by_id: UUID) -> GRN:
        """Create a GRN, verify linked PO, increment live inventory, and write transaction logs."""
        # Verify PO exists
        q_po = await db.execute(select(PurchaseOrder).filter(PurchaseOrder.id == grn_data.purchase_order_id))
        po = q_po.scalar_one_or_none()
        if not po:
            raise HTTPException(status_code=404, detail="Purchase Order not found.")

        grn = GRN(
            purchase_order_id=grn_data.purchase_order_id,
            branch_id=grn_data.branch_id,
            received_by_id=received_by_id,
            status="Received"
        )
        db.add(grn)
        await db.flush()

        for item in grn_data.items:
            grn_item = GRNItem(
                grn_id=grn.id,
                product_id=item.product_id,
                po_item_id=item.po_item_id,
                qty_ordered=item.qty_ordered,
                qty_received=item.qty_received,
                warehouse_location=item.warehouse_location
            )
            db.add(grn_item)

            # Update inventory real-time!
            await TxServices.update_stock(
                db=db,
                product_id=item.product_id,
                branch_id=grn_data.branch_id,
                qty_change=item.qty_received,
                tx_type="In",
                ref_type="GRN",
                ref_id=grn.id,
                reason=f"Procurement GRN Item. PO Ref: {po.id}"
            )

        # Update PO Status to Confirmed/Received
        po.status = "Received"
        db.add(po)

        await db.commit()
        
        q_final = await db.execute(
            select(GRN)
            .filter(GRN.id == grn.id)
            .options(selectinload(GRN.items))
        )
        return q_final.scalar_one()

    @staticmethod
    async def list_grns(db: AsyncSession, branch_id: Optional[UUID] = None) -> List[GRN]:
        """List GRNs."""
        stmt = select(GRN).options(selectinload(GRN.items))
        if branch_id:
            stmt = stmt.filter(GRN.branch_id == branch_id)
        query = await db.execute(stmt)
        return list(query.scalars().all())

    @staticmethod
    async def create_purchase_entry(db: AsyncSession, entry_data: PurchaseEntryCreate) -> PurchaseEntry:
        """Create a supplier invoice record."""
        entry = PurchaseEntry(**entry_data.model_dump(), status="Unpaid")
        db.add(entry)
        await db.commit()
        
        # Re-fetch with relationship
        q = await db.execute(
            select(PurchaseEntry)
            .filter(PurchaseEntry.id == entry.id)
            .options(selectinload(PurchaseEntry.supplier))
        )
        o = q.scalar_one()
        o.supplier_name = o.supplier.name if o.supplier else "Unknown"
        return o

    @staticmethod
    async def list_purchase_entries(db: AsyncSession, branch_id: Optional[UUID] = None) -> List[PurchaseEntry]:
        """List purchase entries."""
        stmt = select(PurchaseEntry).options(selectinload(PurchaseEntry.supplier))
        if branch_id:
            stmt = stmt.filter(PurchaseEntry.branch_id == branch_id)
        query = await db.execute(stmt)
        entries = list(query.scalars().all())
        for e in entries:
            e.supplier_name = e.supplier.name if e.supplier else "Unknown"
        return entries

    # ==========================================
    # INVENTORY SERVICES
    # ==========================================
    @staticmethod
    async def get_current_stock(db: AsyncSession, branch_id: Optional[UUID] = None) -> List[CurrentStock]:
        """List current stock positions per product, per branch."""
        stmt = select(CurrentStock).options(selectinload(CurrentStock.product))
        if branch_id:
            stmt = stmt.filter(CurrentStock.branch_id == branch_id)
        query = await db.execute(stmt)
        return list(query.scalars().all())

    @staticmethod
    async def get_stock_movement(db: AsyncSession, product_id: Optional[UUID] = None) -> List[StockTransaction]:
        """Fetch stock ledger history."""
        stmt = select(StockTransaction).options(selectinload(StockTransaction.product)).order_by(StockTransaction.date.desc())
        if product_id:
            stmt = stmt.filter(StockTransaction.product_id == product_id)
        query = await db.execute(stmt)
        return list(query.scalars().all())

    @staticmethod
    async def manual_stock_transaction(db: AsyncSession, tx_data: StockTransactionCreate) -> CurrentStock:
        """Execute a manual inventory addition, reduction, or adjustment."""
        # 1. Fetch current stock
        q_stock = await db.execute(
            select(CurrentStock).filter(
                CurrentStock.product_id == tx_data.product_id,
                CurrentStock.branch_id == tx_data.branch_id
            )
        )
        stock = q_stock.scalar_one_or_none()

        if tx_data.transaction_type == "Adjustment":
            # Target count correction
            current_qty = stock.qty if stock else 0.0
            qty_variance = tx_data.qty - current_qty
            await TxServices.update_stock(
                db=db,
                product_id=tx_data.product_id,
                branch_id=tx_data.branch_id,
                qty_change=qty_variance,
                tx_type="Adjustment",
                ref_type="Manual Adjustment",
                reason=tx_data.reason or f"Inventory stock adjustment correction."
            )
        else:
            # Standard In/Out
            await TxServices.update_stock(
                db=db,
                product_id=tx_data.product_id,
                branch_id=tx_data.branch_id,
                qty_change=tx_data.qty if tx_data.transaction_type == "In" else -tx_data.qty,
                tx_type=tx_data.transaction_type,
                ref_type="Manual Transaction",
                reason=tx_data.reason or f"Manual Stock {tx_data.transaction_type}"
            )

        await db.commit()

        # Re-fetch stock
        q_stock = await db.execute(
            select(CurrentStock)
            .filter(
                CurrentStock.product_id == tx_data.product_id,
                CurrentStock.branch_id == tx_data.branch_id
            )
            .options(selectinload(CurrentStock.product))
        )
        return q_stock.scalar_one()

    # ==========================================
    # SALES SERVICES
    # ==========================================
    @staticmethod
    async def create_sales_order(db: AsyncSession, so_data: SalesOrderCreate) -> SalesOrder:
        """Create a Sales Order with tax/discount sums."""
        so = SalesOrder(
            customer_id=so_data.customer_id,
            branch_id=so_data.branch_id,
            status="Draft",
            total_amount=0.0,
            tax_amount=0.0,
            discount_amount=0.0,
            grand_total=0.0
        )
        db.add(so)
        await db.flush()

        total_amount = 0.0
        tax_amount = 0.0
        discount_amount = 0.0

        for item in so_data.items:
            q_p = await db.execute(select(Product).filter(Product.id == item.product_id))
            product = q_p.scalar_one_or_none()
            if not product:
                raise HTTPException(status_code=400, detail="Invalid product ID.")

            item_amount = item.qty * item.rate
            item_tax = (item_amount - item.discount_amount) * (item.tax_rate / 100)
            
            total_amount += item_amount
            tax_amount += item_tax
            discount_amount += item.discount_amount

            so_item = SalesOrderItem(
                sales_order_id=so.id,
                product_id=item.product_id,
                qty=item.qty,
                rate=item.rate,
                discount_amount=item.discount_amount,
                tax_rate=item.tax_rate,
                tax_amount=item_tax,
                amount=item_amount - item.discount_amount
            )
            db.add(so_item)

        so.total_amount = total_amount
        so.tax_amount = tax_amount
        so.discount_amount = discount_amount
        so.grand_total = total_amount - discount_amount + tax_amount

        db.add(so)
        await db.commit()

        # Re-fetch
        q_final = await db.execute(
            select(SalesOrder)
            .filter(SalesOrder.id == so.id)
            .options(
                selectinload(SalesOrder.customer),
                selectinload(SalesOrder.items).selectinload(SalesOrderItem.product)
            )
        )
        o = q_final.scalar_one()
        o.customer_name = o.customer.name if o.customer else "Unknown"
        for item in o.items:
            item.product_name = item.product.name if item.product else "Unknown"
            item.sku = item.product.sku if item.product else ""
        return o

    @staticmethod
    async def list_sales_orders(db: AsyncSession, branch_id: Optional[UUID] = None) -> List[SalesOrder]:
        """Fetch all sales orders."""
        stmt = (
            select(SalesOrder)
            .options(
                selectinload(SalesOrder.customer),
                selectinload(SalesOrder.items).selectinload(SalesOrderItem.product)
            )
        )
        if branch_id:
            stmt = stmt.filter(SalesOrder.branch_id == branch_id)
        query = await db.execute(stmt)
        orders = list(query.scalars().all())
        for o in orders:
            o.customer_name = o.customer.name if o.customer else "Unknown"
            for item in o.items:
                item.product_name = item.product.name if item.product else "Unknown"
                item.sku = item.product.sku if item.product else ""
        return orders

    @staticmethod
    async def create_delivery(db: AsyncSession, delivery_data: DeliveryCreate) -> Delivery:
        """Create delivery tracking, reduce active stock, and log transaction movements."""
        q_so = await db.execute(
            select(SalesOrder)
            .filter(SalesOrder.id == delivery_data.sales_order_id)
            .options(selectinload(SalesOrder.items))
        )
        so = q_so.scalar_one_or_none()
        if not so:
            raise HTTPException(status_code=404, detail="Sales Order not found.")

        # Create Delivery
        delivery = Delivery(
            sales_order_id=delivery_data.sales_order_id,
            delivery_note=delivery_data.delivery_note,
            status="Delivered",
            qty_delivered=delivery_data.qty_delivered
        )
        db.add(delivery)
        await db.flush()

        # Decrement stocks for each item in the Sales Order!
        for item in so.items:
            await TxServices.update_stock(
                db=db,
                product_id=item.product_id,
                branch_id=so.branch_id,
                qty_change=-item.qty,  # Subtract
                tx_type="Out",
                ref_type="Sales Delivery",
                ref_id=delivery.id,
                reason=f"Fulfillment for Sales Order: {so.id}"
            )

        so.status = "Delivered"
        db.add(so)

        await db.commit()
        await db.refresh(delivery)
        return delivery

    @staticmethod
    async def list_deliveries(db: AsyncSession) -> List[Delivery]:
        """List deliveries."""
        query = await db.execute(select(Delivery))
        return list(query.scalars().all())

    @staticmethod
    async def create_invoice(db: AsyncSession, inv_data: InvoiceCreate) -> Invoice:
        """
        Create a Tax Invoice from a Sales Order.
        Auto-generates sequential invoice numbers and calculates GST breakup (CGST+SGST or IGST).
        """
        # Fetch Sales Order
        q_so = await db.execute(
            select(SalesOrder)
            .filter(SalesOrder.id == inv_data.sales_order_id)
            .options(selectinload(SalesOrder.items))
        )
        so = q_so.scalar_one_or_none()
        if not so:
            raise HTTPException(status_code=404, detail="Sales Order not found.")

        # Auto-fulfill/deliver if not already delivered to maintain inventory integrity
        if so.status != "Delivered":
            # Create Delivery record to decrement stock
            delivery = Delivery(
                sales_order_id=so.id,
                delivery_note="Auto-delivered on Invoice generation",
                status="Delivered",
                qty_delivered=sum(item.qty for item in so.items)
            )
            db.add(delivery)
            await db.flush()

            # Decrement stocks for each item in the Sales Order
            for item in so.items:
                await TxServices.update_stock(
                    db=db,
                    product_id=item.product_id,
                    branch_id=so.branch_id,
                    qty_change=-item.qty,  # Subtract
                    tx_type="Out",
                    ref_type="Sales Delivery",
                    ref_id=delivery.id,
                    reason=f"Auto-fulfillment on Invoice generation: {so.id}"
                )
            so.status = "Delivered"
            db.add(so)

        # Fetch Branch to get Invoice Config and update sequences
        q_br = await db.execute(select(Branch).filter(Branch.id == so.branch_id))
        branch = q_br.scalar_one_or_none()
        if not branch:
            raise HTTPException(status_code=400, detail="Branch not found.")

        # Fetch Customer and Company for state code matching in GST
        q_cust = await db.execute(select(Customer).filter(Customer.id == so.customer_id))
        customer = q_cust.scalar_one_or_none()

        q_comp = await db.execute(select(Company).filter(Company.id == branch.company_id))
        company = q_comp.scalar_one_or_none()

        # Generate Invoice Number
        invoice_seq = branch.invoice_next_number
        branch.invoice_next_number += 1
        db.add(branch)

        # E.g. INV-00005
        invoice_no = f"{branch.invoice_prefix}{invoice_seq:05d}"

        # ---------------------------------------------
        # GST BREAKUP CALCULATION
        # Match company GSTIN state code (first 2 digits)
        # with customer GSTIN state code.
        # ---------------------------------------------
        cgst = 0.0
        sgst = 0.0
        igst = 0.0

        company_state = company.gstin[:2] if company and company.gstin else "22"
        customer_state = customer.gstin[:2] if customer and customer.gstin else "22"

        if company_state == customer_state:
            # Intra-state sales -> CGST (9%) + SGST (9%)
            cgst = so.tax_amount / 2
            sgst = so.tax_amount / 2
        else:
            # Inter-state sales -> IGST (18%)
            igst = so.tax_amount

        gst_breakup = {"cgst": cgst, "sgst": sgst, "igst": igst}

        # Create Invoice record
        invoice = Invoice(
            sales_order_id=so.id,
            branch_id=so.branch_id,
            invoice_number=invoice_no,
            date=datetime.utcnow(),
            due_date=inv_data.due_date,
            gst_breakup=gst_breakup,
            subtotal=so.total_amount,
            tax_amount=so.tax_amount,
            discount_amount=so.discount_amount,
            total_amount=so.grand_total,
            status="Unpaid"
        )
        db.add(invoice)
        await db.flush()

        # Clone items from Sales Order to Invoice Items
        for item in so.items:
            inv_item = InvoiceItem(
                invoice_id=invoice.id,
                product_id=item.product_id,
                qty=item.qty,
                rate=item.rate,
                discount_amount=item.discount_amount,
                tax_rate=item.tax_rate,
                tax_amount=item.tax_amount,
                amount=item.amount
            )
            db.add(inv_item)

        await db.commit()

        # Re-fetch
        q_final = await db.execute(
            select(Invoice)
            .filter(Invoice.id == invoice.id)
            .options(
                selectinload(Invoice.items).selectinload(InvoiceItem.product),
                selectinload(Invoice.sales_order).selectinload(SalesOrder.customer)
            )
        )
        inv = q_final.scalar_one()
        if inv.sales_order and inv.sales_order.customer:
            inv.customer_name = inv.sales_order.customer.name
            inv.customer_id = inv.sales_order.customer.id
            inv.customer_gstin = inv.sales_order.customer.gstin
            inv.customer_billing_address = inv.sales_order.customer.billing_address
            inv.customer_shipping_address = inv.sales_order.customer.shipping_address
        for item in inv.items:
            item.product_name = item.product.name if item.product else "Unknown"
            item.sku = item.product.sku if item.product else ""
            item.hsn_code = item.product.hsn_code if item.product else ""
        return inv

    @staticmethod
    async def list_invoices(db: AsyncSession, branch_id: Optional[UUID] = None) -> List[Invoice]:
        """Fetch all invoices."""
        stmt = (
            select(Invoice)
            .options(
                selectinload(Invoice.items).selectinload(InvoiceItem.product),
                selectinload(Invoice.sales_order).selectinload(SalesOrder.customer)
            )
        )
        if branch_id:
            stmt = stmt.filter(Invoice.branch_id == branch_id)
        query = await db.execute(stmt)
        invoices = list(query.scalars().all())
        for inv in invoices:
            if inv.sales_order and inv.sales_order.customer:
                inv.customer_name = inv.sales_order.customer.name
                inv.customer_id = inv.sales_order.customer.id
                inv.customer_gstin = inv.sales_order.customer.gstin
                inv.customer_billing_address = inv.sales_order.customer.billing_address
                inv.customer_shipping_address = inv.sales_order.customer.shipping_address
            else:
                inv.customer_name = "Unknown"
                inv.customer_id = None
                inv.customer_gstin = None
                inv.customer_billing_address = None
                inv.customer_shipping_address = None
            for item in inv.items:
                item.product_name = item.product.name if item.product else "Unknown"
                item.sku = item.product.sku if item.product else ""
                item.hsn_code = item.product.hsn_code if item.product else ""
        return invoices

    # ==========================================
    # PAYMENTS & RECEIPT SERVICES
    # ==========================================
    @staticmethod
    async def list_outstanding_invoices(db: AsyncSession, customer_id: Optional[UUID] = None) -> List[Invoice]:
        """Fetch unpaid or partially paid invoices."""
        stmt = (
            select(Invoice)
            .filter(Invoice.status.in_(["Unpaid", "PartiallyPaid"]))
            .options(
                selectinload(Invoice.items).selectinload(InvoiceItem.product),
                selectinload(Invoice.sales_order).selectinload(SalesOrder.customer)
            )
        )
        if customer_id:
            stmt = stmt.join(SalesOrder).filter(SalesOrder.customer_id == customer_id)
        query = await db.execute(stmt)
        invoices = list(query.scalars().all())
        for inv in invoices:
            if inv.sales_order and inv.sales_order.customer:
                inv.customer_name = inv.sales_order.customer.name
                inv.customer_id = inv.sales_order.customer.id
                inv.customer_gstin = inv.sales_order.customer.gstin
                inv.customer_billing_address = inv.sales_order.customer.billing_address
                inv.customer_shipping_address = inv.sales_order.customer.shipping_address
            else:
                inv.customer_name = "Unknown"
                inv.customer_id = None
                inv.customer_gstin = None
                inv.customer_billing_address = None
                inv.customer_shipping_address = None
            for item in inv.items:
                item.product_name = item.product.name if item.product else "Unknown"
                item.sku = item.product.sku if item.product else ""
        return invoices

    @staticmethod
    async def create_payment(db: AsyncSession, pay_data: PaymentCreate) -> Payment:
        """
        Record a customer payment against an invoice.
        Creates a Payment log, updates invoice status (Paid/PartiallyPaid), and auto-generates a receipt.
        """
        invoice = None
        if pay_data.invoice_id:
            q_inv = await db.execute(
                select(Invoice)
                .filter(Invoice.id == pay_data.invoice_id)
                .options(selectinload(Invoice.payments))
            )
            invoice = q_inv.scalar_one_or_none()
            if not invoice:
                raise HTTPException(status_code=404, detail="Invoice not found.")

        # Create Payment record
        payment = Payment(**pay_data.model_dump())
        db.add(payment)
        await db.flush()

        # Update Invoice Status
        if invoice:
            total_paid = sum([p.amount_paid for p in invoice.payments]) + pay_data.amount_paid
            if total_paid >= invoice.total_amount:
                invoice.status = "Paid"
            elif total_paid > 0:
                invoice.status = "PartiallyPaid"
            db.add(invoice)

        # Auto-generate Receipt Number
        q_count = await db.execute(select(PaymentReceipt))
        receipt_seq = len(q_count.scalars().all()) + 1
        rcpt_no = f"RCPT-{receipt_seq:05d}"

        # Create Receipt record
        receipt = PaymentReceipt(
            payment_id=payment.id,
            receipt_number=rcpt_no,
            printed_at=datetime.utcnow()
        )
        db.add(receipt)

        await db.commit()
        await db.refresh(payment)
        return payment

    @staticmethod
    async def get_receipt(db: AsyncSession, payment_id: UUID) -> PaymentReceipt:
        """Fetch receipt by payment ID."""
        query = await db.execute(
            select(PaymentReceipt)
            .filter(PaymentReceipt.payment_id == payment_id)
            .options(selectinload(PaymentReceipt.payment))
        )
        receipt = query.scalar_one_or_none()
        if not receipt:
            raise HTTPException(status_code=404, detail="Receipt not found.")
        return receipt

    @staticmethod
    async def list_payments(db: AsyncSession, customer_id: Optional[UUID] = None) -> List[Payment]:
        """List all customer payments with nested relationships resolved."""
        query = (
            select(Payment)
            .options(
                selectinload(Payment.customer),
                selectinload(Payment.invoice),
                selectinload(Payment.receipts)
            )
        )
        if customer_id:
            query = query.filter(Payment.customer_id == customer_id)
        
        query = query.order_by(Payment.payment_date.desc())
        
        result = await db.execute(query)
        payments = list(result.scalars().all())
        
        for p in payments:
            p.customer_name = p.customer.name if p.customer else "Unknown"
            p.invoice_number = p.invoice.invoice_number if p.invoice else None
            p.receipt_number = p.receipts[0].receipt_number if p.receipts else None
            
        return payments

