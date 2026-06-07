"""add_report_columns

Revision ID: 0011_add_report_columns
Revises: 0010_link_purchase_to_accounts
Create Date: 2026-06-07 16:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0011_add_report_columns'
down_revision: Union[str, None] = '0010_link_purchase_to_accounts'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add voucher_number to journal_entries
    op.add_column('journal_entries', sa.Column('voucher_number', sa.String(length=50), nullable=True))
    op.create_index(op.f('ix_journal_entries_voucher_number'), 'journal_entries', ['voucher_number'], unique=False)

    # 2. Add cgst_amount, sgst_amount, igst_amount to purchase_entries
    op.add_column('purchase_entries', sa.Column('cgst_amount', sa.Numeric(precision=15, scale=2), server_default='0.00', nullable=False))
    op.add_column('purchase_entries', sa.Column('sgst_amount', sa.Numeric(precision=15, scale=2), server_default='0.00', nullable=False))
    op.add_column('purchase_entries', sa.Column('igst_amount', sa.Numeric(precision=15, scale=2), server_default='0.00', nullable=False))

    # 3. Create sequences for each seeded voucher type for current financial year (2026-2027)
    op.execute("CREATE SEQUENCE IF NOT EXISTS voucher_seq_pmt_2627 START 1 INCREMENT 1")
    op.execute("CREATE SEQUENCE IF NOT EXISTS voucher_seq_rct_2627 START 1 INCREMENT 1")
    op.execute("CREATE SEQUENCE IF NOT EXISTS voucher_seq_jv_2627 START 1 INCREMENT 1")
    op.execute("CREATE SEQUENCE IF NOT EXISTS voucher_seq_ctr_2627 START 1 INCREMENT 1")
    op.execute("CREATE SEQUENCE IF NOT EXISTS voucher_seq_sls_2627 START 1 INCREMENT 1")
    op.execute("CREATE SEQUENCE IF NOT EXISTS voucher_seq_pur_2627 START 1 INCREMENT 1")


def downgrade() -> None:
    # 1. Drop sequences
    op.execute("DROP SEQUENCE IF EXISTS voucher_seq_pur_2627")
    op.execute("DROP SEQUENCE IF EXISTS voucher_seq_sls_2627")
    op.execute("DROP SEQUENCE IF EXISTS voucher_seq_ctr_2627")
    op.execute("DROP SEQUENCE IF EXISTS voucher_seq_jv_2627")
    op.execute("DROP SEQUENCE IF EXISTS voucher_seq_rct_2627")
    op.execute("DROP SEQUENCE IF EXISTS voucher_seq_pmt_2627")

    # 2. Drop columns
    op.drop_column('purchase_entries', 'igst_amount')
    op.drop_column('purchase_entries', 'sgst_amount')
    op.drop_column('purchase_entries', 'cgst_amount')

    op.drop_index(op.f('ix_journal_entries_voucher_number'), table_name='journal_entries')
    op.drop_column('journal_entries', 'voucher_number')
