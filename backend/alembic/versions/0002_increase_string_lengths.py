"""increase_string_lengths

Revision ID: 0002_increase_string_lengths
Revises: 0001_initial_schema
Create Date: 2026-06-01 23:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0002_increase_string_lengths'
down_revision: Union[str, None] = '0001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Alter companies
    op.alter_column('companies', 'phone', type_=sa.String(length=100))
    op.alter_column('companies', 'gstin', type_=sa.String(length=50))

    # Alter customers
    op.alter_column('customers', 'phone', type_=sa.String(length=100))
    op.alter_column('customers', 'gstin', type_=sa.String(length=50))

    # Alter suppliers
    op.alter_column('suppliers', 'phone', type_=sa.String(length=100))
    op.alter_column('suppliers', 'gstin', type_=sa.String(length=50))


def downgrade() -> None:
    # Revert companies
    op.alter_column('companies', 'phone', type_=sa.String(length=20))
    op.alter_column('companies', 'gstin', type_=sa.String(length=15))

    # Revert customers
    op.alter_column('customers', 'phone', type_=sa.String(length=20))
    op.alter_column('customers', 'gstin', type_=sa.String(length=15))

    # Revert suppliers
    op.alter_column('suppliers', 'phone', type_=sa.String(length=20))
    op.alter_column('suppliers', 'gstin', type_=sa.String(length=15))
