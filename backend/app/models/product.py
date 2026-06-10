from typing import List, Optional
from uuid import UUID
from sqlalchemy import ForeignKey, String, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class ProductCategory(Base):
    __tablename__ = "product_categories"

    name: Mapped[str] = mapped_column(String(100), index=True)
    parent_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("product_categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Relationships
    parent: Mapped[Optional["ProductCategory"]] = relationship(
        remote_side="ProductCategory.id",
        back_populates="children"
    )
    children: Mapped[List["ProductCategory"]] = relationship(
        back_populates="parent",
        cascade="all, delete"
    )
    products: Mapped[List["Product"]] = relationship(back_populates="category")


class Product(Base):
    __tablename__ = "products"

    name: Mapped[str] = mapped_column(String(100), index=True)
    sku: Mapped[Optional[str]] = mapped_column(String(50), unique=True, index=True, nullable=True)
    category_id: Mapped[UUID] = mapped_column(ForeignKey("product_categories.id", ondelete="RESTRICT"), index=True)
    uom: Mapped[str] = mapped_column(String(20), default="PCS") # Unit of Measure, e.g. PCS, KG, LTR
    hsn_code: Mapped[Optional[str]] = mapped_column(String(15), nullable=True)
    tax_rate: Mapped[float] = mapped_column(Float, default=18.0) # Standard 18% GST default
    purchase_price: Mapped[float] = mapped_column(Float, default=0.0)
    selling_price: Mapped[float] = mapped_column(Float, default=0.0)
    min_stock_level: Mapped[float] = mapped_column(Float, default=0.0)

    # Relationships
    category: Mapped["ProductCategory"] = relationship(back_populates="products")
    pricing_overrides: Mapped[List["ProductPricing"]] = relationship(back_populates="product", cascade="all, delete-orphan")


class ProductPricing(Base):
    __tablename__ = "product_pricing"

    product_id: Mapped[UUID] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    branch_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("branches.id", ondelete="CASCADE"), nullable=True, index=True)
    customer_group: Mapped[Optional[str]] = mapped_column(String(50), nullable=True) # wholesale, retail, etc.
    price_override: Mapped[float] = mapped_column(Float)

    # Relationships
    product: Mapped["Product"] = relationship(back_populates="pricing_overrides")
    branch: Mapped[Optional["Branch"]] = relationship()
