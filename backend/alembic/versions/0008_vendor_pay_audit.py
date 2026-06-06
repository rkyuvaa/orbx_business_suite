"""vendor_pay_audit

Revision ID: 0008_vendor_pay_audit
Revises: 0007_add_vendor_payments
Create Date: 2026-06-06 19:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0008_vendor_pay_audit'
down_revision: Union[str, None] = '0007_add_vendor_payments'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add audit columns to vendor_payments
    op.add_column('vendor_payments', sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))
    op.add_column('vendor_payments', sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))
    op.add_column('vendor_payments', sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False))
    op.create_index(op.f('ix_vendor_payments_is_active'), 'vendor_payments', ['is_active'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_vendor_payments_is_active'), table_name='vendor_payments')
    op.drop_column('vendor_payments', 'is_active')
    op.drop_column('vendor_payments', 'updated_at')
    op.drop_column('vendor_payments', 'created_at')
