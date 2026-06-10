"""add_audit_to_journal_lines

Revision ID: 0014_add_audit_to_journal_lines
Revises: 0013_add_audit_log_fields
Create Date: 2026-06-10 10:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0014_add_audit_to_journal_lines'
down_revision: Union[str, None] = '0013_add_audit_log_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('journal_entry_lines', sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))
    op.add_column('journal_entry_lines', sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))
    op.add_column('journal_entry_lines', sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False))
    op.create_index(op.f('ix_journal_entry_lines_is_active'), 'journal_entry_lines', ['is_active'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_journal_entry_lines_is_active'), table_name='journal_entry_lines')
    op.drop_column('journal_entry_lines', 'is_active')
    op.drop_column('journal_entry_lines', 'updated_at')
    op.drop_column('journal_entry_lines', 'created_at')
