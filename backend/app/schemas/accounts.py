from datetime import datetime, date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field


# ==========================================
# LEDGER ACCOUNT SCHEMAS
# ==========================================
class LedgerAccountCreate(BaseModel):
    code: str = Field(..., max_length=30)
    name: str = Field(..., max_length=100)
    group_id: UUID
    opening_bal: float = 0.0
    opening_bal_type: str = "Dr"  # Dr / Cr
    currency: str = "INR"
    is_closing_stock: bool = False
    sundry_type: Optional[str] = None  # Debtor / Creditor
    partnership_type: Optional[str] = None  # Capital / Current


class LedgerAccountOut(BaseModel):
    id: UUID
    code: str
    name: str
    group_id: UUID
    group_name: Optional[str] = None
    opening_bal: float
    opening_bal_type: str
    currency: str
    is_closing_stock: bool
    sundry_type: Optional[str] = None
    partnership_type: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ==========================================
# ACCOUNT GROUP SCHEMAS
# ==========================================
class AccountGroupCreate(BaseModel):
    name: str = Field(..., max_length=100)
    parent_id: Optional[UUID] = None
    nature: str = "Debit"  # Debit / Credit


class AccountGroupOut(BaseModel):
    id: UUID
    name: str
    parent_id: Optional[UUID] = None
    parent_name: Optional[str] = None
    nature: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Hierarchy outputs for recursive COA tree mapping
class AccountGroupHierarchyOut(BaseModel):
    id: UUID
    name: str
    parent_id: Optional[UUID] = None
    nature: str
    depth: int = 0
    path: str = ""
    subgroups: List["AccountGroupHierarchyOut"] = []
    ledgers: List[LedgerAccountOut] = []

    class Config:
        from_attributes = True


# ==========================================
# VOUCHER TYPE SCHEMAS
# ==========================================
class VoucherTypeCreate(BaseModel):
    name: str = Field(..., max_length=50)
    prefix: str = Field(..., max_length=20)
    numbering_method: str = "Automatic"  # Automatic / Manual


class VoucherTypeOut(BaseModel):
    id: UUID
    name: str
    prefix: str
    numbering_method: str
    is_system: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ==========================================
# VALIDATION SCHEMAS
# ==========================================
class BalanceValidationRequest(BaseModel):
    financial_year: Optional[str] = None
    as_of_date: Optional[datetime] = None


class OpeningBalanceTallyOut(BaseModel):
    dr_total: float
    cr_total: float
    difference: float
    tallies: bool


# ==========================================
# JOURNAL ENTRY SCHEMAS
# ==========================================
class JournalEntryLine(BaseModel):
    ledger_id: UUID
    dr_cr: str  # "Dr" or "Cr"
    amount: Decimal
    narration: Optional[str] = None


class JournalEntryCreate(BaseModel):
    voucher_type_name: str
    date: date
    reference_id: Optional[UUID] = None
    reference_type: Optional[str] = None
    narration: Optional[str] = None
    lines: List[JournalEntryLine]


class JournalEntryLineOut(BaseModel):
    id: UUID
    journal_entry_id: UUID
    ledger_id: UUID
    dr_cr: str
    amount: Decimal
    narration: Optional[str] = None

    class Config:
        from_attributes = True


class JournalEntryOut(BaseModel):
    id: UUID
    voucher_type_id: UUID
    reference_id: Optional[UUID] = None
    reference_type: Optional[str] = None
    date: date
    narration: Optional[str] = None
    is_reversed: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
    lines: List[JournalEntryLineOut]

    class Config:
        from_attributes = True
