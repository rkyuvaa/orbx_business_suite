"""add_company_smtp_fields

Revision ID: 0016_add_company_smtp_fields
Revises: 0015_add_opening_balances
Create Date: 2026-06-23 20:05:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0016_add_company_smtp_fields'
down_revision: Union[str, None] = '0015_add_opening_balances'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('companies', sa.Column('smtp_host', sa.String(length=255), nullable=True))
    op.add_column('companies', sa.Column('smtp_port', sa.Integer(), nullable=True))
    op.add_column('companies', sa.Column('smtp_user', sa.String(length=255), nullable=True))
    op.add_column('companies', sa.Column('smtp_password', sa.String(length=255), nullable=True))
    op.add_column('companies', sa.Column('email_from', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('companies', 'email_from')
    op.drop_column('companies', 'smtp_password')
    op.drop_column('companies', 'smtp_user')
    op.drop_column('companies', 'smtp_port')
    op.drop_column('companies', 'smtp_host')
