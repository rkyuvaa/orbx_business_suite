from datetime import datetime
from uuid import UUID, uuid4
from typing import Optional
import sqlalchemy as sa
from sqlalchemy import ForeignKey, String, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, index=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    action: Mapped[str] = mapped_column(String(20))  # create, modify, delete
    table_name: Mapped[str] = mapped_column(String(100))
    record_id: Mapped[UUID] = mapped_column(index=True)
    old_values: Mapped[Optional[dict]] = mapped_column(sa.JSON, nullable=True)
    new_values: Mapped[Optional[dict]] = mapped_column(sa.JSON, nullable=True)
