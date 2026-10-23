from datetime import datetime, time, timedelta, timezone
from typing import Any, Union
import zoneinfo
from jose import jwt
from passlib.context import CryptContext
from app.core.config import settings

# Initialize Passlib context for Bcrypt password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against the stored bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Generate a bcrypt hash of the plain text password."""
    return pwd_context.hash(password)


def get_business_timezone() -> zoneinfo.ZoneInfo:
    """Get the configured business timezone with safe fallback."""
    try:
        return zoneinfo.ZoneInfo(settings.BUSINESS_TIMEZONE)
    except Exception:
        return zoneinfo.ZoneInfo("Asia/Kolkata")


def get_most_recent_4am_cutoff() -> datetime:
    """
    Compute the UTC timestamp of the most recent 4:00 AM cutoff
    in the business timezone.
    """
    tz = get_business_timezone()
    now_tz = datetime.now(tz)
    cutoff_today = datetime.combine(now_tz.date(), time(settings.DAILY_RESET_HOUR, 0, 0), tzinfo=tz)
    if now_tz < cutoff_today:
        recent_tz = cutoff_today - timedelta(days=1)
    else:
        recent_tz = cutoff_today
    return recent_tz.astimezone(timezone.utc)


def get_next_4am_cutoff() -> datetime:
    """
    Compute the UTC timestamp of the upcoming 4:00 AM cutoff
    in the business timezone.
    """
    tz = get_business_timezone()
    now_tz = datetime.now(tz)
    cutoff_today = datetime.combine(now_tz.date(), time(settings.DAILY_RESET_HOUR, 0, 0), tzinfo=tz)
    if now_tz < cutoff_today:
        next_tz = cutoff_today
    else:
        next_tz = cutoff_today + timedelta(days=1)
    return next_tz.astimezone(timezone.utc)


def is_token_stale_by_daily_cutoff(iat_timestamp: Union[int, float, None]) -> bool:
    """
    Return True if the token was issued prior to the most recent 4:00 AM cutoff.
    Ensures that any session created before 4:00 AM cannot be used after 4:00 AM.
    """
    if not iat_timestamp:
        return True
    try:
        token_iat_utc = datetime.fromtimestamp(float(iat_timestamp), tz=timezone.utc)
        recent_cutoff = get_most_recent_4am_cutoff()
        return token_iat_utc < recent_cutoff
    except Exception:
        return True


def create_access_token(
    subject: Union[str, Any], expires_delta: timedelta = None
) -> str:
    """
    Create a signed JWT access token for authentication,
    capped at the upcoming 4:00 AM cutoff.
    """
    now_utc = datetime.now(timezone.utc)
    next_cutoff = get_next_4am_cutoff()

    if expires_delta:
        expire = now_utc + expires_delta
    else:
        expire = now_utc + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    # Cap access token to never outlive the next 4:00 AM cutoff
    if expire > next_cutoff:
        expire = next_cutoff

    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "type": "access",
        "iat": int(now_utc.timestamp()),
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(
    subject: Union[str, Any], expires_delta: timedelta = None
) -> str:
    """
    Create a signed JWT refresh token,
    capped at the upcoming 4:00 AM cutoff.
    """
    now_utc = datetime.now(timezone.utc)
    next_cutoff = get_next_4am_cutoff()

    if expires_delta:
        expire = now_utc + expires_delta
    else:
        expire = now_utc + timedelta(
            days=settings.REFRESH_TOKEN_EXPIRE_DAYS
        )

    # Cap refresh token to never outlive the next 4:00 AM cutoff
    if expire > next_cutoff:
        expire = next_cutoff

    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "type": "refresh",
        "iat": int(now_utc.timestamp()),
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
