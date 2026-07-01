"""add_company_bank_details

Revision ID: 0019_add_company_bank_details
Revises: 0018_add_invoice_refs
Create Date: 2026-07-01 22:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0019_add_company_bank_details'
down_revision: Union[str, None] = '0018_add_invoice_refs'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('companies', sa.Column('bank_name', sa.String(length=100), nullable=True))
    op.add_column('companies', sa.Column('bank_account_no', sa.String(length=50), nullable=True))
    op.add_column('companies', sa.Column('bank_ifsc_code', sa.String(length=30), nullable=True))
    op.add_column('companies', sa.Column('bank_branch_location', sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column('companies', 'bank_branch_location')
    op.drop_column('companies', 'bank_ifsc_code')
    op.drop_column('companies', 'bank_account_no')
    op.drop_column('companies', 'bank_name')
