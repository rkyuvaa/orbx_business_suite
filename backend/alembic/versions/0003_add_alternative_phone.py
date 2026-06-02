"""add_alternative_phone

Revision ID: 0003_add_alternative_phone
Revises: 0002_increase_string_lengths
Create Date: 2026-06-02 19:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0003_add_alternative_phone'
down_revision: Union[str, None] = '0002_increase_string_lengths'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add column to customers
    op.add_column('customers', sa.Column('alternative_phone', sa.String(length=100), nullable=True))
    
    # Add column to suppliers
    op.add_column('suppliers', sa.Column('alternative_phone', sa.String(length=100), nullable=True))


def downgrade() -> None:
    # Drop column from customers
    op.drop_column('customers', 'alternative_phone')
    
    # Drop column from suppliers
    op.drop_column('suppliers', 'alternative_phone')
