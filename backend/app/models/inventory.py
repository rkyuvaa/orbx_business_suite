from datetime import datetime
from uuid import UUID
from sqlalchemy import ForeignKey, String, Float, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class StockTransaction(Base):
    __tablename__ = "stock_transactions"

    product_id: Mapped[UUID] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), index=True)
    branch_id: Mapped[UUID] = mapped_column(ForeignKey("branches.id", ondelete="RESTRICT"), index=True)
    qty: Mapped[float] = mapped_column(Float) # positive for In, negative for Out
    transaction_type: Mapped[str] = mapped_column(String(30)) # In, Out, Adjustment
    
    reference_type: Mapped[str] = mapped_column(String(50)) # GRN, Sales Invoice, Manual Stock In, Manual Stock Out, Adjustment
    reference_id: Mapped[UUID] = mapped_column(nullable=True, index=True) # ID of corresponding GRN, Invoice, etc.
    reason: Mapped[str] = mapped_column(String(255), nullable=True)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    product: Mapped["Product"] = relationship()
    branch: Mapped["Branch"] = relationship()


class CurrentStock(Base):
    __tablename__ = "current_stock"

    product_id: Mapped[UUID] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), index=True)
    branch_id: Mapped[UUID] = mapped_column(ForeignKey("branches.id", ondelete="RESTRICT"), index=True)
    qty: Mapped[float] = mapped_column(Float, default=0.0)

    # Unique constraint so we only have one row per product-branch combination
    __table_args__ = (
        UniqueConstraint("product_id", "branch_id", name="uq_product_branch_stock"),
    )

    # Relationships
    product: Mapped["Product"] = relationship()
    branch: Mapped["Branch"] = relationship()
