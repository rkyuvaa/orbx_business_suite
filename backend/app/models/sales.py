from datetime import datetime
from typing import List, Optional
from uuid import UUID
from sqlalchemy import ForeignKey, String, Float, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.inventory import StockTransfer


class SalesOrder(Base):
    __tablename__ = "sales_orders"

    customer_id: Mapped[UUID] = mapped_column(ForeignKey("customers.id", ondelete="RESTRICT"), index=True)
    branch_id: Mapped[UUID] = mapped_column(ForeignKey("branches.id", ondelete="RESTRICT"), index=True)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    status: Mapped[str] = mapped_column(String(30), default="Draft") # Draft, Confirmed, Delivered, Cancelled
    
    total_amount: Mapped[float] = mapped_column(Float, default=0.0)
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0)
    discount_amount: Mapped[float] = mapped_column(Float, default=0.0)
    grand_total: Mapped[float] = mapped_column(Float, default=0.0)

    # Relationships
    customer: Mapped["Customer"] = relationship()
    branch: Mapped["Branch"] = relationship()
    items: Mapped[List["SalesOrderItem"]] = relationship(back_populates="sales_order", cascade="all, delete-orphan")
    invoices: Mapped[List["Invoice"]] = relationship(back_populates="sales_order")


class SalesOrderItem(Base):
    __tablename__ = "sales_order_items"

    sales_order_id: Mapped[UUID] = mapped_column(ForeignKey("sales_orders.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[UUID] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), index=True)
    qty: Mapped[float] = mapped_column(Float)
    rate: Mapped[float] = mapped_column(Float)
    discount_amount: Mapped[float] = mapped_column(Float, default=0.0)
    tax_rate: Mapped[float] = mapped_column(Float, default=18.0)
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0)
    amount: Mapped[float] = mapped_column(Float)

    # Relationships
    sales_order: Mapped["SalesOrder"] = relationship(back_populates="items")
    product: Mapped["Product"] = relationship()


class Invoice(Base):
    __tablename__ = "invoices"

    sales_order_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("sales_orders.id", ondelete="SET NULL"), nullable=True, index=True)
    delivery_challan_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("stock_transfers.id", ondelete="SET NULL"), nullable=True, index=True)
    branch_id: Mapped[UUID] = mapped_column(ForeignKey("branches.id", ondelete="RESTRICT"), index=True)
    invoice_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Store CGST, SGST, IGST breakups
    # Example: {"cgst": 9.0, "sgst": 9.0, "igst": 0.0}
    gst_breakup: Mapped[dict] = mapped_column(JSON, default=dict)
    
    subtotal: Mapped[float] = mapped_column(Float, default=0.0)
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0)
    discount_amount: Mapped[float] = mapped_column(Float, default=0.0)
    total_amount: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(30), default="Unpaid") # Paid, Unpaid, PartiallyPaid
    
    print_ready_layout: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Relationships
    sales_order: Mapped[Optional["SalesOrder"]] = relationship(back_populates="invoices")
    delivery_challan: Mapped[Optional["StockTransfer"]] = relationship()
    branch: Mapped["Branch"] = relationship()
    items: Mapped[List["InvoiceItem"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")
    payments: Mapped[List["Payment"]] = relationship(back_populates="invoice")


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    invoice_id: Mapped[UUID] = mapped_column(ForeignKey("invoices.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[UUID] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), index=True)
    qty: Mapped[float] = mapped_column(Float)
    rate: Mapped[float] = mapped_column(Float)
    discount_amount: Mapped[float] = mapped_column(Float, default=0.0)
    tax_rate: Mapped[float] = mapped_column(Float, default=18.0)
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0)
    amount: Mapped[float] = mapped_column(Float)

    # Relationships
    invoice: Mapped["Invoice"] = relationship(back_populates="items")
    product: Mapped["Product"] = relationship()


