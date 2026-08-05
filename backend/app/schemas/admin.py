from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, field_validator


# Company Schemas
class CompanyOut(BaseModel):
    id: UUID
    name: str
    logo: Optional[str] = None
    address: Optional[str] = None
    gstin: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    financial_year_start: Optional[str] = None
    state_code: Optional[str] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    email_from: Optional[str] = None
    email_subject_template: Optional[str] = None
    email_body_template: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_no: Optional[str] = None
    bank_ifsc_code: Optional[str] = None
    bank_branch_location: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    logo: Optional[str] = None
    address: Optional[str] = None
    gstin: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    financial_year_start: Optional[str] = None
    state_code: Optional[str] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    email_from: Optional[str] = None
    email_subject_template: Optional[str] = None
    email_body_template: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_no: Optional[str] = None
    bank_ifsc_code: Optional[str] = None
    bank_branch_location: Optional[str] = None

    @field_validator("gstin", mode="before")
    @classmethod
    def capitalize_gstin(cls, v):
        if isinstance(v, str):
            return v.strip().upper()
        return v

    @field_validator("email", mode="before")
    @classmethod
    def lowercase_email(cls, v):
        if isinstance(v, str):
            return v.strip().lower()
        return v


# Branch Schemas
class BranchCreate(BaseModel):
    branch_name: str
    address: str
    code: str
    so_prefix: str = "SO-"
    so_suffix: str = ""
    so_next_number: int = 1
    invoice_prefix: str = "INV-"
    invoice_suffix: str = ""
    invoice_next_number: int = 1
    challan_prefix: str = "DC-"
    challan_suffix: str = ""
    challan_next_number: int = 1
    po_prefix: str = "PO-"
    po_suffix: str = ""
    po_next_number: int = 1
    grn_prefix: str = "GRN-"
    grn_suffix: str = ""
    grn_next_number: int = 1
    receipt_prefix: str = "RCPT-"
    receipt_suffix: str = ""
    receipt_next_number: int = 1
    cn_prefix: str = "CN-"
    cn_suffix: str = ""
    cn_next_number: int = 1
    dn_prefix: str = "DN-"
    dn_suffix: str = ""
    dn_next_number: int = 1
    invoice_terms: Optional[str] = None
    invoice_footer: Optional[str] = None


class BranchUpdate(BaseModel):
    branch_name: Optional[str] = None
    address: Optional[str] = None
    code: Optional[str] = None
    so_prefix: Optional[str] = None
    so_suffix: Optional[str] = None
    so_next_number: Optional[int] = None
    invoice_prefix: Optional[str] = None
    invoice_suffix: Optional[str] = None
    invoice_next_number: Optional[int] = None
    challan_prefix: Optional[str] = None
    challan_suffix: Optional[str] = None
    challan_next_number: Optional[int] = None
    po_prefix: Optional[str] = None
    po_suffix: Optional[str] = None
    po_next_number: Optional[int] = None
    grn_prefix: Optional[str] = None
    grn_suffix: Optional[str] = None
    grn_next_number: Optional[int] = None
    receipt_prefix: Optional[str] = None
    receipt_suffix: Optional[str] = None
    receipt_next_number: Optional[int] = None
    cn_prefix: Optional[str] = None
    cn_suffix: Optional[str] = None
    cn_next_number: Optional[int] = None
    dn_prefix: Optional[str] = None
    dn_suffix: Optional[str] = None
    dn_next_number: Optional[int] = None
    invoice_terms: Optional[str] = None
    invoice_footer: Optional[str] = None
    is_active: Optional[bool] = None


class BranchOut(BaseModel):
    id: UUID
    company_id: UUID
    branch_name: str
    address: str
    code: str
    so_prefix: str
    so_suffix: str
    so_next_number: int
    invoice_prefix: str
    invoice_suffix: str
    invoice_next_number: int
    challan_prefix: str
    challan_suffix: str
    challan_next_number: int
    po_prefix: str
    po_suffix: str
    po_next_number: int
    grn_prefix: str
    grn_suffix: str
    grn_next_number: int
    receipt_prefix: str
    receipt_suffix: str
    receipt_next_number: int
    cn_prefix: str
    cn_suffix: str
    cn_next_number: int
    dn_prefix: str
    dn_suffix: str
    dn_next_number: int
    invoice_terms: Optional[str] = None
    invoice_footer: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# Role & Permission Schemas
class PermissionOut(BaseModel):
    id: UUID
    role_id: UUID
    module: str
    action: str
    is_allowed: bool

    class Config:
        from_attributes = True


class PermissionUpdate(BaseModel):
    module: str
    action: str
    is_allowed: bool


class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    permissions: Optional[List[PermissionUpdate]] = None


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[PermissionUpdate]] = None


class RoleOut(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    permissions: List[PermissionOut] = []
    is_active: bool

    class Config:
        from_attributes = True


class SmtpTestRequest(BaseModel):
    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_password: str
    email_from: str
    recipient_email: EmailStr
