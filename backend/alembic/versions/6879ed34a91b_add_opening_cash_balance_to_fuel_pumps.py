"""add_opening_cash_balance_to_fuel_pumps

Revision ID: 6879ed34a91b
Revises: d8c5ca3d43ce
Create Date: 2026-07-15 11:49:40.443414

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6879ed34a91b'
down_revision: Union[str, Sequence[str], None] = 'd8c5ca3d43ce'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('fuel_pumps', sa.Column('opening_cash_balance', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('fuel_pumps', 'opening_cash_balance')
