"""add_is_active_to_notes

Revision ID: 0021_add_is_active_to_notes
Revises: 0020_add_credit_debit_notes
Create Date: 2026-08-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0021_add_is_active_to_notes'
down_revision: Union[str, None] = '0020_add_credit_debit_notes'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_active to credit_notes
    op.add_column('credit_notes', sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False))
    op.create_index(op.f('ix_credit_notes_is_active'), 'credit_notes', ['is_active'], unique=False)

    # Add is_active to credit_note_items
    op.add_column('credit_note_items', sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False))
    op.create_index(op.f('ix_credit_note_items_is_active'), 'credit_note_items', ['is_active'], unique=False)

    # Add is_active to debit_notes
    op.add_column('debit_notes', sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False))
    op.create_index(op.f('ix_debit_notes_is_active'), 'debit_notes', ['is_active'], unique=False)

    # Add is_active to debit_note_items
    op.add_column('debit_note_items', sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False))
    op.create_index(op.f('ix_debit_note_items_is_active'), 'debit_note_items', ['is_active'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_debit_note_items_is_active'), table_name='debit_note_items')
    op.drop_column('debit_note_items', 'is_active')

    op.drop_index(op.f('ix_debit_notes_is_active'), table_name='debit_notes')
    op.drop_column('debit_notes', 'is_active')

    op.drop_index(op.f('ix_credit_note_items_is_active'), table_name='credit_note_items')
    op.drop_column('credit_note_items', 'is_active')

    op.drop_index(op.f('ix_credit_notes_is_active'), table_name='credit_notes')
    op.drop_column('credit_notes', 'is_active')
