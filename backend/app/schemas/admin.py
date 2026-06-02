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
    invoice_prefix: str = "INV-"
    invoice_next_number: int = 1
    invoice_terms: Optional[str] = None
    invoice_footer: Optional[str] = None


class BranchUpdate(BaseModel):
    branch_name: Optional[str] = None
    address: Optional[str] = None
    code: Optional[str] = None
    invoice_prefix: Optional[str] = None
    invoice_next_number: Optional[int] = None
    invoice_terms: Optional[str] = None
    invoice_footer: Optional[str] = None
    is_active: Optional[bool] = None


class BranchOut(BaseModel):
    id: UUID
    company_id: UUID
    branch_name: str
    address: str
    code: str
    invoice_prefix: str
    invoice_next_number: int
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
