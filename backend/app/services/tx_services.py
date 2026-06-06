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
from app.models.inventory import StockTransaction, CurrentStock, StockTransfer, StockTransferItem
from app.models.sales import SalesOrder, SalesOrderItem, Invoice, InvoiceItem
from app.models.finance import Payment, PaymentReceipt
from app.schemas.transaction import (
    PurchaseOrderCreate, GRNCreate, PurchaseEntryCreate,
    StockTransactionCreate, SalesOrderCreate, InvoiceCreate,
    PaymentCreate, StockTransferCreate
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
        q_br = await db.execute(select(Branch).filter(Branch.id == po_data.branch_id))
        branch = q_br.scalar_one_or_none()
        if not branch:
            raise HTTPException(status_code=400, detail="Branch not found.")
            
        po_seq = branch.po_next_number
        branch.po_next_number += 1
        db.add(branch)
        
        po_no = f"{branch.po_prefix}{po_seq:05d}{branch.po_suffix}"

        po = PurchaseOrder(
            supplier_id=po_data.supplier_id,
            branch_id=po_data.branch_id,
            po_number=po_no,
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
    async def update_purchase_order(db: AsyncSession, po_id: UUID, po_data: PurchaseOrderCreate) -> PurchaseOrder:
        """Update a Purchase Order, clear old items, and recalculate totals."""
        q_po = await db.execute(select(PurchaseOrder).filter(PurchaseOrder.id == po_id))
        po = q_po.scalar_one_or_none()
        if not po:
            raise HTTPException(status_code=404, detail="Purchase Order not found.")
        
        if po.status != "Draft":
            raise HTTPException(status_code=400, detail="Only Draft Purchase Orders can be edited.")
        
        po.supplier_id = po_data.supplier_id
        po.branch_id = po_data.branch_id
        po.expected_delivery = po_data.expected_delivery

        from sqlalchemy import delete
        await db.execute(delete(PurchaseOrderItem).filter(PurchaseOrderItem.purchase_order_id == po_id))
        
        total_amount = 0.0
        tax_amount = 0.0

        for item in po_data.items:
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
    async def create_grn(db: AsyncSession, grn_data: GRNCreate, received_by_id: UUID) -> GRN:
        """Create a GRN, verify linked PO, increment live inventory, and write transaction logs."""
        # Verify PO exists
        q_po = await db.execute(select(PurchaseOrder).filter(PurchaseOrder.id == grn_data.purchase_order_id))
        po = q_po.scalar_one_or_none()
        if not po:
            raise HTTPException(status_code=404, detail="Purchase Order not found.")

        q_br = await db.execute(select(Branch).filter(Branch.id == grn_data.branch_id))
        branch = q_br.scalar_one_or_none()
        if not branch:
            raise HTTPException(status_code=400, detail="Branch not found.")
            
        grn_seq = branch.grn_next_number
        branch.grn_next_number += 1
        db.add(branch)
        
        grn_no = f"{branch.grn_prefix}{grn_seq:05d}{branch.grn_suffix}"

        grn = GRN(
            purchase_order_id=grn_data.purchase_order_id,
            branch_id=grn_data.branch_id,
            grn_number=grn_no,
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
            .options(selectinload(GRN.items), selectinload(GRN.purchase_order))
        )
        return q_final.scalar_one()

    @staticmethod
    async def list_grns(db: AsyncSession, branch_id: Optional[UUID] = None) -> List[GRN]:
        """List GRNs."""
        stmt = select(GRN).options(selectinload(GRN.items), selectinload(GRN.purchase_order))
        if branch_id:
            stmt = stmt.filter(GRN.branch_id == branch_id)
        query = await db.execute(stmt)
        return list(query.scalars().all())

    @staticmethod
    async def create_purchase_entry(db: AsyncSession, entry_data: PurchaseEntryCreate) -> PurchaseEntry:
        """Create a supplier invoice record."""
        # Check if a purchase bill already exists for this GRN
        if entry_data.grn_id:
            q_existing = await db.execute(
                select(PurchaseEntry).filter(
                    PurchaseEntry.grn_id == entry_data.grn_id,
                    PurchaseEntry.status != "Cancelled"
                )
            )
            existing = q_existing.scalars().first()
            if existing:
                raise HTTPException(status_code=400, detail="A purchase bill already exists for this GRN.")

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
        q_br = await db.execute(select(Branch).filter(Branch.id == so_data.branch_id))
        branch = q_br.scalar_one_or_none()
        if not branch:
            raise HTTPException(status_code=400, detail="Branch not found.")
            
        so_seq = branch.so_next_number
        branch.so_next_number += 1
        db.add(branch)
        
        so_no = f"{branch.so_prefix}{so_seq:05d}{branch.so_suffix}"

        so = SalesOrder(
            customer_id=so_data.customer_id,
            branch_id=so_data.branch_id,
            so_number=so_no,
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
        o.customer_gstin = o.customer.gstin if o.customer else None
        o.customer_billing_address = o.customer.billing_address if o.customer else None
        o.customer_shipping_address = o.customer.shipping_address if o.customer else None
        for item in o.items:
            item.product_name = item.product.name if item.product else "Unknown"
            item.sku = item.product.sku if item.product else ""
            item.hsn_code = item.product.hsn_code if item.product else ""
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
            o.customer_gstin = o.customer.gstin if o.customer else None
            o.customer_billing_address = o.customer.billing_address if o.customer else None
            o.customer_shipping_address = o.customer.shipping_address if o.customer else None
            for item in o.items:
                item.product_name = item.product.name if item.product else "Unknown"
                item.sku = item.product.sku if item.product else ""
                item.hsn_code = item.product.hsn_code if item.product else ""
        return orders

    @staticmethod
    async def update_sales_order(db: AsyncSession, so_id: UUID, so_data: SalesOrderCreate) -> SalesOrder:
        """Update a Sales Order, clear old items, and recalculate totals."""
        q_so = await db.execute(select(SalesOrder).filter(SalesOrder.id == so_id))
        so = q_so.scalar_one_or_none()
        if not so:
            raise HTTPException(status_code=404, detail="Sales Order not found.")
        
        if so.status != "Draft":
            raise HTTPException(status_code=400, detail="Only Draft Sales Orders can be edited.")
        
        so.customer_id = so_data.customer_id
        so.branch_id = so_data.branch_id

        from sqlalchemy import delete
        await db.execute(delete(SalesOrderItem).filter(SalesOrderItem.sales_order_id == so_id))
        
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
        o.customer_gstin = o.customer.gstin if o.customer else None
        o.customer_billing_address = o.customer.billing_address if o.customer else None
        o.customer_shipping_address = o.customer.shipping_address if o.customer else None
        for item in o.items:
            item.product_name = item.product.name if item.product else "Unknown"
            item.sku = item.product.sku if item.product else ""
            item.hsn_code = item.product.hsn_code if item.product else ""
        return o

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

        # Check if we should decrement inventory stock levels (only if not already invoiced/delivered)
        should_decrement_stock = so.status not in ["Delivered", "Invoiced"]
        if inv_data.delivery_challan_id:
            should_decrement_stock = False

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
        invoice_no = f"{branch.invoice_prefix}{invoice_seq:05d}{branch.invoice_suffix}"

        # ---------------------------------------------
        # GST BREAKUP CALCULATION
        # Match company GSTIN state code (first 2 digits)
        # with customer GSTIN state code.
        # ---------------------------------------------
        cgst = 0.0
        sgst = 0.0
        igst = 0.0

        company_state = company.state_code if (company and company.state_code) else (company.gstin[:2] if company and company.gstin else "22")
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
            delivery_challan_id=inv_data.delivery_challan_id,
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

        # Decrement stock directly referencing this invoice if not already processed
        if should_decrement_stock:
            for item in so.items:
                await TxServices.update_stock(
                    db=db,
                    product_id=item.product_id,
                    branch_id=so.branch_id,
                    qty_change=-item.qty,  # Subtract
                    tx_type="Out",
                    ref_type="Invoice",
                    ref_id=invoice.id,
                    reason=f"Stock decrement for Tax Invoice: {invoice_no}"
                )

        # Transition Sales Order status to Invoiced
        so.status = "Invoiced"
        db.add(so)

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
                selectinload(Invoice.sales_order).selectinload(SalesOrder.customer),
                selectinload(Invoice.payments),
                selectinload(Invoice.delivery_challan)
            )
        )
        inv = q_final.scalar_one()
        inv.outstanding_amount = inv.total_amount
        inv.delivery_challan_number = inv.delivery_challan.challan_number if inv.delivery_challan else None
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
                selectinload(Invoice.sales_order).selectinload(SalesOrder.customer),
                selectinload(Invoice.payments),
                selectinload(Invoice.delivery_challan)
            )
        )
        if branch_id:
            stmt = stmt.filter(Invoice.branch_id == branch_id)
        query = await db.execute(stmt)
        invoices = list(query.scalars().all())
        for inv in invoices:
            total_paid = sum([p.amount_paid for p in inv.payments])
            inv.outstanding_amount = max(0.0, inv.total_amount - total_paid)
            inv.delivery_challan_number = inv.delivery_challan.challan_number if inv.delivery_challan else None
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
                selectinload(Invoice.sales_order).selectinload(SalesOrder.customer),
                selectinload(Invoice.payments),
                selectinload(Invoice.delivery_challan)
            )
        )
        if customer_id:
            stmt = stmt.join(SalesOrder).filter(SalesOrder.customer_id == customer_id)
        query = await db.execute(stmt)
        invoices = list(query.scalars().all())
        for inv in invoices:
            total_paid = sum([p.amount_paid for p in inv.payments])
            inv.outstanding_amount = max(0.0, inv.total_amount - total_paid)
            inv.delivery_challan_number = inv.delivery_challan.challan_number if inv.delivery_challan else None
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

        # Configurable receipt number
        branch_id = None
        if invoice:
            branch_id = invoice.branch_id
        else:
            q_cust = await db.execute(select(Customer).filter(Customer.id == pay_data.customer_id))
            customer = q_cust.scalar_one_or_none()
            if customer:
                branch_id = customer.branch_id
        
        if not branch_id:
            q_br = await db.execute(select(Branch))
            branch = q_br.scalars().first()
        else:
            q_br = await db.execute(select(Branch).filter(Branch.id == branch_id))
            branch = q_br.scalar_one_or_none()

        if branch:
            receipt_seq = branch.receipt_next_number
            branch.receipt_next_number += 1
            db.add(branch)
            rcpt_no = f"{branch.receipt_prefix}{receipt_seq:05d}{branch.receipt_suffix}"
        else:
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

    @staticmethod
    async def cancel_sales_order(db: AsyncSession, so_id: UUID) -> SalesOrder:
        """Cancel a Sales Order if it has no active Tax Invoices."""
        q_so = await db.execute(
            select(SalesOrder)
            .filter(SalesOrder.id == so_id)
            .options(selectinload(SalesOrder.invoices))
        )
        so = q_so.scalar_one_or_none()
        if not so:
            raise HTTPException(status_code=404, detail="Sales Order not found.")
        
        # Check if invoices exist (excluding Cancelled ones)
        active_invoices = [inv for inv in so.invoices if inv.status != "Cancelled"]
        if active_invoices:
            raise HTTPException(status_code=400, detail="Cannot cancel Sales Order that has active Tax Invoices. Cancel the Invoices first.")
            
        so.status = "Cancelled"
        db.add(so)
        await db.commit()
        await db.refresh(so)
        return so

    @staticmethod
    async def cancel_invoice(db: AsyncSession, invoice_id: UUID) -> Invoice:
        """Cancel a Tax Invoice, restore linked Sales Order to Draft, and reverse stock changes."""
        q_inv = await db.execute(
            select(Invoice)
            .filter(Invoice.id == invoice_id)
            .options(selectinload(Invoice.payments))
        )
        inv = q_inv.scalar_one_or_none()
        if not inv:
            raise HTTPException(status_code=404, detail="Invoice not found.")
            
        if inv.payments:
            raise HTTPException(status_code=400, detail="Cannot cancel Invoice with recorded payments. Cancel/delete the payments first.")
            
        inv.status = "Cancelled"
        db.add(inv)
        
        # Reset linked sales order status to Draft so it can be re-invoiced
        if inv.sales_order_id:
            q_so = await db.execute(select(SalesOrder).filter(SalesOrder.id == inv.sales_order_id))
            so = q_so.scalar_one_or_none()
            if so:
                so.status = "Draft"
                db.add(so)
                
        # Reverse stock changes
        q_stock = await db.execute(
            select(StockTransaction).filter(
                StockTransaction.reference_type == "Invoice",
                StockTransaction.reference_id == invoice_id
            )
        )
        stock_txs = q_stock.scalars().all()
        for st in stock_txs:
            rev_tx = StockTransaction(
                product_id=st.product_id,
                branch_id=st.branch_id,
                qty=-st.qty,
                transaction_type="Adjustment",
                reference_type="InvoiceCancel",
                reference_id=invoice_id,
                reason=f"Stock reversal for Cancelled Invoice {inv.invoice_number}"
            )
            db.add(rev_tx)
            await TxServices.update_stock(
                db=db,
                product_id=st.product_id,
                branch_id=st.branch_id,
                qty_change=-st.qty,
                tx_type="Adjustment",
                ref_type="InvoiceCancel",
                ref_id=invoice_id,
                reason=f"Stock reversal for Cancelled Invoice {inv.invoice_number}"
            )
            
        await db.commit()
        await db.refresh(inv)
        return inv

    @staticmethod
    async def cancel_purchase_order(db: AsyncSession, po_id: UUID) -> PurchaseOrder:
        """Cancel a Purchase Order if it has no active GRNs."""
        q_po = await db.execute(
            select(PurchaseOrder)
            .filter(PurchaseOrder.id == po_id)
            .options(selectinload(PurchaseOrder.grns))
        )
        po = q_po.scalar_one_or_none()
        if not po:
            raise HTTPException(status_code=404, detail="Purchase Order not found.")
            
        active_grns = [g for g in po.grns if g.status != "Cancelled"]
        if active_grns:
            raise HTTPException(status_code=400, detail="Cannot cancel Purchase Order with linked active GRNs. Cancel the GRNs first.")
            
        po.status = "Cancelled"
        db.add(po)
        await db.commit()
        await db.refresh(po)
        return po

    @staticmethod
    async def cancel_grn(db: AsyncSession, grn_id: UUID) -> GRN:
        """Cancel a GRN, restore linked Purchase Order to Draft, and reverse stock changes."""
        q_grn = await db.execute(
            select(GRN)
            .filter(GRN.id == grn_id)
            .options(selectinload(GRN.purchase_entries), selectinload(GRN.purchase_order))
        )
        grn = q_grn.scalar_one_or_none()
        if not grn:
            raise HTTPException(status_code=404, detail="GRN not found.")
            
        active_entries = [pe for pe in grn.purchase_entries if pe.status != "Cancelled"]
        if active_entries:
            raise HTTPException(status_code=400, detail="Cannot cancel GRN with linked active purchase bills. Cancel the bills first.")
            
        grn.status = "Cancelled"
        db.add(grn)
        
        # Reset linked PO status back to Draft
        if grn.purchase_order_id:
            q_po = await db.execute(select(PurchaseOrder).filter(PurchaseOrder.id == grn.purchase_order_id))
            po = q_po.scalar_one_or_none()
            if po:
                po.status = "Draft"
                db.add(po)
                
        # Reverse stock changes
        q_stock = await db.execute(
            select(StockTransaction).filter(
                StockTransaction.reference_type == "GRN",
                StockTransaction.reference_id == grn_id
            )
        )
        stock_txs = q_stock.scalars().all()
        for st in stock_txs:
            rev_tx = StockTransaction(
                product_id=st.product_id,
                branch_id=st.branch_id,
                qty=-st.qty,
                transaction_type="Adjustment",
                reference_type="GRNCancel",
                reference_id=grn_id,
                reason=f"Stock reversal for Cancelled GRN"
            )
            db.add(rev_tx)
            await TxServices.update_stock(
                db=db,
                product_id=st.product_id,
                branch_id=st.branch_id,
                qty_change=-st.qty,
                tx_type="Adjustment",
                ref_type="GRNCancel",
                ref_id=grn_id,
                reason=f"Stock reversal for Cancelled GRN"
            )
            
        await db.commit()
        await db.refresh(grn)
        return grn

    @staticmethod
    async def cancel_purchase_entry(db: AsyncSession, bill_id: UUID) -> PurchaseEntry:
        """Cancel a Supplier Purchase Bill."""
        q_bill = await db.execute(select(PurchaseEntry).filter(PurchaseEntry.id == bill_id))
        bill = q_bill.scalar_one_or_none()
        if not bill:
            raise HTTPException(status_code=404, detail="Purchase Entry bill not found.")
            
        bill.status = "Cancelled"
        db.add(bill)
        await db.commit()
        await db.refresh(bill)
        return bill

    @staticmethod
    async def cancel_payment(db: AsyncSession, payment_id: UUID) -> None:
        """Cancel a Customer Payment collection and restore invoice status back to Unpaid/Partially Paid."""
        q_pay = await db.execute(
            select(Payment)
            .filter(Payment.id == payment_id)
            .options(selectinload(Payment.invoice))
        )
        payment = q_pay.scalar_one_or_none()
        if not payment:
            raise HTTPException(status_code=404, detail="Payment collection record not found.")
            
        invoice = payment.invoice
        await db.delete(payment)
        await db.flush()
        
        if invoice:
            # Recalculate remaining payments
            q_rem = await db.execute(select(Payment).filter(Payment.invoice_id == invoice.id))
            remaining = q_rem.scalars().all()
            total_paid = sum([p.amount_paid for p in remaining])
            
            if total_paid >= invoice.total_amount:
                invoice.status = "Paid"
            elif total_paid > 0:
                invoice.status = "PartiallyPaid"
            else:
                invoice.status = "Unpaid"
            db.add(invoice)
            
        await db.commit()

    # ==========================================
    # STOCK TRANSFER & DELIVERY CHALLAN SERVICES
    # ==========================================
    @staticmethod
    async def create_stock_transfer(db: AsyncSession, transfer_data: StockTransferCreate) -> StockTransfer:
        """Create a new stock transfer or customer delivery challan in Draft state."""
        if not transfer_data.destination_branch_id and not transfer_data.customer_id:
            raise HTTPException(status_code=400, detail="Either destination branch or customer must be specified.")
        if transfer_data.destination_branch_id and transfer_data.customer_id:
            raise HTTPException(status_code=400, detail="Cannot specify both destination branch and customer.")
        if transfer_data.destination_branch_id == transfer_data.source_branch_id:
            raise HTTPException(status_code=400, detail="Source and destination branches cannot be the same.")
            
        # Configurable challan / delivery challan number
        q_br = await db.execute(select(Branch).filter(Branch.id == transfer_data.source_branch_id))
        branch = q_br.scalar_one_or_none()
        if not branch:
            raise HTTPException(status_code=400, detail="Source branch not found.")
            
        challan_seq = branch.challan_next_number
        branch.challan_next_number += 1
        db.add(branch)
        
        challan_no = f"{branch.challan_prefix}{challan_seq:05d}{branch.challan_suffix}"
        
        transfer = StockTransfer(
            source_branch_id=transfer_data.source_branch_id,
            destination_branch_id=transfer_data.destination_branch_id,
            customer_id=transfer_data.customer_id,
            challan_number=challan_no,
            status="Draft",
            notes=transfer_data.notes,
            total_amount=0.0,
            tax_amount=0.0,
            discount_amount=0.0,
            grand_total=0.0,
            gst_breakup={}
        )
        db.add(transfer)
        await db.flush()
        
        total_amount = 0.0
        tax_amount = 0.0
        discount_amount = 0.0
        
        for item in transfer_data.items:
            # Check if product exists
            q_p = await db.execute(select(Product).filter(Product.id == item.product_id))
            product = q_p.scalar_one_or_none()
            if not product:
                raise HTTPException(status_code=400, detail="Invalid product ID.")
                
            item_amount = item.qty * item.rate
            item_tax = (item_amount - item.discount_amount) * (item.tax_rate / 100)
            
            total_amount += item_amount
            tax_amount += item_tax
            discount_amount += item.discount_amount
            
            transfer_item = StockTransferItem(
                transfer_id=transfer.id,
                product_id=item.product_id,
                qty=item.qty,
                rate=item.rate,
                discount_amount=item.discount_amount,
                tax_rate=item.tax_rate,
                tax_amount=item_tax,
                amount=item_amount - item.discount_amount
            )
            db.add(transfer_item)
            
        # Calculate GST Breakup (Intra-state vs Inter-state)
        cgst = 0.0
        sgst = 0.0
        igst = 0.0
        
        q_src_br = await db.execute(select(Branch).filter(Branch.id == transfer_data.source_branch_id))
        src_branch = q_src_br.scalar_one_or_none()
        
        company_state = "22"
        if src_branch:
            q_comp = await db.execute(select(Company).filter(Company.id == src_branch.company_id))
            company = q_comp.scalar_one_or_none()
            if company:
                company_state = company.state_code if company.state_code else (company.gstin[:2] if company.gstin else "22")
                
        recipient_state = company_state
        if transfer_data.customer_id:
            q_cust = await db.execute(select(Customer).filter(Customer.id == transfer_data.customer_id))
            customer = q_cust.scalar_one_or_none()
            if customer and customer.gstin:
                recipient_state = customer.gstin[:2]
        elif transfer_data.destination_branch_id:
            q_dest_br = await db.execute(select(Branch).filter(Branch.id == transfer_data.destination_branch_id))
            dest_branch = q_dest_br.scalar_one_or_none()
            if dest_branch:
                q_dest_comp = await db.execute(select(Company).filter(Company.id == dest_branch.company_id))
                dest_company = q_dest_comp.scalar_one_or_none()
                if dest_company:
                    recipient_state = dest_company.state_code if dest_company.state_code else (dest_company.gstin[:2] if dest_company.gstin else company_state)

        if company_state == recipient_state:
            cgst = tax_amount / 2
            sgst = tax_amount / 2
        else:
            igst = tax_amount
            
        transfer.total_amount = total_amount
        transfer.tax_amount = tax_amount
        transfer.discount_amount = discount_amount
        transfer.grand_total = total_amount - discount_amount + tax_amount
        transfer.gst_breakup = {"cgst": cgst, "sgst": sgst, "igst": igst}
        
        db.add(transfer)
        await db.commit()
        return await TxServices.get_stock_transfer(db, transfer.id)

    @staticmethod
    async def get_stock_transfer(db: AsyncSession, transfer_id: UUID) -> StockTransfer:
        stmt = (
            select(StockTransfer)
            .filter(StockTransfer.id == transfer_id)
            .options(
                selectinload(StockTransfer.source_branch),
                selectinload(StockTransfer.destination_branch),
                selectinload(StockTransfer.customer),
                selectinload(StockTransfer.items).selectinload(StockTransferItem.product)
            )
        )
        q = await db.execute(stmt)
        t = q.scalar_one_or_none()
        if not t:
            raise HTTPException(status_code=404, detail="Stock Transfer / Delivery Challan not found.")
            
        t.source_branch_name = t.source_branch.branch_name if t.source_branch else "Unknown"
        t.destination_branch_name = t.destination_branch.branch_name if t.destination_branch else None
        t.customer_name = t.customer.name if t.customer else None
        for item in t.items:
            item.product_name = item.product.name if item.product else "Unknown"
            item.sku = item.product.sku if item.product else ""
        return t

    @staticmethod
    async def list_stock_transfers(db: AsyncSession, branch_id: Optional[UUID] = None, customer_id: Optional[UUID] = None) -> List[StockTransfer]:
        stmt = (
            select(StockTransfer)
            .options(
                selectinload(StockTransfer.source_branch),
                selectinload(StockTransfer.destination_branch),
                selectinload(StockTransfer.customer),
                selectinload(StockTransfer.items).selectinload(StockTransferItem.product)
            )
            .order_by(StockTransfer.date.desc())
        )
        if branch_id:
            stmt = stmt.filter(
                (StockTransfer.source_branch_id == branch_id) |
                (StockTransfer.destination_branch_id == branch_id)
            )
        if customer_id:
            stmt = stmt.filter(StockTransfer.customer_id == customer_id)
            
        q = await db.execute(stmt)
        transfers = list(q.scalars().all())
        for t in transfers:
            t.source_branch_name = t.source_branch.branch_name if t.source_branch else "Unknown"
            t.destination_branch_name = t.destination_branch.branch_name if t.destination_branch else None
            t.customer_name = t.customer.name if t.customer else None
            for item in t.items:
                item.product_name = item.product.name if item.product else "Unknown"
                item.sku = item.product.sku if item.product else ""
        return transfers

    @staticmethod
    async def dispatch_stock_transfer(db: AsyncSession, transfer_id: UUID) -> StockTransfer:
        t = await TxServices.get_stock_transfer(db, transfer_id)
        if t.status != "Draft":
            raise HTTPException(status_code=400, detail="Only Draft transfers can be dispatched.")
            
        t.status = "Transferred"
        db.add(t)
        
        # Execute stock changes
        for item in t.items:
            # Decrease at source branch
            await TxServices.update_stock(
                db=db,
                product_id=item.product_id,
                branch_id=t.source_branch_id,
                qty_change=-item.qty,
                tx_type="Out",
                ref_type="StockTransfer",
                ref_id=t.id,
                reason=f"Stock transfer outbound (Challan: {t.challan_number})"
            )
            if t.destination_branch_id:
                # Increase at destination branch (if it's a branch transfer)
                await TxServices.update_stock(
                    db=db,
                    product_id=item.product_id,
                    branch_id=t.destination_branch_id,
                    qty_change=item.qty,
                    tx_type="In",
                    ref_type="StockTransfer",
                    ref_id=t.id,
                    reason=f"Stock transfer inbound (Challan: {t.challan_number})"
                )
            
        await db.commit()
        return await TxServices.get_stock_transfer(db, t.id)

    @staticmethod
    async def cancel_stock_transfer(db: AsyncSession, transfer_id: UUID) -> StockTransfer:
        t = await TxServices.get_stock_transfer(db, transfer_id)
        if t.status == "Cancelled":
            raise HTTPException(status_code=400, detail="Transfer is already cancelled.")
            
        # Check if any invoices are linked to this delivery challan
        q_inv = await db.execute(select(Invoice).filter(Invoice.delivery_challan_id == transfer_id, Invoice.status != "Cancelled"))
        active_invoices = q_inv.scalars().all()
        if active_invoices:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot cancel Delivery Challan because it is linked to active invoice(s): {', '.join([i.invoice_number for i in active_invoices])}"
            )
            
        old_status = t.status
        t.status = "Cancelled"
        db.add(t)
        
        # If it was already transferred, reverse the stock adjustment
        if old_status == "Transferred":
            for item in t.items:
                # Add back to source
                await TxServices.update_stock(
                    db=db,
                    product_id=item.product_id,
                    branch_id=t.source_branch_id,
                    qty_change=item.qty,
                    tx_type="In",
                    ref_type="StockTransferCancel",
                    ref_id=t.id,
                    reason=f"Stock transfer reversal/cancellation (Challan: {t.challan_number})"
                )
                if t.destination_branch_id:
                    # Remove from destination (if it was a branch transfer)
                    await TxServices.update_stock(
                        db=db,
                        product_id=item.product_id,
                        branch_id=t.destination_branch_id,
                        qty_change=-item.qty,
                        tx_type="Out",
                        ref_type="StockTransferCancel",
                        ref_id=t.id,
                        reason=f"Stock transfer reversal/cancellation (Challan: {t.challan_number})"
                    )
                
        await db.commit()
        return await TxServices.get_stock_transfer(db, t.id)

