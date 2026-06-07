"""add_chart_of_accounts

Revision ID: 0009_add_chart_of_accounts
Revises: 0008_vendor_pay_audit
Create Date: 2026-06-07 14:00:00.000000

"""
from typing import Sequence, Union
from datetime import datetime

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0009_add_chart_of_accounts'
down_revision: Union[str, None] = '0008_vendor_pay_audit'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create Tables
    op.create_table(
        'account_groups',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('parent_id', sa.UUID(), nullable=True),
        sa.Column('nature', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_by_id', sa.UUID(), nullable=True),
        sa.Column('updated_by_id', sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['parent_id'], ['account_groups.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_account_groups_is_active'), 'account_groups', ['is_active'], unique=False)
    op.create_index(op.f('ix_account_groups_name'), 'account_groups', ['name'], unique=True)
    op.create_index(op.f('ix_account_groups_parent_id'), 'account_groups', ['parent_id'], unique=False)

    op.create_table(
        'ledger_accounts',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('code', sa.String(length=30), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('group_id', sa.UUID(), nullable=False),
        sa.Column('opening_bal', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('opening_bal_type', sa.String(length=10), nullable=False),
        sa.Column('currency', sa.String(length=10), nullable=False),
        sa.Column('is_closing_stock', sa.Boolean(), nullable=False),
        sa.Column('sundry_type', sa.String(length=20), nullable=True),
        sa.Column('partnership_type', sa.String(length=20), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_by_id', sa.UUID(), nullable=True),
        sa.Column('updated_by_id', sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['group_id'], ['account_groups.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['updated_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name', 'group_id', name='uq_ledger_name_group')
    )
    op.create_index(op.f('ix_ledger_accounts_code'), 'ledger_accounts', ['code'], unique=True)
    op.create_index(op.f('ix_ledger_accounts_group_id'), 'ledger_accounts', ['group_id'], unique=False)
    op.create_index(op.f('ix_ledger_accounts_is_active'), 'ledger_accounts', ['is_active'], unique=False)
    op.create_index(op.f('ix_ledger_accounts_name'), 'ledger_accounts', ['name'], unique=False)

    op.create_table(
        'voucher_types',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('prefix', sa.String(length=20), nullable=False),
        sa.Column('numbering_method', sa.String(length=30), nullable=False),
        sa.Column('is_system', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_by_id', sa.UUID(), nullable=True),
        sa.Column('updated_by_id', sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_voucher_types_is_active'), 'voucher_types', ['is_active'], unique=False)
    op.create_index(op.f('ix_voucher_types_name'), 'voucher_types', ['name'], unique=True)

    # 2. Seed Default Accounts & Groups (stable UUIDs)
    # Wrap in transaction block cleanly via connection execution
    conn = op.get_bind()
    now_dt = datetime.utcnow()

    # Seed Account Groups (parent before child)
    groups = [
        # Level 0 (Roots)
        {"id": "10000000-0000-0000-0000-000000000001", "name": "Assets", "parent_id": None, "nature": "Debit"},
        {"id": "20000000-0000-0000-0000-000000000002", "name": "Liabilities", "parent_id": None, "nature": "Credit"},
        {"id": "30000000-0000-0000-0000-000000000003", "name": "Capital", "parent_id": None, "nature": "Credit"},
        {"id": "40000000-0000-0000-0000-000000000004", "name": "Income", "parent_id": None, "nature": "Credit"},
        {"id": "50000000-0000-0000-0000-000000000005", "name": "Expenses", "parent_id": None, "nature": "Debit"},

        # Level 1 (Under Assets)
        {"id": "11000000-0000-0000-0000-000000000001", "name": "Non-Current Assets", "parent_id": "10000000-0000-0000-0000-000000000001", "nature": "Debit"},
        {"id": "12000000-0000-0000-0000-000000000001", "name": "Current Assets", "parent_id": "10000000-0000-0000-0000-000000000001", "nature": "Debit"},

        # Level 1 (Under Liabilities)
        {"id": "21000000-0000-0000-0000-000000000002", "name": "Non-Current Liabilities", "parent_id": "20000000-0000-0000-0000-000000000002", "nature": "Credit"},
        {"id": "22000000-0000-0000-0000-000000000002", "name": "Current Liabilities", "parent_id": "20000000-0000-0000-0000-000000000002", "nature": "Credit"},

        # Level 1 (Under Capital)
        {"id": "31000000-0000-0000-0000-000000000003", "name": "Share/Partner Capital Accounts", "parent_id": "30000000-0000-0000-0000-000000000003", "nature": "Credit"},
        {"id": "32000000-0000-0000-0000-000000000003", "name": "Reserves and Surplus", "parent_id": "30000000-0000-0000-0000-000000000003", "nature": "Credit"},

        # Level 1 (Under Income)
        {"id": "41000000-0000-0000-0000-000000000004", "name": "Revenue from Operations (Sales)", "parent_id": "40000000-0000-0000-0000-000000000004", "nature": "Credit"},
        {"id": "42000000-0000-0000-0000-000000000004", "name": "Other Income", "parent_id": "40000000-0000-0000-0000-000000000004", "nature": "Credit"},

        # Level 1 (Under Expenses)
        {"id": "51000000-0000-0000-0000-000000000005", "name": "Cost of Materials Consumed (Purchases)", "parent_id": "50000000-0000-0000-0000-000000000005", "nature": "Debit"},
        {"id": "52000000-0000-0000-0000-000000000005", "name": "Employee Benefit Expenses", "parent_id": "50000000-0000-0000-0000-000000000005", "nature": "Debit"},
        {"id": "53000000-0000-0000-0000-000000000005", "name": "Finance Costs", "parent_id": "50000000-0000-0000-0000-000000000005", "nature": "Debit"},
        {"id": "54000000-0000-0000-0000-000000000005", "name": "Depreciation and Amortization", "parent_id": "50000000-0000-0000-0000-000000000005", "nature": "Debit"},
        {"id": "55000000-0000-0000-0000-000000000005", "name": "Other Expenses", "parent_id": "50000000-0000-0000-0000-000000000005", "nature": "Debit"},

        # Level 2 (Subgroups under Non-Current Assets)
        {"id": "11100000-0000-0000-0000-000000000001", "name": "Fixed Assets (Property, Plant & Equipment)", "parent_id": "11000000-0000-0000-0000-000000000001", "nature": "Debit"},
        {"id": "11200000-0000-0000-0000-000000000001", "name": "Non-Current Investments", "parent_id": "11000000-0000-0000-0000-000000000001", "nature": "Debit"},

        # Level 2 (Subgroups under Current Assets)
        {"id": "12100000-0000-0000-0000-000000000001", "name": "Inventories (Stock-in-Hand)", "parent_id": "12000000-0000-0000-0000-000000000001", "nature": "Debit"},
        {"id": "12200000-0000-0000-0000-000000000001", "name": "Trade Receivables (Sundry Debtors)", "parent_id": "12000000-0000-0000-0000-000000000001", "nature": "Debit"},
        {"id": "12300000-0000-0000-0000-000000000001", "name": "Cash and Cash Equivalents", "parent_id": "12000000-0000-0000-0000-000000000001", "nature": "Debit"},
        {"id": "12400000-0000-0000-0000-000000000001", "name": "Short-term Loans and Advances", "parent_id": "12000000-0000-0000-0000-000000000001", "nature": "Debit"},

        # Level 2 (Subgroups under Non-Current Liabilities)
        {"id": "21100000-0000-0000-0000-000000000002", "name": "Long-term Borrowings", "parent_id": "21000000-0000-0000-0000-000000000002", "nature": "Credit"},

        # Level 2 (Subgroups under Current Liabilities)
        {"id": "22100000-0000-0000-0000-000000000002", "name": "Short-term Borrowings", "parent_id": "22000000-0000-0000-0000-000000000002", "nature": "Credit"},
        {"id": "22200000-0000-0000-0000-000000000002", "name": "Trade Payables (Sundry Creditors)", "parent_id": "22000000-0000-0000-0000-000000000002", "nature": "Credit"},
        {"id": "22300000-0000-0000-0000-000000000002", "name": "Short-term Provisions", "parent_id": "22000000-0000-0000-0000-000000000002", "nature": "Credit"},
    ]

    for g in groups:
        conn.execute(
            sa.text(
                "INSERT INTO account_groups (id, name, parent_id, nature, created_at, updated_at, is_active) "
                "VALUES (:id, :name, :parent_id, :nature, :created_at, :updated_at, true)"
            ),
            {
                "id": g["id"],
                "name": g["name"],
                "parent_id": g["parent_id"],
                "nature": g["nature"],
                "created_at": now_dt,
                "updated_at": now_dt,
            }
        )

    # Seed Voucher Types
    vouchers = [
        {"id": "91000000-0000-0000-0000-000000000001", "name": "Payment", "prefix": "PMT", "numbering_method": "Automatic"},
        {"id": "91000000-0000-0000-0000-000000000002", "name": "Receipt", "prefix": "RCT", "numbering_method": "Automatic"},
        {"id": "91000000-0000-0000-0000-000000000003", "name": "Journal", "prefix": "JV", "numbering_method": "Automatic"},
        {"id": "91000000-0000-0000-0000-000000000004", "name": "Contra", "prefix": "CTR", "numbering_method": "Automatic"},
        {"id": "91000000-0000-0000-0000-000000000005", "name": "Sales", "prefix": "SLS", "numbering_method": "Automatic"},
        {"id": "91000000-0000-0000-0000-000000000006", "name": "Purchase", "prefix": "PUR", "numbering_method": "Automatic"},
    ]

    for v in vouchers:
        conn.execute(
            sa.text(
                "INSERT INTO voucher_types (id, name, prefix, numbering_method, is_system, created_at, updated_at, is_active) "
                "VALUES (:id, :name, :prefix, :numbering_method, true, :created_at, :updated_at, true)"
            ),
            {
                "id": v["id"],
                "name": v["name"],
                "prefix": v["prefix"],
                "numbering_method": v["numbering_method"],
                "created_at": now_dt,
                "updated_at": now_dt,
            }
        )


def downgrade() -> None:
    # 1. Clear seed data
    conn = op.get_bind()
    conn.execute(sa.text("DELETE FROM voucher_types WHERE is_system = true"))
    conn.execute(sa.text("DELETE FROM account_groups WHERE parent_id IS NOT NULL"))
    conn.execute(sa.text("DELETE FROM account_groups WHERE parent_id IS NULL"))

    # 2. Drop Tables
    op.drop_table('voucher_types')
    op.drop_index(op.f('ix_ledger_accounts_name'), table_name='ledger_accounts')
    op.drop_index(op.f('ix_ledger_accounts_is_active'), table_name='ledger_accounts')
    op.drop_index(op.f('ix_ledger_accounts_group_id'), table_name='ledger_accounts')
    op.drop_index(op.f('ix_ledger_accounts_code'), table_name='ledger_accounts')
    op.drop_table('ledger_accounts')
    
    op.drop_index(op.f('ix_account_groups_parent_id'), table_name='account_groups')
    op.drop_index(op.f('ix_account_groups_name'), table_name='account_groups')
    op.drop_index(op.f('ix_account_groups_is_active'), table_name='account_groups')
    op.drop_table('account_groups')
