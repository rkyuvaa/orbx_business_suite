"""add_audit_log_fields

Revision ID: 0013_add_audit_log_fields
Revises: 0012_add_audit_log_and_tds
Create Date: 2026-06-07 20:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0013_add_audit_log_fields'
down_revision: Union[str, None] = '0012_add_audit_log_and_tds'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('audit_logs', sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))
    op.add_column('audit_logs', sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))
    op.add_column('audit_logs', sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False))
    op.create_index(op.f('ix_audit_logs_is_active'), 'audit_logs', ['is_active'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_audit_logs_is_active'), table_name='audit_logs')
    op.drop_column('audit_logs', 'is_active')
    op.drop_column('audit_logs', 'updated_at')
    op.drop_column('audit_logs', 'created_at')
