import contextvars
from typing import Optional
from uuid import UUID

current_user_id: contextvars.ContextVar[Optional[UUID]] = contextvars.ContextVar("current_user_id", default=None)
current_ip: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("current_ip", default=None)
