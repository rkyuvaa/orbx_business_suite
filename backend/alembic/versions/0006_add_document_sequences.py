"""add_document_sequences

Revision ID: 0006_add_document_sequences
Revises: 0005_add_stock_transfers
Create Date: 2026-06-06 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0006_add_document_sequences'
down_revision: Union[str, None] = '0005_add_stock_transfers'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add fields to branches table
    op.add_column('branches', sa.Column('so_prefix', sa.String(length=20), server_default='SO-', nullable=False))
    op.add_column('branches', sa.Column('so_suffix', sa.String(length=20), server_default='', nullable=False))
    op.add_column('branches', sa.Column('so_next_number', sa.Integer(), server_default='1', nullable=False))
    
    op.add_column('branches', sa.Column('invoice_suffix', sa.String(length=20), server_default='', nullable=False))
    
    op.add_column('branches', sa.Column('challan_prefix', sa.String(length=20), server_default='DC-', nullable=False))
    op.add_column('branches', sa.Column('challan_suffix', sa.String(length=20), server_default='', nullable=False))
    op.add_column('branches', sa.Column('challan_next_number', sa.Integer(), server_default='1', nullable=False))
    
    op.add_column('branches', sa.Column('po_prefix', sa.String(length=20), server_default='PO-', nullable=False))
    op.add_column('branches', sa.Column('po_suffix', sa.String(length=20), server_default='', nullable=False))
    op.add_column('branches', sa.Column('po_next_number', sa.Integer(), server_default='1', nullable=False))
    
    op.add_column('branches', sa.Column('grn_prefix', sa.String(length=20), server_default='GRN-', nullable=False))
    op.add_column('branches', sa.Column('grn_suffix', sa.String(length=20), server_default='', nullable=False))
    op.add_column('branches', sa.Column('grn_next_number', sa.Integer(), server_default='1', nullable=False))
    
    op.add_column('branches', sa.Column('receipt_prefix', sa.String(length=20), server_default='RCPT-', nullable=False))
    op.add_column('branches', sa.Column('receipt_suffix', sa.String(length=20), server_default='', nullable=False))
    op.add_column('branches', sa.Column('receipt_next_number', sa.Integer(), server_default='1', nullable=False))

    # 2. Add columns to transaction tables
    op.add_column('sales_orders', sa.Column('so_number', sa.String(length=50), nullable=True))
    op.create_index(op.f('ix_sales_orders_so_number'), 'sales_orders', ['so_number'], unique=False)
    
    op.add_column('purchase_orders', sa.Column('po_number', sa.String(length=50), nullable=True))
    op.create_index(op.f('ix_purchase_orders_po_number'), 'purchase_orders', ['po_number'], unique=False)
    
    op.add_column('grn', sa.Column('grn_number', sa.String(length=50), nullable=True))
    op.create_index(op.f('ix_grn_grn_number'), 'grn', ['grn_number'], unique=False)


def downgrade() -> None:
    # Drop columns from transaction tables
    op.drop_index(op.f('ix_grn_grn_number'), table_name='grn')
    op.drop_column('grn', 'grn_number')
    
    op.drop_index(op.f('ix_purchase_orders_po_number'), table_name='purchase_orders')
    op.drop_column('purchase_orders', 'po_number')
    
    op.drop_index(op.f('ix_sales_orders_so_number'), table_name='sales_orders')
    op.drop_column('sales_orders', 'so_number')

    # Drop columns from branches
    op.drop_column('branches', 'receipt_next_number')
    op.drop_column('branches', 'receipt_suffix')
    op.drop_column('branches', 'receipt_prefix')
    op.drop_column('branches', 'grn_next_number')
    op.drop_column('branches', 'grn_suffix')
    op.drop_column('branches', 'grn_prefix')
    op.drop_column('branches', 'po_next_number')
    op.drop_column('branches', 'po_suffix')
    op.drop_column('branches', 'po_prefix')
    op.drop_column('branches', 'challan_next_number')
    op.drop_column('branches', 'challan_suffix')
    op.drop_column('branches', 'challan_prefix')
    op.drop_column('branches', 'invoice_suffix')
    op.drop_column('branches', 'so_next_number')
    op.drop_column('branches', 'so_suffix')
    op.drop_column('branches', 'so_prefix')
