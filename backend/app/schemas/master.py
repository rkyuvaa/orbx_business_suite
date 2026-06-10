from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, EmailStr, field_validator


# Customer Schemas
class CustomerCreate(BaseModel):
    name: str
    code: Optional[str] = None
    gstin: Optional[str] = None
    phone: Optional[str] = None
    alternative_phone: Optional[str] = None
    email: Optional[EmailStr] = None
    billing_address: Optional[str] = None
    shipping_address: Optional[str] = None
    credit_limit: float = 0.0
    payment_terms: Optional[str] = None
    branch_id: Optional[UUID] = None
    opening_bal: float = 0.0
    opening_bal_type: str = "Dr"

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


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    gstin: Optional[str] = None
    phone: Optional[str] = None
    alternative_phone: Optional[str] = None
    email: Optional[EmailStr] = None
    billing_address: Optional[str] = None
    shipping_address: Optional[str] = None
    credit_limit: Optional[float] = None
    payment_terms: Optional[str] = None
    branch_id: Optional[UUID] = None
    is_active: Optional[bool] = None
    opening_bal: Optional[float] = None
    opening_bal_type: Optional[str] = None

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


class CustomerOut(BaseModel):
    id: UUID
    name: str
    code: str
    gstin: Optional[str] = None
    phone: Optional[str] = None
    alternative_phone: Optional[str] = None
    email: Optional[EmailStr] = None
    billing_address: Optional[str] = None
    shipping_address: Optional[str] = None
    credit_limit: float
    payment_terms: Optional[str] = None
    branch_id: Optional[UUID] = None
    is_active: bool
    created_at: datetime
    opening_bal: float
    opening_bal_type: str

    class Config:
        from_attributes = True


# Supplier Schemas
class SupplierCreate(BaseModel):
    name: str
    code: Optional[str] = None
    gstin: Optional[str] = None
    phone: Optional[str] = None
    alternative_phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    payment_terms: Optional[str] = None
    bank_details: Optional[Dict[str, Any]] = None  # JSON format (bank_name, account_no, ifsc)
    branch_id: Optional[UUID] = None
    default_payable_ledger_id: Optional[UUID] = None
    opening_bal: float = 0.0
    opening_bal_type: str = "Cr"

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


class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    gstin: Optional[str] = None
    phone: Optional[str] = None
    alternative_phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    payment_terms: Optional[str] = None
    bank_details: Optional[Dict[str, Any]] = None
    branch_id: Optional[UUID] = None
    default_payable_ledger_id: Optional[UUID] = None
    is_active: Optional[bool] = None
    opening_bal: Optional[float] = None
    opening_bal_type: Optional[str] = None

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


class SupplierOut(BaseModel):
    id: UUID
    name: str
    code: str
    gstin: Optional[str] = None
    phone: Optional[str] = None
    alternative_phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    payment_terms: Optional[str] = None
    bank_details: Optional[Dict[str, Any]] = None
    branch_id: Optional[UUID] = None
    default_payable_ledger_id: Optional[UUID] = None
    is_active: bool
    created_at: datetime
    opening_bal: float
    opening_bal_type: str

    class Config:
        from_attributes = True


# Category Schemas
class ProductCategoryCreate(BaseModel):
    name: str
    parent_id: Optional[UUID] = None
    description: Optional[str] = None


class ProductCategoryOut(BaseModel):
    id: UUID
    name: str
    parent_id: Optional[UUID] = None
    description: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


# Product Pricing Schemas
class ProductPricingCreate(BaseModel):
    branch_id: Optional[UUID] = None
    customer_group: Optional[str] = None
    price_override: float


class ProductPricingOut(BaseModel):
    id: UUID
    product_id: UUID
    branch_id: Optional[UUID] = None
    customer_group: Optional[str] = None
    price_override: float

    class Config:
        from_attributes = True


# Product Schemas
class ProductCreate(BaseModel):
    name: str
    sku: str
    category_id: UUID
    uom: str = "PCS"
    hsn_code: Optional[str] = None
    tax_rate: float = 18.0
    purchase_price: float = 0.0
    selling_price: float = 0.0
    min_stock_level: float = 0.0
    pricing_overrides: Optional[List[ProductPricingCreate]] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    category_id: Optional[UUID] = None
    uom: Optional[str] = None
    hsn_code: Optional[str] = None
    tax_rate: Optional[float] = None
    purchase_price: Optional[float] = None
    selling_price: Optional[float] = None
    min_stock_level: Optional[float] = None
    is_active: Optional[bool] = None
    pricing_overrides: Optional[List[ProductPricingCreate]] = None


class ProductOut(BaseModel):
    id: UUID
    name: str
    sku: str
    category_id: UUID
    uom: str
    hsn_code: Optional[str] = None
    tax_rate: float
    purchase_price: float
    selling_price: float
    min_stock_level: float
    pricing_overrides: List[ProductPricingOut] = []
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
