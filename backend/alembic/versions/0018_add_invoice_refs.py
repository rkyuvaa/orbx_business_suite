"""add_invoice_refs

Revision ID: 0018_add_invoice_refs
Revises: 0017_add_company_email_templates
Create Date: 2026-07-01 20:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0018_add_invoice_refs'
down_revision: Union[str, None] = '0017_add_company_email_templates'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('invoices', sa.Column('reference_note', sa.String(length=255), nullable=True))
    op.add_column('invoices', sa.Column('reference_date', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('invoices', 'reference_date')
    op.drop_column('invoices', 'reference_note')
