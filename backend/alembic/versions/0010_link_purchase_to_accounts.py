"""link_purchase_to_accounts

Revision ID: 0010_link_purchase_to_accounts
Revises: 0009_add_chart_of_accounts
Create Date: 2026-06-07 15:00:00.000000

"""
from typing import Sequence, Union
from datetime import datetime

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0010_link_purchase_to_accounts'
down_revision: Union[str, None] = '0009_add_chart_of_accounts'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add is_system column to ledger_accounts (with server default false)
    op.add_column('ledger_accounts', sa.Column('is_system', sa.Boolean(), nullable=False, server_default='false'))

    # 2. Create journal_entries table (date is Date type)
    op.create_table(
        'journal_entries',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('voucher_type_id', sa.UUID(), nullable=False),
        sa.Column('reference_id', sa.UUID(), nullable=True),
        sa.Column('reference_type', sa.String(length=50), nullable=True),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('narration', sa.String(length=255), nullable=True),
        sa.Column('is_reversed', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_by_id', sa.UUID(), nullable=True),
        sa.Column('updated_by_id', sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['voucher_type_id'], ['voucher_types.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_journal_entries_reference_id'), 'journal_entries', ['reference_id'], unique=False)
    op.create_index(op.f('ix_journal_entries_reference_type'), 'journal_entries', ['reference_type'], unique=False)

    # 3. Create journal_entry_lines table (ledger_id indexed)
    op.create_table(
        'journal_entry_lines',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('journal_entry_id', sa.UUID(), nullable=False),
        sa.Column('ledger_id', sa.UUID(), nullable=False),
        sa.Column('dr_cr', sa.String(length=10), nullable=False),
        sa.Column('amount', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('narration', sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(['journal_entry_id'], ['journal_entries.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['ledger_id'], ['ledger_accounts.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_journal_lines_ledger_id', 'journal_entry_lines', ['ledger_id'], unique=False)

    # 4. Create purchase_returns table (date is Date type, amounts are Numeric(15, 2))
    op.create_table(
        'purchase_returns',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('supplier_id', sa.UUID(), nullable=False),
        sa.Column('branch_id', sa.UUID(), nullable=False),
        sa.Column('purchase_entry_id', sa.UUID(), nullable=True),
        sa.Column('journal_entry_id', sa.UUID(), nullable=True),
        sa.Column('return_number', sa.String(length=50), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('subtotal', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('tax_amount', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('total_amount', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('debit_note_ledger_id', sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['debit_note_ledger_id'], ['ledger_accounts.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['journal_entry_id'], ['journal_entries.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['purchase_entry_id'], ['purchase_entries.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('return_number')
    )

    # 5. Add columns to purchase_entries table
    op.add_column('purchase_entries', sa.Column('payable_ledger_id', sa.UUID(), nullable=True))
    op.add_column('purchase_entries', sa.Column('purchase_account_id', sa.UUID(), nullable=True))
    op.add_column('purchase_entries', sa.Column('tax_ledger_id', sa.UUID(), nullable=True))
    op.add_column('purchase_entries', sa.Column('journal_entry_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_purchase_entries_payable_ledger', 'purchase_entries', 'ledger_accounts', ['payable_ledger_id'], ['id'], ondelete='RESTRICT')
    op.create_foreign_key('fk_purchase_entries_purchase_account', 'purchase_entries', 'ledger_accounts', ['purchase_account_id'], ['id'], ondelete='RESTRICT')
    op.create_foreign_key('fk_purchase_entries_tax_ledger', 'purchase_entries', 'ledger_accounts', ['tax_ledger_id'], ['id'], ondelete='RESTRICT')
    op.create_foreign_key('fk_purchase_entries_journal_entry', 'purchase_entries', 'journal_entries', ['journal_entry_id'], ['id'], ondelete='SET NULL')

    # 6. Add default_payable_ledger_id column to suppliers table
    op.add_column('suppliers', sa.Column('default_payable_ledger_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_suppliers_default_payable_ledger', 'suppliers', 'ledger_accounts', ['default_payable_ledger_id'], ['id'], ondelete='RESTRICT')

    # ==========================================
    # DATA SEEDING & BACKFILLS (strictly ordered)
    # ==========================================
    conn = op.get_bind()

    # Seed Default System Ledgers (idempotent ON CONFLICT DO NOTHING block)
    conn.execute(
        sa.text(
            "INSERT INTO ledger_accounts (id, code, name, group_id, opening_bal, opening_bal_type, currency, is_closing_stock, sundry_type, partnership_type, is_system, is_active, created_at, updated_at) "
            "VALUES ('22210000-0000-0000-0000-000000000002', 'SYS-22201', 'Default Sundry Creditors', '22200000-0000-0000-0000-000000000002', 0.00, 'Cr', 'INR', false, 'Creditor', NULL, true, true, NOW(), NOW()) "
            "ON CONFLICT (id) DO NOTHING"
        )
    )

    conn.execute(
        sa.text(
            "INSERT INTO ledger_accounts (id, code, name, group_id, opening_bal, opening_bal_type, currency, is_closing_stock, sundry_type, partnership_type, is_system, is_active, created_at, updated_at) "
            "VALUES ('51100000-0000-0000-0000-000000000005', 'SYS-51001', 'Purchase Account', '51000000-0000-0000-0000-000000000005', 0.00, 'Dr', 'INR', false, NULL, NULL, true, true, NOW(), NOW()) "
            "ON CONFLICT (id) DO NOTHING"
        )
    )

    conn.execute(
        sa.text(
            "INSERT INTO ledger_accounts (id, code, name, group_id, opening_bal, opening_bal_type, currency, is_closing_stock, sundry_type, partnership_type, is_system, is_active, created_at, updated_at) "
            "VALUES ('12410000-0000-0000-0000-000000000001', 'SYS-12401', 'GST Input Tax', '12000000-0000-0000-0000-000000000001', 0.00, 'Dr', 'INR', false, NULL, NULL, true, true, NOW(), NOW()) "
            "ON CONFLICT (id) DO NOTHING"
        )
    )

    # Update existing supplier records to link to Default Sundry Creditors
    conn.execute(
        sa.text(
            "UPDATE suppliers SET default_payable_ledger_id = '22210000-0000-0000-0000-000000000002' "
            "WHERE default_payable_ledger_id IS NULL"
        )
    )

    # Update existing purchase bills (entries) to link to seeded default accounts
    # Note: Historical purchase entries are linked to default ledgers but no journal entries are backfilled.
    # Backfill script to be run separately if needed.
    conn.execute(
        sa.text(
            "UPDATE purchase_entries SET "
            "  payable_ledger_id = '22210000-0000-0000-0000-000000000002', "
            "  purchase_account_id = '51100000-0000-0000-0000-000000000005', "
            "  tax_ledger_id = '12410000-0000-0000-0000-000000000001' "
            "WHERE payable_ledger_id IS NULL"
        )
    )


def downgrade() -> None:
    # Remove FK columns on purchase_entries and suppliers
    op.drop_constraint('fk_suppliers_default_payable_ledger', 'suppliers', type_='foreignkey')
    op.drop_column('suppliers', 'default_payable_ledger_id')

    op.drop_constraint('fk_purchase_entries_journal_entry', 'purchase_entries', type_='foreignkey')
    op.drop_constraint('fk_purchase_entries_tax_ledger', 'purchase_entries', type_='foreignkey')
    op.drop_constraint('fk_purchase_entries_purchase_account', 'purchase_entries', type_='foreignkey')
    op.drop_constraint('fk_purchase_entries_payable_ledger', 'purchase_entries', type_='foreignkey')
    op.drop_column('purchase_entries', 'journal_entry_id')
    op.drop_column('purchase_entries', 'tax_ledger_id')
    op.drop_column('purchase_entries', 'purchase_account_id')
    op.drop_column('purchase_entries', 'payable_ledger_id')

    # Drop tables
    op.drop_table('purchase_returns')
    op.drop_index('ix_journal_lines_ledger_id', table_name='journal_entry_lines')
    op.drop_table('journal_entry_lines')
    op.drop_index(op.f('ix_journal_entries_reference_type'), table_name='journal_entries')
    op.drop_index(op.f('ix_journal_entries_reference_id'), table_name='journal_entries')
    op.drop_table('journal_entries')

    # Remove system seeded defaults
    conn = op.get_bind()
    conn.execute(sa.text("DELETE FROM ledger_accounts WHERE id IN ('22210000-0000-0000-0000-000000000002', '51100000-0000-0000-0000-000000000005', '12410000-0000-0000-0000-000000000001')"))
    
    # Remove is_system column from ledger_accounts
    op.drop_column('ledger_accounts', 'is_system')
