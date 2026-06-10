"""add_opening_balances

Revision ID: 0015_add_opening_balances
Revises: 0014_add_audit_to_journal_lines
Create Date: 2026-06-10 10:40:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0015_add_opening_balances'
down_revision: Union[str, None] = '0014_add_audit_to_journal_lines'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('customers', sa.Column('opening_bal', sa.Float(), server_default='0.0', nullable=False))
    op.add_column('customers', sa.Column('opening_bal_type', sa.String(length=10), server_default='Dr', nullable=False))
    
    op.add_column('suppliers', sa.Column('opening_bal', sa.Float(), server_default='0.0', nullable=False))
    op.add_column('suppliers', sa.Column('opening_bal_type', sa.String(length=10), server_default='Cr', nullable=False))


def downgrade() -> None:
    op.drop_column('suppliers', 'opening_bal_type')
    op.drop_column('suppliers', 'opening_bal')
    
    op.drop_column('customers', 'opening_bal_type')
    op.drop_column('customers', 'opening_bal')
