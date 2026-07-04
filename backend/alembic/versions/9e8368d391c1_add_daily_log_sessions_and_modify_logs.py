"""add_daily_log_sessions_and_modify_logs

Revision ID: 9e8368d391c1
Revises: 5fa7542ce405
Create Date: 2026-06-28 18:03:21.015388

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9e8368d391c1'
down_revision: Union[str, Sequence[str], None] = '5fa7542ce405'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('daily_log_sessions',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('pump_id', sa.Integer(), nullable=False),
    sa.Column('log_date', sa.Date(), nullable=False),
    sa.Column('status', sa.Enum('OPEN', 'CLOSED', name='daily_log_session_status', native_enum=False), nullable=False),
    sa.Column('opened_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('opening_cash_balance', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.Column('fuel_cash_collected', sa.Numeric(precision=12, scale=2), nullable=True),
    sa.Column('fuel_digital_collected', sa.Numeric(precision=12, scale=2), nullable=True),
    sa.Column('credit_sales_total', sa.Numeric(precision=12, scale=2), nullable=True),
    sa.Column('expected_revenue', sa.Numeric(precision=12, scale=2), nullable=True),
    sa.Column('shortage_overage', sa.Numeric(precision=12, scale=2), nullable=True),
    sa.Column('credit_payments_cash_total', sa.Numeric(precision=12, scale=2), nullable=True),
    sa.Column('credit_payments_digital_total', sa.Numeric(precision=12, scale=2), nullable=True),
    sa.Column('misc_cash', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.0'),
    sa.Column('misc_digital', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.0'),
    sa.Column('misc_notes', sa.Text(), nullable=True),
    sa.Column('closing_cash_balance', sa.Numeric(precision=12, scale=2), nullable=True),
    sa.ForeignKeyConstraint(['pump_id'], ['fuel_pumps.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('pump_id', 'log_date', name='uq_pump_date_session')
    )
    op.create_index(op.f('ix_daily_log_sessions_id'), 'daily_log_sessions', ['id'], unique=False)
    
    # 2. Add new columns to existing tables initially as nullable
    op.add_column('credit_transactions', sa.Column('session_id', sa.BigInteger(), nullable=True))
    op.add_column('credit_transactions', sa.Column('payment_method', sa.Enum('CASH', 'ACCOUNT_TRANSFER', name='payment_method_type', native_enum=False), nullable=True))
    op.create_foreign_key(None, 'credit_transactions', 'daily_log_sessions', ['session_id'], ['id'])




    
    op.add_column('daily_nozzle_logs', sa.Column('session_id', sa.BigInteger(), nullable=True))
    op.add_column('daily_nozzle_logs', sa.Column('entry_index', sa.Integer(), nullable=True))
    op.add_column('daily_nozzle_logs', sa.Column('product_price', sa.Numeric(precision=10, scale=2), nullable=True))
    
    op.add_column('daily_tank_logs', sa.Column('session_id', sa.BigInteger(), nullable=True))

    # 3. Perform Data Migration / Backfill
    bind = op.get_bind()
    
    # Fetch existing financials to create base sessions
    financials = bind.execute(sa.text(
        "SELECT pump_id, log_date, log_timestamp, opening_cash_balance, expected_revenue, "
        "cash_collected, digital_collected, credit_sales_logged, closing_cash_balance, shortage_overage "
        "FROM daily_financial_logs"
    )).fetchall()
    
    sessions_map = {}
    for row in financials:
        pump_id, log_date, log_timestamp, opening_cash, expected_rev, cash_coll, dig_coll, credit_sales, closing_cash, shortage = row
        res = bind.execute(sa.text(
            "INSERT INTO daily_log_sessions (pump_id, log_date, status, opened_at, closed_at, "
            "opening_cash_balance, fuel_cash_collected, fuel_digital_collected, credit_sales_total, "
            "expected_revenue, shortage_overage, misc_cash, misc_digital, closing_cash_balance) "
            "VALUES (:pump_id, :log_date, 'CLOSED', :opened_at, :closed_at, "
            ":opening_cash_balance, :fuel_cash_collected, :fuel_digital_collected, :credit_sales_total, "
            ":expected_revenue, :shortage_overage, 0.0, 0.0, :closing_cash_balance) RETURNING id"
        ), {
            "pump_id": pump_id,
            "log_date": log_date,
            "opened_at": log_timestamp,
            "closed_at": log_timestamp,
            "opening_cash_balance": opening_cash,
            "expected_revenue": expected_rev,
            "fuel_cash_collected": cash_coll,
            "fuel_digital_collected": dig_coll,
            "credit_sales_total": credit_sales,
            "closing_cash_balance": closing_cash,
            "shortage_overage": shortage
        })
        session_id = res.scalar()
        sessions_map[(pump_id, log_date)] = session_id

    # Migrate nozzle logs
    nozzle_logs = bind.execute(sa.text(
        "SELECT nl.id, nl.nozzle_id, nl.log_date, nl.log_timestamp, n.tank_id, t.product_id, t.pump_id "
        "FROM daily_nozzle_logs nl "
        "JOIN nozzles n ON nl.nozzle_id = n.id "
        "JOIN tanks t ON n.tank_id = t.id"
    )).fetchall()
    
    for nl_row in nozzle_logs:
        nl_id, nozzle_id, log_date, log_timestamp, tank_id, product_id, pump_id = nl_row
        key = (pump_id, log_date)
        if key not in sessions_map:
            # Create session on the fly if financial log is missing
            res = bind.execute(sa.text(
                "INSERT INTO daily_log_sessions (pump_id, log_date, status, opened_at, closed_at, "
                "opening_cash_balance, misc_cash, misc_digital) "
                "VALUES (:pump_id, :log_date, 'CLOSED', :opened_at, :closed_at, 0.0, 0.0, 0.0) RETURNING id"
            ), {
                "pump_id": pump_id,
                "log_date": log_date,
                "opened_at": log_timestamp,
                "closed_at": log_timestamp
            })
            sessions_map[key] = res.scalar()
            
        session_id = sessions_map[key]
        
        # Look up product price
        price_row = bind.execute(sa.text(
            "SELECT selling_price FROM product_price_history "
            "WHERE product_id = :product_id AND valid_from <= :timestamp "
            "ORDER BY valid_from DESC LIMIT 1"
        ), {"product_id": product_id, "timestamp": log_timestamp}).fetchone()
        
        if price_row:
            price = price_row[0]
        else:
            prod_row = bind.execute(sa.text(
                "SELECT current_price FROM products WHERE id = :product_id"
            ), {"product_id": product_id}).fetchone()
            price = prod_row[0] if prod_row else 0.0
            
        bind.execute(sa.text(
            "UPDATE daily_nozzle_logs SET session_id = :session_id, entry_index = 0, product_price = :price "
            "WHERE id = :id"
        ), {"session_id": session_id, "price": price, "id": nl_id})

    # Migrate tank logs
    tank_logs = bind.execute(sa.text(
        "SELECT tl.id, tl.tank_id, tl.log_date, tl.log_timestamp, t.pump_id "
        "FROM daily_tank_logs tl "
        "JOIN tanks t ON tl.tank_id = t.id"
    )).fetchall()
    
    for tl_row in tank_logs:
        tl_id, tank_id, log_date, log_timestamp, pump_id = tl_row
        key = (pump_id, log_date)
        if key not in sessions_map:
            # Create session
            res = bind.execute(sa.text(
                "INSERT INTO daily_log_sessions (pump_id, log_date, status, opened_at, closed_at, "
                "opening_cash_balance, misc_cash, misc_digital) "
                "VALUES (:pump_id, :log_date, 'CLOSED', :opened_at, :closed_at, 0.0, 0.0, 0.0) RETURNING id"
            ), {
                "pump_id": pump_id,
                "log_date": log_date,
                "opened_at": log_timestamp,
                "closed_at": log_timestamp
            })
            sessions_map[key] = res.scalar()
            
        session_id = sessions_map[key]
        
        bind.execute(sa.text(
            "UPDATE daily_tank_logs SET session_id = :session_id WHERE id = :id"
        ), {"session_id": session_id, "id": tl_id})

    # 4. For any existing rows, set entry_index = 0 and product_price = 0.0 if not already backfilled
    bind.execute(sa.text("UPDATE daily_nozzle_logs SET entry_index = 0 WHERE entry_index IS NULL"))
    bind.execute(sa.text("UPDATE daily_nozzle_logs SET product_price = 0.0 WHERE product_price IS NULL"))

    # 5. Make backfilled columns NOT NULL
    op.alter_column('daily_nozzle_logs', 'session_id', nullable=False, existing_type=sa.BigInteger())
    op.alter_column('daily_nozzle_logs', 'entry_index', nullable=False, existing_type=sa.Integer())
    op.alter_column('daily_nozzle_logs', 'product_price', nullable=False, existing_type=sa.Numeric(precision=10, scale=2))
    
    op.alter_column('daily_tank_logs', 'session_id', nullable=False, existing_type=sa.BigInteger())

    # 6. Re-create Unique Constraints and Foreign Keys
    op.drop_constraint('uq_nozzle_daily_log', 'daily_nozzle_logs', type_='unique')
    op.create_unique_constraint('uq_nozzle_session_entry', 'daily_nozzle_logs', ['nozzle_id', 'session_id', 'entry_index'])
    op.create_foreign_key(None, 'daily_nozzle_logs', 'daily_log_sessions', ['session_id'], ['id'])
    
    op.drop_constraint('uq_tank_daily_log', 'daily_tank_logs', type_='unique')
    op.create_unique_constraint('uq_tank_session', 'daily_tank_logs', ['tank_id', 'session_id'])
    op.create_foreign_key(None, 'daily_tank_logs', 'daily_log_sessions', ['session_id'], ['id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(None, 'daily_tank_logs', type_='foreignkey')
    op.drop_constraint('uq_tank_session', 'daily_tank_logs', type_='unique')
    op.create_unique_constraint('uq_tank_daily_log', 'daily_tank_logs', ['tank_id', 'log_date'])
    op.drop_column('daily_tank_logs', 'session_id')
    
    op.drop_constraint(None, 'daily_nozzle_logs', type_='foreignkey')
    op.drop_constraint('uq_nozzle_session_entry', 'daily_nozzle_logs', type_='unique')
    op.create_unique_constraint('uq_nozzle_daily_log', 'daily_nozzle_logs', ['nozzle_id', 'log_date'])
    
    op.drop_column('daily_nozzle_logs', 'product_price')
    op.drop_column('daily_nozzle_logs', 'entry_index')
    op.drop_column('daily_nozzle_logs', 'session_id')
    
    op.drop_constraint(None, 'credit_transactions', type_='foreignkey')
    op.drop_column('credit_transactions', 'payment_method')
    op.drop_column('credit_transactions', 'session_id')
    
    op.drop_index(op.f('ix_daily_log_sessions_id'), table_name='daily_log_sessions')
    op.drop_table('daily_log_sessions')


