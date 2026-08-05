from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, EmailStr


# ==========================================
# EMAIL REQUEST SCHEMA
# ==========================================
class InvoiceEmailRequest(BaseModel):
    recipient_email: Optional[EmailStr] = None
    subject: Optional[str] = None
    body: Optional[str] = None



# ==========================================
# 1. PURCHASE MODULE SCHEMAS
# ==========================================
class PurchaseOrderItemCreate(BaseModel):
    product_id: UUID
    qty: float
    rate: float
    tax_rate: float = 18.0


class PurchaseOrderItemOut(BaseModel):
    id: UUID
    purchase_order_id: UUID
    product_id: UUID
    product_name: Optional[str] = None
    sku: Optional[str] = None
    qty: float
    rate: float
    tax_rate: float
    tax_amount: float
    amount: float

    class Config:
        from_attributes = True


class PurchaseOrderCreate(BaseModel):
    supplier_id: UUID
    branch_id: UUID
    date: Optional[datetime] = None
    expected_delivery: Optional[datetime] = None
    items: List[PurchaseOrderItemCreate]


class PurchaseOrderOut(BaseModel):
    id: UUID
    supplier_id: UUID
    supplier_name: Optional[str] = None
    branch_id: UUID
    po_number: Optional[str] = None
    date: datetime
    expected_delivery: Optional[datetime] = None
    status: str
    total_amount: float
    tax_amount: float
    grand_total: float
    items: List[PurchaseOrderItemOut] = []

    class Config:
        from_attributes = True


class GRNItemCreate(BaseModel):
    product_id: UUID
    po_item_id: Optional[UUID] = None
    qty_ordered: float
    qty_received: float
    warehouse_location: Optional[str] = None


class GRNItemOut(BaseModel):
    id: UUID
    grn_id: UUID
    product_id: UUID
    po_item_id: Optional[UUID] = None
    qty_ordered: float
    qty_received: float
    warehouse_location: Optional[str] = None

    class Config:
        from_attributes = True


class GRNCreate(BaseModel):
    purchase_order_id: UUID
    branch_id: UUID
    date: Optional[datetime] = None
    items: List[GRNItemCreate]


class GRNOut(BaseModel):
    id: UUID
    purchase_order_id: UUID
    branch_id: UUID
    grn_number: Optional[str] = None
    date: datetime
    received_by_id: Optional[UUID] = None
    status: str
    items: List[GRNItemOut] = []

    class Config:
        from_attributes = True


class PurchaseEntryCreate(BaseModel):
    grn_id: Optional[UUID] = None
    supplier_id: UUID
    branch_id: UUID
    invoice_number: str
    billing_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    payment_terms: Optional[str] = None
    subtotal: float
    tax_amount: float
    total_amount: float
    payable_ledger_id: Optional[UUID] = None
    purchase_account_id: Optional[UUID] = None
    tax_ledger_id: Optional[UUID] = None


class PurchaseEntryOut(BaseModel):
    id: UUID
    grn_id: Optional[UUID] = None
    supplier_id: UUID
    supplier_name: Optional[str] = None
    branch_id: UUID
    invoice_number: str
    billing_date: datetime
    due_date: Optional[datetime] = None
    payment_terms: Optional[str] = None
    subtotal: float
    tax_amount: float
    total_amount: float
    outstanding_amount: Optional[float] = None
    status: str
    payable_ledger_id: Optional[UUID] = None
    purchase_account_id: Optional[UUID] = None
    tax_ledger_id: Optional[UUID] = None
    journal_entry_id: Optional[UUID] = None

    class Config:
        from_attributes = True


# ==========================================
# 2. INVENTORY MODULE SCHEMAS
# ==========================================
class StockTransactionCreate(BaseModel):
    product_id: UUID
    branch_id: UUID
    qty: float  # Positive for adding, negative for reducing
    transaction_type: str  # In, Out, Adjustment
    reason: Optional[str] = None


class StockTransactionOut(BaseModel):
    id: UUID
    product_id: UUID
    branch_id: UUID
    qty: float
    transaction_type: str
    reference_type: str
    reference_id: Optional[UUID] = None
    reason: Optional[str] = None
    date: datetime

    class Config:
        from_attributes = True


class CurrentStockOut(BaseModel):
    id: UUID
    product_id: UUID
    branch_id: UUID
    qty: float

    class Config:
        from_attributes = True


# ==========================================
# 3. SALES MODULE SCHEMAS
# ==========================================
class SalesOrderItemCreate(BaseModel):
    product_id: UUID
    qty: float
    rate: float
    discount_amount: float = 0.0
    tax_rate: float = 18.0


class SalesOrderItemOut(BaseModel):
    id: UUID
    sales_order_id: UUID
    product_id: UUID
    product_name: Optional[str] = None
    sku: Optional[str] = None
    hsn_code: Optional[str] = None
    qty: float
    rate: float
    discount_amount: float
    tax_rate: float
    tax_amount: float
    amount: float

    class Config:
        from_attributes = True


class SalesOrderCreate(BaseModel):
    customer_id: UUID
    branch_id: UUID
    so_number: Optional[str] = None
    date: Optional[datetime] = None
    items: List[SalesOrderItemCreate]


class SalesOrderOut(BaseModel):
    id: UUID
    customer_id: UUID
    customer_name: Optional[str] = None
    customer_gstin: Optional[str] = None
    customer_billing_address: Optional[str] = None
    customer_shipping_address: Optional[str] = None
    branch_id: UUID
    so_number: Optional[str] = None
    date: datetime
    status: str
    total_amount: float
    tax_amount: float
    discount_amount: float
    grand_total: float
    items: List[SalesOrderItemOut] = []

    class Config:
        from_attributes = True


class InvoiceItemOut(BaseModel):
    id: UUID
    invoice_id: UUID
    product_id: UUID
    product_name: Optional[str] = None
    sku: Optional[str] = None
    hsn_code: Optional[str] = None
    qty: float
    rate: float
    discount_amount: float
    tax_rate: float
    tax_amount: float
    amount: float

    class Config:
        from_attributes = True


class InvoiceCreate(BaseModel):
    sales_order_id: Optional[UUID] = None
    delivery_challan_id: Optional[UUID] = None
    invoice_number: Optional[str] = None
    date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    reference_note: Optional[str] = None
    reference_date: Optional[datetime] = None


class InvoiceOut(BaseModel):
    id: UUID
    sales_order_id: Optional[UUID] = None
    sales_order_number: Optional[str] = None
    delivery_challan_id: Optional[UUID] = None
    delivery_challan_number: Optional[str] = None
    customer_name: Optional[str] = None
    customer_id: Optional[UUID] = None
    customer_gstin: Optional[str] = None
    customer_email: Optional[str] = None
    customer_billing_address: Optional[str] = None
    customer_shipping_address: Optional[str] = None
    branch_id: UUID
    invoice_number: str
    date: datetime
    due_date: Optional[datetime] = None
    gst_breakup: Dict[str, float]
    subtotal: float
    tax_amount: float
    discount_amount: float
    total_amount: float
    outstanding_amount: Optional[float] = None
    status: str
    print_ready_layout: Optional[str] = None
    reference_note: Optional[str] = None
    reference_date: Optional[datetime] = None
    items: List[InvoiceItemOut] = []

    class Config:
        from_attributes = True



# ==========================================
# 4. PAYMENTS MODULE SCHEMAS
# ==========================================
class PaymentCreate(BaseModel):
    customer_id: UUID
    invoice_id: Optional[UUID] = None
    payment_date: Optional[datetime] = None
    payment_mode: str  # cash, cheque, UPI, bank
    reference_number: Optional[str] = None
    amount_paid: float
    notes: Optional[str] = None


class PaymentOut(BaseModel):
    id: UUID
    customer_id: UUID
    invoice_id: Optional[UUID] = None
    payment_date: datetime
    payment_mode: str
    reference_number: Optional[str] = None
    amount_paid: float
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class PaymentReceiptOut(BaseModel):
    id: UUID
    payment_id: UUID
    receipt_number: str
    printed_at: datetime
    printed_by_id: Optional[UUID] = None

    class Config:
        from_attributes = True


class VendorPaymentCreate(BaseModel):
    supplier_id: UUID
    purchase_entry_id: Optional[UUID] = None
    payment_date: Optional[datetime] = None
    payment_mode: str
    reference_number: Optional[str] = None
    amount_paid: float
    notes: Optional[str] = None


class VendorPaymentOut(BaseModel):
    id: UUID
    supplier_id: UUID
    supplier_name: Optional[str] = None
    purchase_entry_id: Optional[UUID] = None
    purchase_entry_number: Optional[str] = None
    payment_date: datetime
    payment_mode: str
    reference_number: Optional[str] = None
    amount_paid: float
    notes: Optional[str] = None

    class Config:
        from_attributes = True


# ==========================================
# 5. REPORTS SCHEMAS (Dashboard & Analytics)
# ==========================================
class KPICardsOut(BaseModel):
    today_sales: float
    monthly_sales: float
    outstanding_payments: float
    low_stock_count: int


class SalesByCategoryOut(BaseModel):
    category_name: str
    total_sales: float


class MonthlySalesTrendOut(BaseModel):
    month: str  # E.g. "Jan", "Feb"
    sales: float


class TopProductSalesOut(BaseModel):
    product_name: str
    sku: str
    qty_sold: float
    total_revenue: float


class RecentTransactionOut(BaseModel):
    id: UUID
    tx_type: str  # E.g. "Sales Order", "Purchase Order", "Payment"
    reference_no: str
    party_name: str
    date: datetime
    amount: float
    status: str


class DashboardResponse(BaseModel):
    kpis: KPICardsOut
    sales_by_category: List[SalesByCategoryOut]
    monthly_sales_trend: List[MonthlySalesTrendOut]
    top_products: List[TopProductSalesOut]
    recent_transactions: List[RecentTransactionOut]


class PaymentReceiptListOut(BaseModel):
    id: UUID
    customer_id: UUID
    customer_name: Optional[str] = None
    invoice_id: Optional[UUID] = None
    invoice_number: Optional[str] = None
    receipt_number: Optional[str] = None
    payment_date: datetime
    payment_mode: str
    reference_number: Optional[str] = None
    amount_paid: float
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class LedgerEntry(BaseModel):
    date: datetime
    tx_type: str
    reference_no: str
    debit: float
    credit: float
    running_balance: float


class CustomerLedgerResponse(BaseModel):
    total_billed: float
    total_paid: float
    balance: float
    transactions: List[LedgerEntry]


class SupplierLedgerResponse(BaseModel):
    total_purchased: float
    total_paid: float
    balance: float
    transactions: List[LedgerEntry]


# ==========================================
# 5. STOCK TRANSFER MODULE SCHEMAS
# ==========================================
class StockTransferItemCreate(BaseModel):
    product_id: UUID
    qty: float
    rate: float = 0.0
    discount_amount: float = 0.0
    tax_rate: float = 18.0


class StockTransferCreate(BaseModel):
    source_branch_id: UUID
    destination_branch_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    date: Optional[datetime] = None
    notes: Optional[str] = None
    items: List[StockTransferItemCreate]


class StockTransferItemOut(BaseModel):
    id: UUID
    product_id: UUID
    product_name: Optional[str] = None
    sku: Optional[str] = None
    qty: float
    rate: float
    discount_amount: float
    tax_rate: float
    tax_amount: float
    amount: float

    class Config:
        from_attributes = True


class StockTransferOut(BaseModel):
    id: UUID
    source_branch_id: UUID
    source_branch_name: Optional[str] = None
    destination_branch_id: Optional[UUID] = None
    destination_branch_name: Optional[str] = None
    customer_id: Optional[UUID] = None
    customer_name: Optional[str] = None
    challan_number: str
    date: datetime
    status: str
    notes: Optional[str] = None
    total_amount: float
    tax_amount: float
    discount_amount: float
    grand_total: float
    gst_breakup: Dict[str, float] = {}
    items: List[StockTransferItemOut] = []

    class Config:
        from_attributes = True


# ==========================================
# 6. CREDIT NOTE SCHEMAS (Sales Returns)
# ==========================================
class CreditNoteItemCreate(BaseModel):
    product_id: UUID
    qty: float
    rate: float
    tax_rate: float = 18.0


class CreditNoteItemOut(BaseModel):
    id: UUID
    credit_note_id: UUID
    product_id: UUID
    product_name: Optional[str] = None
    sku: Optional[str] = None
    qty: float
    rate: float
    tax_rate: float
    tax_amount: float
    amount: float

    class Config:
        from_attributes = True


class CreditNoteCreate(BaseModel):
    invoice_id: Optional[UUID] = None
    branch_id: UUID
    date: Optional[datetime] = None
    reason: Optional[str] = None
    items: List[CreditNoteItemCreate]


class CreditNoteOut(BaseModel):
    id: UUID
    invoice_id: Optional[UUID] = None
    invoice_number: Optional[str] = None
    customer_id: Optional[UUID] = None
    customer_name: Optional[str] = None
    branch_id: UUID
    credit_note_number: str
    date: datetime
    reason: Optional[str] = None
    subtotal: float
    tax_amount: float
    total_amount: float
    status: str
    items: List[CreditNoteItemOut] = []

    class Config:
        from_attributes = True


# ==========================================
# 7. DEBIT NOTE SCHEMAS (Purchase Returns)
# ==========================================
class DebitNoteItemCreate(BaseModel):
    product_id: UUID
    qty: float
    rate: float
    tax_rate: float = 18.0


class DebitNoteItemOut(BaseModel):
    id: UUID
    debit_note_id: UUID
    product_id: UUID
    product_name: Optional[str] = None
    sku: Optional[str] = None
    qty: float
    rate: float
    tax_rate: float
    tax_amount: float
    amount: float

    class Config:
        from_attributes = True


class DebitNoteCreate(BaseModel):
    purchase_entry_id: Optional[UUID] = None
    supplier_id: UUID
    branch_id: UUID
    date: Optional[datetime] = None
    reason: Optional[str] = None
    items: List[DebitNoteItemCreate]


class DebitNoteOut(BaseModel):
    id: UUID
    purchase_entry_id: Optional[UUID] = None
    purchase_entry_number: Optional[str] = None
    supplier_id: UUID
    supplier_name: Optional[str] = None
    branch_id: UUID
    debit_note_number: str
    date: datetime
    reason: Optional[str] = None
    subtotal: float
    tax_amount: float
    total_amount: float
    status: str
    items: List[DebitNoteItemOut] = []

    class Config:
        from_attributes = True
