from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import deps
from app.schemas.transaction import (
    PurchaseOrderOut, PurchaseOrderCreate,
    GRNOut, GRNCreate,
    PurchaseEntryOut, PurchaseEntryCreate,
    VendorPaymentCreate, VendorPaymentOut
)
from app.services.tx_services import TxServices

router = APIRouter()


# ==========================================
# PURCHASE ORDERS ENDPOINTS
# ==========================================
@router.get("/po", response_model=List[PurchaseOrderOut])
async def list_purchase_orders(
    branch_id: Optional[UUID] = Query(None, description="Filter POs by branch"),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("purchase", "view"))
):
    """Retrieve lists of purchase orders."""
    return await TxServices.list_purchase_orders(db, branch_id)


@router.post("/po", response_model=PurchaseOrderOut, status_code=status.HTTP_201_CREATED)
async def create_purchase_order(
    po_data: PurchaseOrderCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("purchase", "create"))
):
    """Create a new Purchase Order."""
    return await TxServices.create_purchase_order(db, po_data)


# ==========================================
# GOODS RECEIPT NOTES (GRN) ENDPOINTS
# ==========================================
@router.get("/grn", response_model=List[GRNOut])
async def list_grns(
    branch_id: Optional[UUID] = Query(None, description="Filter GRNs by branch"),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("purchase", "view"))
):
    """List all Goods Receipt Notes."""
    return await TxServices.list_grns(db, branch_id)


@router.post("/grn", response_model=GRNOut, status_code=status.HTTP_201_CREATED)
async def create_grn(
    grn_data: GRNCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("purchase", "create"))
):
    """Record a Goods Receipt Note and increment active stock positions."""
    return await TxServices.create_grn(db, grn_data, current_user.id)


# ==========================================
# PURCHASE ENTRIES (BILLS) ENDPOINTS
# ==========================================
@router.get("/bills", response_model=List[PurchaseEntryOut])
async def list_bills(
    branch_id: Optional[UUID] = Query(None, description="Filter bills by branch"),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("purchase", "view"))
):
    """List all purchase entries/bills."""
    return await TxServices.list_purchase_entries(db, branch_id)


@router.post("/bills", response_model=PurchaseEntryOut, status_code=status.HTTP_201_CREATED)
async def create_bill(
    entry_data: PurchaseEntryCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("purchase", "create"))
):
    """Log a supplier invoice bill."""
    return await TxServices.create_purchase_entry(db, entry_data)


@router.put("/po/{po_id}", response_model=PurchaseOrderOut)
async def update_purchase_order(
    po_id: UUID,
    po_data: PurchaseOrderCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("purchase", "create"))
):
    """Update an existing Purchase Order."""
    return await TxServices.update_purchase_order(db, po_id, po_data)


@router.post("/po/{po_id}/cancel", response_model=PurchaseOrderOut)
async def cancel_purchase_order(
    po_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("purchase", "edit"))
):
    """Mark a Purchase Order as Cancelled."""
    return await TxServices.cancel_purchase_order(db, po_id)


@router.post("/grn/{grn_id}/cancel", response_model=GRNOut)
async def cancel_grn(
    grn_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("purchase", "edit"))
):
    """Mark a GRN as Cancelled and reverse stock changes."""
    return await TxServices.cancel_grn(db, grn_id)


@router.post("/bills/{bill_id}/cancel", response_model=PurchaseEntryOut)
async def cancel_purchase_entry(
    bill_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("purchase", "edit"))
):
    """Mark a Purchase Entry Bill as Cancelled."""
    return await TxServices.cancel_purchase_entry(db, bill_id)


# ==========================================
# VENDOR PAYMENTS (OUTWARD) ENDPOINTS
# ==========================================
@router.get("/payments/outstanding", response_model=List[PurchaseEntryOut])
async def list_outstanding_bills(
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("purchase", "view"))
):
    """List supplier purchase bills with outstanding balances."""
    return await TxServices.list_outstanding_purchase_entries(db)


@router.get("/payments", response_model=List[VendorPaymentOut])
async def list_vendor_payments(
    supplier_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("purchase", "view"))
):
    """List recorded vendor payments."""
    return await TxServices.list_vendor_payments(db, supplier_id)


@router.post("/payments", response_model=VendorPaymentOut, status_code=status.HTTP_201_CREATED)
async def record_vendor_payment(
    payment_data: VendorPaymentCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("purchase", "create"))
):
    """Record a payment to a vendor."""
    return await TxServices.record_vendor_payment(db, payment_data)


@router.post("/payments/{payment_id}/cancel")
async def cancel_vendor_payment(
    payment_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("purchase", "edit"))
):
    """Cancel a vendor payment collection."""
    await TxServices.cancel_vendor_payment(db, payment_id)
    return {"detail": "Vendor payment cancelled successfully."}
