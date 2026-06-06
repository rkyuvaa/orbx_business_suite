from datetime import datetime
from typing import List, Optional
from uuid import UUID
from sqlalchemy import ForeignKey, String, Float, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class Payment(Base):
    __tablename__ = "payments"

    customer_id: Mapped[UUID] = mapped_column(ForeignKey("customers.id", ondelete="RESTRICT"), index=True)
    invoice_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True, index=True)
    payment_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    payment_mode: Mapped[str] = mapped_column(String(30)) # cash, cheque, UPI, bank
    reference_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True) # Cheque number, Transaction ID, etc.
    amount_paid: Mapped[float] = mapped_column(Float)
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Relationships
    customer: Mapped["Customer"] = relationship()
    invoice: Mapped[Optional["Invoice"]] = relationship(back_populates="payments")
    receipts: Mapped[List["PaymentReceipt"]] = relationship(back_populates="payment", cascade="all, delete-orphan")


class PaymentReceipt(Base):
    __tablename__ = "payment_receipts"

    payment_id: Mapped[UUID] = mapped_column(ForeignKey("payments.id", ondelete="CASCADE"), index=True)
    receipt_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    printed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    printed_by_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    payment: Mapped["Payment"] = relationship(back_populates="receipts")
    printed_by: Mapped[Optional["User"]] = relationship()


class VendorPayment(Base):
    __tablename__ = "vendor_payments"

    supplier_id: Mapped[UUID] = mapped_column(ForeignKey("suppliers.id", ondelete="RESTRICT"), index=True)
    purchase_entry_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("purchase_entries.id", ondelete="SET NULL"), nullable=True, index=True)
    payment_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    payment_mode: Mapped[str] = mapped_column(String(30)) # cash, cheque, UPI, bank
    reference_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    amount_paid: Mapped[float] = mapped_column(Float)
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Relationships
    supplier: Mapped["Supplier"] = relationship()
    purchase_entry: Mapped[Optional["PurchaseEntry"]] = relationship(back_populates="payments")
