from uuid import UUID
from datetime import date

# Seeded fallback ledger accounts UUID constants (Schedule III aligned)
DEFAULT_SUNDRY_CREDITORS_LEDGER_ID = UUID("22210000-0000-0000-0000-000000000002")
DEFAULT_PURCHASE_LEDGER_ID         = UUID("51100000-0000-0000-0000-000000000005")
DEFAULT_GST_INPUT_LEDGER_ID        = UUID("12410000-0000-0000-0000-000000000001")
DEFAULT_GST_OUTPUT_LEDGER_ID       = UUID("23100000-0000-0000-0000-000000000002")

# Set of system-allocated ledgers to guard against deletion
SYSTEM_LEDGER_IDS: frozenset[UUID] = frozenset({
    DEFAULT_SUNDRY_CREDITORS_LEDGER_ID,
    DEFAULT_PURCHASE_LEDGER_ID,
    DEFAULT_GST_INPUT_LEDGER_ID,
    DEFAULT_GST_OUTPUT_LEDGER_ID,
})

def current_fy_dates() -> tuple[date, date]:
    """Resolve current Indian financial year date boundaries (April 1st to March 31st)."""
    today = date.today()
    if today.month >= 4:
        return date(today.year, 4, 1), date(today.year + 1, 3, 31)
    return date(today.year - 1, 4, 1), date(today.year, 3, 31)
