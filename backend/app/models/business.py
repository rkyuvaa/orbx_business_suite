from typing import List, Optional
from uuid import UUID
from sqlalchemy import ForeignKey, String, Float, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class Company(Base):
    __tablename__ = "companies"

    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    logo: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # Store base64 or file path
    address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    gstin: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    financial_year_start: Mapped[Optional[str]] = mapped_column(String(10), nullable=True) # e.g. "2026-04-01"
    state_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)

    # Relationships
    branches: Mapped[List["Branch"]] = relationship(back_populates="company", cascade="all, delete-orphan")


class Branch(Base):
    __tablename__ = "branches"

    company_id: Mapped[UUID] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    branch_name: Mapped[str] = mapped_column(String(100), index=True)
    address: Mapped[str] = mapped_column(String(255))
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True) # E.g. "HQ", "BR1"

    # Configurable Document Sequences
    so_prefix: Mapped[str] = mapped_column(String(20), default="SO-")
    so_suffix: Mapped[str] = mapped_column(String(20), default="")
    so_next_number: Mapped[int] = mapped_column(default=1)

    invoice_prefix: Mapped[str] = mapped_column(String(20), default="INV-")
    invoice_suffix: Mapped[str] = mapped_column(String(20), default="")
    invoice_next_number: Mapped[int] = mapped_column(default=1)

    challan_prefix: Mapped[str] = mapped_column(String(20), default="DC-")
    challan_suffix: Mapped[str] = mapped_column(String(20), default="")
    challan_next_number: Mapped[int] = mapped_column(default=1)

    po_prefix: Mapped[str] = mapped_column(String(20), default="PO-")
    po_suffix: Mapped[str] = mapped_column(String(20), default="")
    po_next_number: Mapped[int] = mapped_column(default=1)

    grn_prefix: Mapped[str] = mapped_column(String(20), default="GRN-")
    grn_suffix: Mapped[str] = mapped_column(String(20), default="")
    grn_next_number: Mapped[int] = mapped_column(default=1)

    receipt_prefix: Mapped[str] = mapped_column(String(20), default="RCPT-")
    receipt_suffix: Mapped[str] = mapped_column(String(20), default="")
    receipt_next_number: Mapped[int] = mapped_column(default=1)

    invoice_terms: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    invoice_footer: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Relationships
    company: Mapped["Company"] = relationship(back_populates="branches")
    users: Mapped[List["User"]] = relationship(
        back_populates="branch",
        foreign_keys="[User.branch_id]"
    )


class Customer(Base):
    __tablename__ = "customers"

    name: Mapped[str] = mapped_column(String(100), index=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    gstin: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    alternative_phone: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    billing_address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    shipping_address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    credit_limit: Mapped[float] = mapped_column(Float, default=0.0)
    payment_terms: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    branch_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("branches.id", ondelete="SET NULL"), nullable=True, index=True)

    # Relationships
    branch: Mapped[Optional["Branch"]] = relationship()


class Supplier(Base):
    __tablename__ = "suppliers"

    name: Mapped[str] = mapped_column(String(100), index=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    gstin: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    alternative_phone: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    payment_terms: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    # Store dynamic structure like bank name, routing/IFSC code, account number
    bank_details: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    branch_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("branches.id", ondelete="SET NULL"), nullable=True, index=True)

    # Relationships
    branch: Mapped[Optional["Branch"]] = relationship()
