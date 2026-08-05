"""add_credit_debit_notes

Revision ID: 0020_add_credit_debit_notes
Revises: 0019_add_company_bank_details
Create Date: 2026-08-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0020_add_credit_debit_notes'
down_revision: Union[str, None] = '0019_add_company_bank_details'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add CN/DN sequence columns to branches table
    op.add_column('branches', sa.Column('cn_prefix', sa.String(length=20), server_default='CN-', nullable=False))
    op.add_column('branches', sa.Column('cn_suffix', sa.String(length=20), server_default='', nullable=False))
    op.add_column('branches', sa.Column('cn_next_number', sa.Integer(), server_default='1', nullable=False))
    op.add_column('branches', sa.Column('dn_prefix', sa.String(length=20), server_default='DN-', nullable=False))
    op.add_column('branches', sa.Column('dn_suffix', sa.String(length=20), server_default='', nullable=False))
    op.add_column('branches', sa.Column('dn_next_number', sa.Integer(), server_default='1', nullable=False))

    # 2. Create credit_notes table
    op.create_table(
        'credit_notes',
        sa.Column('id', sa.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('invoice_id', sa.UUID(as_uuid=True), nullable=True),
        sa.Column('branch_id', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('credit_note_number', sa.String(length=50), nullable=False),
        sa.Column('date', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('reason', sa.String(length=500), nullable=True),
        sa.Column('subtotal', sa.Float(), nullable=False, server_default='0'),
        sa.Column('tax_amount', sa.Float(), nullable=False, server_default='0'),
        sa.Column('total_amount', sa.Float(), nullable=False, server_default='0'),
        sa.Column('status', sa.String(length=30), nullable=False, server_default='Issued'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('credit_note_number')
    )
    op.create_index(op.f('ix_credit_notes_id'), 'credit_notes', ['id'], unique=False)
    op.create_index(op.f('ix_credit_notes_invoice_id'), 'credit_notes', ['invoice_id'], unique=False)
    op.create_index(op.f('ix_credit_notes_branch_id'), 'credit_notes', ['branch_id'], unique=False)
    op.create_index(op.f('ix_credit_notes_credit_note_number'), 'credit_notes', ['credit_note_number'], unique=True)

    # 3. Create credit_note_items table
    op.create_table(
        'credit_note_items',
        sa.Column('id', sa.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('credit_note_id', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('product_id', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('qty', sa.Float(), nullable=False),
        sa.Column('rate', sa.Float(), nullable=False),
        sa.Column('tax_rate', sa.Float(), nullable=False, server_default='18'),
        sa.Column('tax_amount', sa.Float(), nullable=False, server_default='0'),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['credit_note_id'], ['credit_notes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_credit_note_items_id'), 'credit_note_items', ['id'], unique=False)
    op.create_index(op.f('ix_credit_note_items_credit_note_id'), 'credit_note_items', ['credit_note_id'], unique=False)
    op.create_index(op.f('ix_credit_note_items_product_id'), 'credit_note_items', ['product_id'], unique=False)

    # 4. Create debit_notes table
    op.create_table(
        'debit_notes',
        sa.Column('id', sa.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('purchase_entry_id', sa.UUID(as_uuid=True), nullable=True),
        sa.Column('supplier_id', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('branch_id', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('debit_note_number', sa.String(length=50), nullable=False),
        sa.Column('date', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('reason', sa.String(length=500), nullable=True),
        sa.Column('subtotal', sa.Float(), nullable=False, server_default='0'),
        sa.Column('tax_amount', sa.Float(), nullable=False, server_default='0'),
        sa.Column('total_amount', sa.Float(), nullable=False, server_default='0'),
        sa.Column('status', sa.String(length=30), nullable=False, server_default='Issued'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['purchase_entry_id'], ['purchase_entries.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('debit_note_number')
    )
    op.create_index(op.f('ix_debit_notes_id'), 'debit_notes', ['id'], unique=False)
    op.create_index(op.f('ix_debit_notes_purchase_entry_id'), 'debit_notes', ['purchase_entry_id'], unique=False)
    op.create_index(op.f('ix_debit_notes_supplier_id'), 'debit_notes', ['supplier_id'], unique=False)
    op.create_index(op.f('ix_debit_notes_branch_id'), 'debit_notes', ['branch_id'], unique=False)
    op.create_index(op.f('ix_debit_notes_debit_note_number'), 'debit_notes', ['debit_note_number'], unique=True)

    # 5. Create debit_note_items table
    op.create_table(
        'debit_note_items',
        sa.Column('id', sa.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('debit_note_id', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('product_id', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('qty', sa.Float(), nullable=False),
        sa.Column('rate', sa.Float(), nullable=False),
        sa.Column('tax_rate', sa.Float(), nullable=False, server_default='18'),
        sa.Column('tax_amount', sa.Float(), nullable=False, server_default='0'),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['debit_note_id'], ['debit_notes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_debit_note_items_id'), 'debit_note_items', ['id'], unique=False)
    op.create_index(op.f('ix_debit_note_items_debit_note_id'), 'debit_note_items', ['debit_note_id'], unique=False)
    op.create_index(op.f('ix_debit_note_items_product_id'), 'debit_note_items', ['product_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_debit_note_items_product_id'), table_name='debit_note_items')
    op.drop_index(op.f('ix_debit_note_items_debit_note_id'), table_name='debit_note_items')
    op.drop_index(op.f('ix_debit_note_items_id'), table_name='debit_note_items')
    op.drop_table('debit_note_items')

    op.drop_index(op.f('ix_debit_notes_debit_note_number'), table_name='debit_notes')
    op.drop_index(op.f('ix_debit_notes_branch_id'), table_name='debit_notes')
    op.drop_index(op.f('ix_debit_notes_supplier_id'), table_name='debit_notes')
    op.drop_index(op.f('ix_debit_notes_purchase_entry_id'), table_name='debit_notes')
    op.drop_index(op.f('ix_debit_notes_id'), table_name='debit_notes')
    op.drop_table('debit_notes')

    op.drop_index(op.f('ix_credit_note_items_product_id'), table_name='credit_note_items')
    op.drop_index(op.f('ix_credit_note_items_credit_note_id'), table_name='credit_note_items')
    op.drop_index(op.f('ix_credit_note_items_id'), table_name='credit_note_items')
    op.drop_table('credit_note_items')

    op.drop_index(op.f('ix_credit_notes_credit_note_number'), table_name='credit_notes')
    op.drop_index(op.f('ix_credit_notes_branch_id'), table_name='credit_notes')
    op.drop_index(op.f('ix_credit_notes_invoice_id'), table_name='credit_notes')
    op.drop_index(op.f('ix_credit_notes_id'), table_name='credit_notes')
    op.drop_table('credit_notes')

    op.drop_column('branches', 'dn_next_number')
    op.drop_column('branches', 'dn_suffix')
    op.drop_column('branches', 'dn_prefix')
    op.drop_column('branches', 'cn_next_number')
    op.drop_column('branches', 'cn_suffix')
    op.drop_column('branches', 'cn_prefix')
