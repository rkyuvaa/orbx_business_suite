"""add_vendor_payments

Revision ID: 0007_add_vendor_payments
Revises: 0006_add_document_sequences
Create Date: 2026-06-06 19:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0007_add_vendor_payments'
down_revision: Union[str, None] = '0006_add_document_sequences'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'vendor_payments',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('supplier_id', sa.UUID(), nullable=False),
        sa.Column('purchase_entry_id', sa.UUID(), nullable=True),
        sa.Column('payment_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('payment_mode', sa.String(length=30), nullable=False),
        sa.Column('reference_number', sa.String(length=50), nullable=True),
        sa.Column('amount_paid', sa.Float(), nullable=False),
        sa.Column('notes', sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(['purchase_entry_id'], ['purchase_entries.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_vendor_payments_purchase_entry_id'), 'vendor_payments', ['purchase_entry_id'], unique=False)
    op.create_index(op.f('ix_vendor_payments_supplier_id'), 'vendor_payments', ['supplier_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_vendor_payments_supplier_id'), table_name='vendor_payments')
    op.drop_index(op.f('ix_vendor_payments_purchase_entry_id'), table_name='vendor_payments')
    op.drop_table('vendor_payments')
