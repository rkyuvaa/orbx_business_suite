"""add_company_state_code

Revision ID: 0004_add_company_state_code
Revises: 0003_add_alternative_phone
Create Date: 2026-06-02 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0004_add_company_state_code'
down_revision: Union[str, None] = '0003_add_alternative_phone'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add column to companies
    op.add_column('companies', sa.Column('state_code', sa.String(length=10), nullable=True))


def downgrade() -> None:
    # Drop column from companies
    op.drop_column('companies', 'state_code')
