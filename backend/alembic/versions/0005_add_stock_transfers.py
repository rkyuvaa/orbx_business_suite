"""add_stock_transfers

Revision ID: 0005_add_stock_transfers
Revises: 0004_add_company_state_code
Create Date: 2026-06-06 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0005_add_stock_transfers'
down_revision: Union[str, None] = '0004_add_company_state_code'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. stock_transfers table
    op.create_table(
        'stock_transfers',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('source_branch_id', sa.UUID(), nullable=False),
        sa.Column('destination_branch_id', sa.UUID(), nullable=True),
        sa.Column('customer_id', sa.UUID(), nullable=True),
        sa.Column('challan_number', sa.String(length=50), nullable=False),
        sa.Column('date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('status', sa.String(length=30), nullable=False),
        sa.Column('notes', sa.String(length=255), nullable=True),
        sa.Column('total_amount', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('tax_amount', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('discount_amount', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('grand_total', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('gst_breakup', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.ForeignKeyConstraint(['source_branch_id'], ['branches.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['destination_branch_id'], ['branches.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_stock_transfers_id'), 'stock_transfers', ['id'], unique=False)
    op.create_index(op.f('ix_stock_transfers_is_active'), 'stock_transfers', ['is_active'], unique=False)
    op.create_index(op.f('ix_stock_transfers_challan_number'), 'stock_transfers', ['challan_number'], unique=True)
    op.create_index(op.f('ix_stock_transfers_customer_id'), 'stock_transfers', ['customer_id'], unique=False)

    # 2. stock_transfer_items table
    op.create_table(
        'stock_transfer_items',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('transfer_id', sa.UUID(), nullable=False),
        sa.Column('product_id', sa.UUID(), nullable=False),
        sa.Column('qty', sa.Float(), nullable=False),
        sa.Column('rate', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('discount_amount', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('tax_rate', sa.Float(), nullable=False, server_default='18.0'),
        sa.Column('tax_amount', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('amount', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.ForeignKeyConstraint(['transfer_id'], ['stock_transfers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_stock_transfer_items_id'), 'stock_transfer_items', ['id'], unique=False)
    op.create_index(op.f('ix_stock_transfer_items_is_active'), 'stock_transfer_items', ['is_active'], unique=False)

    # 3. Add delivery_challan_id to invoices table
    op.add_column('invoices', sa.Column('delivery_challan_id', sa.UUID(), nullable=True))
    op.create_index(op.f('ix_invoices_delivery_challan_id'), 'invoices', ['delivery_challan_id'], unique=False)
    op.create_foreign_key(
        'fk_invoices_delivery_challan_id_stock_transfers',
        'invoices', 'stock_transfers',
        ['delivery_challan_id'], ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    # Remove delivery_challan_id from invoices table
    op.drop_constraint('fk_invoices_delivery_challan_id_stock_transfers', 'invoices', type_='foreignkey')
    op.drop_index(op.f('ix_invoices_delivery_challan_id'), table_name='invoices')
    op.drop_column('invoices', 'delivery_challan_id')

    # Drop stock_transfers and stock_transfer_items
    op.drop_index(op.f('ix_stock_transfer_items_is_active'), table_name='stock_transfer_items')
    op.drop_index(op.f('ix_stock_transfer_items_id'), table_name='stock_transfer_items')
    op.drop_table('stock_transfer_items')
    op.drop_index(op.f('ix_stock_transfers_customer_id'), table_name='stock_transfers')
    op.drop_index(op.f('ix_stock_transfers_challan_number'), table_name='stock_transfers')
    op.drop_index(op.f('ix_stock_transfers_is_active'), table_name='stock_transfers')
    op.drop_index(op.f('ix_stock_transfers_id'), table_name='stock_transfers')
    op.drop_table('stock_transfers')
