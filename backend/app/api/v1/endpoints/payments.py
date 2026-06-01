from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import deps
from app.schemas.transaction import InvoiceOut, PaymentOut, PaymentCreate, PaymentReceiptOut
from app.services.tx_services import TxServices

router = APIRouter()


@router.get("/outstanding", response_model=List[InvoiceOut])
async def list_outstanding_bills(
    customer_id: Optional[UUID] = Query(None, description="Filter outstanding invoices by customer"),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("payments", "view"))
):
    """List outstanding unpaid or partially paid tax invoices."""
    return await TxServices.list_outstanding_invoices(db, customer_id)


@router.post("/", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
async def record_payment_update(
    pay_data: PaymentCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("payments", "create"))
):
    """Log a customer payment against outstanding invoices and auto-spawn printable receipts."""
    return await TxServices.create_payment(db, pay_data)


@router.get("/receipts/{payment_id}", response_model=PaymentReceiptOut)
async def fetch_receipt_print(
    payment_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("payments", "view"))
):
    """Fetch printable transaction payment receipts."""
    return await TxServices.get_receipt(db, payment_id)
