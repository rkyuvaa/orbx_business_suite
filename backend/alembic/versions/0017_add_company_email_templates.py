"""add_company_email_templates

Revision ID: 0017_add_company_email_templates
Revises: 0016_add_company_smtp_fields
Create Date: 2026-06-23 20:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0017_add_company_email_templates'
down_revision: Union[str, None] = '0016_add_company_smtp_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Adding subject and body templates to companies table
    op.add_column('companies', sa.Column('email_subject_template', sa.String(length=255), nullable=True))
    op.add_column('companies', sa.Column('email_body_template', sa.String(length=1000), nullable=True))


def downgrade() -> None:
    op.drop_column('companies', 'email_body_template')
    op.drop_column('companies', 'email_subject_template')
