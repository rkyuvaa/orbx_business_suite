"""add_audit_log_and_tds

Revision ID: 0012_add_audit_log_and_tds
Revises: 0011_add_report_columns
Create Date: 2026-06-07 16:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0012_add_audit_log_and_tds'
down_revision: Union[str, None] = '0011_add_report_columns'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create audit_logs table
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ip_address', sa.String(length=50), nullable=True),
        sa.Column('action', sa.String(length=20), nullable=False),
        sa.Column('table_name', sa.String(length=100), nullable=False),
        sa.Column('record_id', sa.UUID(), nullable=False),
        sa.Column('old_values', sa.JSON(), nullable=True),
        sa.Column('new_values', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_audit_logs_user_id'), 'audit_logs', ['user_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_timestamp'), 'audit_logs', ['timestamp'], unique=False)
    op.create_index(op.f('ix_audit_logs_record_id'), 'audit_logs', ['record_id'], unique=False)

    # 2. Add TDS columns to purchase_entries
    op.add_column('purchase_entries', sa.Column('tds_section', sa.String(length=20), nullable=True))
    op.add_column('purchase_entries', sa.Column('tds_rate', sa.Numeric(precision=5, scale=2), server_default='0.00', nullable=False))
    op.add_column('purchase_entries', sa.Column('tds_amount', sa.Numeric(precision=15, scale=2), server_default='0.00', nullable=False))


def downgrade() -> None:
    # 1. Drop TDS columns from purchase_entries
    op.drop_column('purchase_entries', 'tds_amount')
    op.drop_column('purchase_entries', 'tds_rate')
    op.drop_column('purchase_entries', 'tds_section')

    # 2. Drop audit_logs table
    op.drop_index(op.f('ix_audit_logs_record_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_timestamp'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_user_id'), table_name='audit_logs')
    op.drop_table('audit_logs')
