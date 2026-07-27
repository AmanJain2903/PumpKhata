import asyncio
import logging
from datetime import date, timedelta
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.log import (
    DailyLogSession,
    DailyFinancialLog,
    DailyNozzleLog,
    DailyTankLog,
    DailyLogSessionPayment,
)
from app.models.credit import CreditTransaction, PumpAccountTransaction
from app.models.price_change import PriceChangeGainLoss
from app.models.product import ProductPriceHistory

logger = logging.getLogger(__name__)

async def run_cleanup_task():
    """
    Background task that deletes database records older than 2 years.
    Runs immediately on startup, then every 30 days.
    """
    logger.info("Background cleanup task started.")
    
    while True:
        try:
            # 2 years = 730 days
            cutoff_date = date.today() - timedelta(days=730)
            logger.info(f"Starting data cleanup. Deleting records older than: {cutoff_date}")
            
            # Use synchronous SQLAlchemy session in a threadpool to prevent blocking the event loop
            await asyncio.to_thread(_delete_old_records, cutoff_date)
            
            logger.info("Cleanup successful. Sleeping for 30 days.")
        except Exception as e:
            logger.error(f"Error in background cleanup task: {e}")
            logger.info("Will retry cleanup in 1 hour.")
            await asyncio.sleep(3600)
            continue
            
        # Sleep for 30 days (30 * 24 * 60 * 60 seconds)
        await asyncio.sleep(2592000)

def _delete_old_records(cutoff_date: date):
    """
    Synchronous function to perform the deletions in a single transaction.
    The order is critical to avoid foreign key constraint violations.
    """
    with SessionLocal() as db:
        try:
            # 1. Product Price History (uses valid_to)
            deleted_price_history = db.query(ProductPriceHistory).filter(ProductPriceHistory.valid_to < cutoff_date).delete(synchronize_session=False)
            
            # 2. Price Change Gain Loss (uses log_date)
            deleted_gain_loss = db.query(PriceChangeGainLoss).filter(PriceChangeGainLoss.log_date < cutoff_date).delete(synchronize_session=False)
            
            # 3. Daily Nozzle Logs (log_date)
            deleted_nozzle_logs = db.query(DailyNozzleLog).filter(DailyNozzleLog.log_date < cutoff_date).delete(synchronize_session=False)
            
            # 4. Daily Tank Logs (log_date)
            deleted_tank_logs = db.query(DailyTankLog).filter(DailyTankLog.log_date < cutoff_date).delete(synchronize_session=False)
            
            # 5. Session Payments (log_date)
            deleted_payments = db.query(DailyLogSessionPayment).filter(DailyLogSessionPayment.log_date < cutoff_date).delete(synchronize_session=False)
            
            # 6. Pump Account Transactions (log_date)
            deleted_account_tx = db.query(PumpAccountTransaction).filter(PumpAccountTransaction.log_date < cutoff_date).delete(synchronize_session=False)
            
            # 7. Credit Transactions (log_date)
            deleted_credit_tx = db.query(CreditTransaction).filter(CreditTransaction.log_date < cutoff_date).delete(synchronize_session=False)
            
            # 8. Daily Log Session (parent of 3, 4, 5, 6, 2)
            deleted_sessions = db.query(DailyLogSession).filter(DailyLogSession.log_date < cutoff_date).delete(synchronize_session=False)
            
            # 9. Daily Financial Log (independent, log_date)
            deleted_financials = db.query(DailyFinancialLog).filter(DailyFinancialLog.log_date < cutoff_date).delete(synchronize_session=False)
            
            # Commit all deletions in one atomic transaction
            db.commit()
            
            logger.info(
                f"Data cleanup complete. Deleted:\n"
                f"- ProductPriceHistory: {deleted_price_history}\n"
                f"- PriceChangeGainLoss: {deleted_gain_loss}\n"
                f"- DailyNozzleLog: {deleted_nozzle_logs}\n"
                f"- DailyTankLog: {deleted_tank_logs}\n"
                f"- DailyLogSessionPayment: {deleted_payments}\n"
                f"- PumpAccountTransaction: {deleted_account_tx}\n"
                f"- CreditTransaction: {deleted_credit_tx}\n"
                f"- DailyLogSession: {deleted_sessions}\n"
                f"- DailyFinancialLog: {deleted_financials}"
            )
        except Exception as e:
            db.rollback()
            raise e
