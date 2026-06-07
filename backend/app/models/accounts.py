from datetime import datetime, date
from typing import List, Optional
from uuid import UUID
from sqlalchemy import ForeignKey, String, Numeric, Boolean, UniqueConstraint, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class AccountGroup(Base):
    __tablename__ = "account_groups"

    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    parent_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("account_groups.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    nature: Mapped[str] = mapped_column(String(20))  # Debit / Credit
    
    # Audit trail creator / updater
    created_by_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Self-referential hierarchy
    parent: Mapped[Optional["AccountGroup"]] = relationship("AccountGroup", remote_side="AccountGroup.id", back_populates="children")
    children: Mapped[List["AccountGroup"]] = relationship("AccountGroup", back_populates="parent", cascade="all, delete-orphan")
    
    # Ledgers under this group
    ledgers: Mapped[List["LedgerAccount"]] = relationship("LedgerAccount", back_populates="group")


class LedgerAccount(Base):
    __tablename__ = "ledger_accounts"

    code: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100), index=True)
    group_id: Mapped[UUID] = mapped_column(ForeignKey("account_groups.id", ondelete="RESTRICT"), index=True)
    
    # Numeric precision for Indian accounting
    opening_bal: Mapped[float] = mapped_column(Numeric(15, 2), default=0.0)
    opening_bal_type: Mapped[str] = mapped_column(String(10), default="Dr")  # Dr / Cr
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    
    # Indian-specific flags
    is_closing_stock: Mapped[bool] = mapped_column(Boolean, default=False)
    sundry_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # Debtor / Creditor
    partnership_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # Capital / Current
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)

    created_by_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    group: Mapped["AccountGroup"] = relationship(back_populates="ledgers")

    __table_args__ = (
        UniqueConstraint("name", "group_id", name="uq_ledger_name_group"),
    )


class VoucherType(Base):
    __tablename__ = "voucher_types"

    name: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    prefix: Mapped[str] = mapped_column(String(20))
    numbering_method: Mapped[str] = mapped_column(String(30))  # Automatic / Manual
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)

    created_by_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)


class JournalEntry(Base):
    __tablename__ = "journal_entries"

    voucher_type_id: Mapped[UUID] = mapped_column(ForeignKey("voucher_types.id", ondelete="RESTRICT"), index=True)
    reference_id: Mapped[Optional[UUID]] = mapped_column(nullable=True, index=True)
    reference_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    date: Mapped[date] = mapped_column(Date)
    narration: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_reversed: Mapped[bool] = mapped_column(Boolean, default=False)

    created_by_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    voucher_type: Mapped["VoucherType"] = relationship()
    lines: Mapped[List["JournalLine"]] = relationship("JournalLine", back_populates="journal_entry", cascade="all, delete-orphan")


class JournalLine(Base):
    __tablename__ = "journal_entry_lines"

    journal_entry_id: Mapped[UUID] = mapped_column(ForeignKey("journal_entries.id", ondelete="CASCADE"), index=True)
    ledger_id: Mapped[UUID] = mapped_column(ForeignKey("ledger_accounts.id", ondelete="RESTRICT"), index=True)
    dr_cr: Mapped[str] = mapped_column(String(10))  # Dr / Cr
    amount: Mapped[float] = mapped_column(Numeric(15, 2))
    narration: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Relationships
    journal_entry: Mapped["JournalEntry"] = relationship(back_populates="lines")
    ledger: Mapped["LedgerAccount"] = relationship()
