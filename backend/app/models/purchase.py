from datetime import datetime, date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID
from sqlalchemy import ForeignKey, String, Float, DateTime, Date, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.accounts import LedgerAccount, JournalEntry


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    supplier_id: Mapped[UUID] = mapped_column(ForeignKey("suppliers.id", ondelete="RESTRICT"), index=True)
    branch_id: Mapped[UUID] = mapped_column(ForeignKey("branches.id", ondelete="RESTRICT"), index=True)
    po_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    expected_delivery: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="Draft") # Draft, Confirmed, Received, Cancelled
    
    total_amount: Mapped[float] = mapped_column(Float, default=0.0)
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0)
    grand_total: Mapped[float] = mapped_column(Float, default=0.0)

    # Relationships
    supplier: Mapped["Supplier"] = relationship()
    branch: Mapped["Branch"] = relationship()
    items: Mapped[List["PurchaseOrderItem"]] = relationship(back_populates="purchase_order", cascade="all, delete-orphan")
    grns: Mapped[List["GRN"]] = relationship(back_populates="purchase_order")


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"

    purchase_order_id: Mapped[UUID] = mapped_column(ForeignKey("purchase_orders.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[UUID] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), index=True)
    qty: Mapped[float] = mapped_column(Float)
    rate: Mapped[float] = mapped_column(Float)
    tax_rate: Mapped[float] = mapped_column(Float, default=18.0)
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0)
    amount: Mapped[float] = mapped_column(Float)

    # Relationships
    purchase_order: Mapped["PurchaseOrder"] = relationship(back_populates="items")
    product: Mapped["Product"] = relationship()


class GRN(Base):
    __tablename__ = "grn"

    purchase_order_id: Mapped[UUID] = mapped_column(ForeignKey("purchase_orders.id", ondelete="RESTRICT"), index=True)
    branch_id: Mapped[UUID] = mapped_column(ForeignKey("branches.id", ondelete="RESTRICT"), index=True)
    grn_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    received_by_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="Received") # Draft, Received, Cancelled

    # Relationships
    purchase_order: Mapped["PurchaseOrder"] = relationship(back_populates="grns")
    branch: Mapped["Branch"] = relationship()
    items: Mapped[List["GRNItem"]] = relationship(back_populates="grn", cascade="all, delete-orphan")
    purchase_entries: Mapped[List["PurchaseEntry"]] = relationship(back_populates="grn")

    @property
    def po_number(self) -> Optional[str]:
        return self.purchase_order.po_number if self.purchase_order else None


class GRNItem(Base):
    __tablename__ = "grn_items"

    grn_id: Mapped[UUID] = mapped_column(ForeignKey("grn.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[UUID] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), index=True)
    po_item_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("purchase_order_items.id", ondelete="SET NULL"), nullable=True)
    qty_ordered: Mapped[float] = mapped_column(Float)
    qty_received: Mapped[float] = mapped_column(Float)
    warehouse_location: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Relationships
    grn: Mapped["GRN"] = relationship(back_populates="items")
    product: Mapped["Product"] = relationship()


class PurchaseEntry(Base):
    __tablename__ = "purchase_entries"

    grn_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("grn.id", ondelete="SET NULL"), nullable=True, index=True)
    supplier_id: Mapped[UUID] = mapped_column(ForeignKey("suppliers.id", ondelete="RESTRICT"), index=True)
    branch_id: Mapped[UUID] = mapped_column(ForeignKey("branches.id", ondelete="RESTRICT"), index=True)
    
    invoice_number: Mapped[str] = mapped_column(String(50), index=True)
    billing_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    payment_terms: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    subtotal: Mapped[float] = mapped_column(Float, default=0.0)
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0)
    cgst_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"))
    sgst_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"))
    igst_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"))
    total_amount: Mapped[float] = mapped_column(Float, default=0.0)
    tds_section: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    tds_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.00"))
    tds_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"))
    status: Mapped[str] = mapped_column(String(30), default="Unpaid") # Paid, Unpaid, PartiallyPaid, Draft

    # Account ledger FKs
    payable_ledger_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("ledger_accounts.id", ondelete="RESTRICT"), nullable=True, index=True)
    purchase_account_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("ledger_accounts.id", ondelete="RESTRICT"), nullable=True, index=True)
    tax_ledger_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("ledger_accounts.id", ondelete="RESTRICT"), nullable=True, index=True)
    journal_entry_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True, index=True)

    # Relationships
    grn: Mapped[Optional["GRN"]] = relationship(back_populates="purchase_entries")
    supplier: Mapped["Supplier"] = relationship()
    branch: Mapped["Branch"] = relationship()
    payments: Mapped[List["VendorPayment"]] = relationship(back_populates="purchase_entry", cascade="all, delete-orphan")
    
    payable_ledger: Mapped[Optional[LedgerAccount]] = relationship(foreign_keys=[payable_ledger_id])
    purchase_account: Mapped[Optional[LedgerAccount]] = relationship(foreign_keys=[purchase_account_id])
    tax_ledger: Mapped[Optional[LedgerAccount]] = relationship(foreign_keys=[tax_ledger_id])
    journal_entry: Mapped[Optional[JournalEntry]] = relationship(foreign_keys=[journal_entry_id])


class PurchaseReturn(Base):
    __tablename__ = "purchase_returns"

    supplier_id: Mapped[UUID] = mapped_column(ForeignKey("suppliers.id", ondelete="RESTRICT"), index=True)
    branch_id: Mapped[UUID] = mapped_column(ForeignKey("branches.id", ondelete="RESTRICT"), index=True)
    purchase_entry_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("purchase_entries.id", ondelete="SET NULL"), nullable=True, index=True)
    journal_entry_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True, index=True)
    
    return_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    date: Mapped[date] = mapped_column(Date)
    subtotal: Mapped[float] = mapped_column(Numeric(15, 2))
    tax_amount: Mapped[float] = mapped_column(Numeric(15, 2))
    total_amount: Mapped[float] = mapped_column(Numeric(15, 2))
    debit_note_ledger_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("ledger_accounts.id", ondelete="RESTRICT"), nullable=True, index=True)

    # Relationships
    supplier: Mapped["Supplier"] = relationship()
    branch: Mapped["Branch"] = relationship()
    purchase_entry: Mapped[Optional["PurchaseEntry"]] = relationship()
    journal_entry: Mapped[Optional[JournalEntry]] = relationship(foreign_keys=[journal_entry_id])
    debit_note_ledger: Mapped[Optional[LedgerAccount]] = relationship(foreign_keys=[debit_note_ledger_id])


class DebitNote(Base):
    __tablename__ = "debit_notes"

    purchase_entry_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("purchase_entries.id", ondelete="SET NULL"), nullable=True, index=True)
    supplier_id: Mapped[UUID] = mapped_column(ForeignKey("suppliers.id", ondelete="RESTRICT"), index=True)
    branch_id: Mapped[UUID] = mapped_column(ForeignKey("branches.id", ondelete="RESTRICT"), index=True)
    debit_note_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    subtotal: Mapped[float] = mapped_column(Float, default=0.0)
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0)
    total_amount: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(30), default="Issued")  # Issued, Cancelled

    # Relationships
    purchase_entry: Mapped[Optional["PurchaseEntry"]] = relationship()
    supplier: Mapped["Supplier"] = relationship()
    branch: Mapped["Branch"] = relationship()
    items: Mapped[List["DebitNoteItem"]] = relationship(back_populates="debit_note", cascade="all, delete-orphan")


class DebitNoteItem(Base):
    __tablename__ = "debit_note_items"

    debit_note_id: Mapped[UUID] = mapped_column(ForeignKey("debit_notes.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[UUID] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), index=True)
    qty: Mapped[float] = mapped_column(Float)
    rate: Mapped[float] = mapped_column(Float)
    tax_rate: Mapped[float] = mapped_column(Float, default=18.0)
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0)
    amount: Mapped[float] = mapped_column(Float)

    # Relationships
    debit_note: Mapped["DebitNote"] = relationship(back_populates="items")
    product: Mapped["Product"] = relationship()
