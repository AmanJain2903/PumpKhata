from datetime import datetime
from zoneinfo import ZoneInfo
from typing import Optional

IST = ZoneInfo("Asia/Kolkata")

def localize_datetime(v: Optional[datetime]) -> Optional[datetime]:
    if v is None:
        return None
    # If the datetime is naive (no timezone), localize it to IST
    if v.tzinfo is None:
        return v.replace(tzinfo=IST)
    # If it is already timezone-aware, convert it to IST
    return v.astimezone(IST)
