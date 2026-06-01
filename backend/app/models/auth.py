from typing import List, Optional
from uuid import UUID
from sqlalchemy import ForeignKey, String, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class Role(Base):
    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Relationships
    users: Mapped[List["User"]] = relationship(back_populates="role", cascade="all, delete-orphan")
    permissions: Mapped[List["Permission"]] = relationship(back_populates="role", cascade="all, delete-orphan")


class Permission(Base):
    __tablename__ = "permissions"

    role_id: Mapped[UUID] = mapped_column(ForeignKey("roles.id", ondelete="CASCADE"), index=True)
    module: Mapped[str] = mapped_column(String(50), index=True)  # masters, purchase, inventory, sales, payments, reports, admin
    action: Mapped[str] = mapped_column(String(50))              # view, create, edit, delete
    is_allowed: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relationships
    role: Mapped["Role"] = relationship(back_populates="permissions")


class User(Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(100))
    
    role_id: Mapped[UUID] = mapped_column(ForeignKey("roles.id", ondelete="RESTRICT"), index=True)
    branch_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("branches.id", ondelete="SET NULL"), nullable=True, index=True)

    # Relationships
    role: Mapped["Role"] = relationship(back_populates="users")
    branch: Mapped[Optional["Branch"]] = relationship(back_populates="users", foreign_keys=[branch_id])
