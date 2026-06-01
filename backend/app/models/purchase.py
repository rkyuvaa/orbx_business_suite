from datetime import datetime
from typing import List, Optional
from uuid import UUID
from sqlalchemy import ForeignKey, String, Float, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    supplier_id: Mapped[UUID] = mapped_column(ForeignKey("suppliers.id", ondelete="RESTRICT"), index=True)
    branch_id: Mapped[UUID] = mapped_column(ForeignKey("branches.id", ondelete="RESTRICT"), index=True)
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
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    received_by_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="Received") # Draft, Received, Cancelled

    # Relationships
    purchase_order: Mapped["PurchaseOrder"] = relationship(back_populates="grns")
    branch: Mapped["Branch"] = relationship()
    items: Mapped[List["GRNItem"]] = relationship(back_populates="grn", cascade="all, delete-orphan")
    purchase_entries: Mapped[List["PurchaseEntry"]] = relationship(back_populates="grn")


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
    total_amount: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(30), default="Unpaid") # Paid, Unpaid, PartiallyPaid, Draft

    # Relationships
    grn: Mapped[Optional["GRN"]] = relationship(back_populates="purchase_entries")
    supplier: Mapped["Supplier"] = relationship()
    branch: Mapped["Branch"] = relationship()
