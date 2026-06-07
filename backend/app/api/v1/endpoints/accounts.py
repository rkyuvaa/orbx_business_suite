from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import deps
from app.schemas.accounts import (
    AccountGroupCreate, AccountGroupOut, AccountGroupHierarchyOut,
    LedgerAccountCreate, LedgerAccountOut,
    VoucherTypeCreate, VoucherTypeOut,
    BalanceValidationRequest, OpeningBalanceTallyOut, JournalEntryOut
)
from app.services.account_services import AccountServices

router = APIRouter()


# ==========================================
# ACCOUNT GROUPS ROUTERS
# ==========================================
@router.post("/groups", response_model=AccountGroupOut, status_code=status.HTTP_201_CREATED)
async def create_account_group(
    group_data: AccountGroupCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("accounts", "create"))
):
    """Create a new account group (Schedule III subgroup)."""
    return await AccountServices.create_account_group(db, group_data, current_user.id)


@router.get("/groups", response_model=List[AccountGroupOut])
async def list_account_groups(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1),
    flat: bool = Query(False),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("accounts", "view"))
):
    """List all account groups. Set flat=true to pull all active items unpaginated for dropdowns."""
    return await AccountServices.list_account_groups(db, skip=skip, limit=limit, flat=flat)


@router.delete("/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account_group(
    group_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("accounts", "delete"))
):
    """Delete an account group if empty."""
    await AccountServices.delete_account_group(db, group_id)


# ==========================================
# CHART OF ACCOUNTS HIERARCHY ROUTERS
# ==========================================
@router.get("/coa", response_model=List[AccountGroupHierarchyOut])
async def get_chart_of_accounts(
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("accounts", "view"))
):
    """Fetch the Schedule III Chart of Accounts tree structure with nested ledgers."""
    return await AccountServices.get_coa_hierarchy(db)


# ==========================================
# LEDGER ACCOUNTS ROUTERS
# ==========================================
@router.get("/ledgers", response_model=List[LedgerAccountOut])
async def list_ledger_accounts(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("accounts", "view"))
):
    """List all ledger accounts (paginated)."""
    return await AccountServices.list_ledger_accounts(db, skip=skip, limit=limit)


@router.post("/ledgers", response_model=LedgerAccountOut, status_code=status.HTTP_201_CREATED)
async def create_ledger_account(
    account_data: LedgerAccountCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("accounts", "create"))
):
    """Create a new general ledger account under a Schedule III group."""
    return await AccountServices.create_ledger_account(db, account_data, current_user.id)


@router.put("/ledgers/{account_id}", response_model=LedgerAccountOut)
async def update_ledger_account(
    account_id: UUID,
    account_data: LedgerAccountCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("accounts", "edit"))
):
    """Update general ledger details."""
    return await AccountServices.update_ledger_account(db, account_id, account_data, current_user.id)


@router.delete("/ledgers/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ledger_account(
    account_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("accounts", "delete"))
):
    """Delete a ledger account (checks for transactions and throws 409 Conflict if found)."""
    await AccountServices.delete_ledger_account(db, account_id)


# ==========================================
# VOUCHER CONFIGURATIONS ROUTERS
# ==========================================
@router.get("/vouchers/types", response_model=List[VoucherTypeOut])
async def list_voucher_types(
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("accounts", "view"))
):
    """List all voucher numbering configurations."""
    return await AccountServices.list_voucher_types(db)


@router.post("/vouchers/types", response_model=VoucherTypeOut, status_code=status.HTTP_201_CREATED)
async def create_voucher_type(
    vt_data: VoucherTypeCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("accounts", "create"))
):
    """Create a custom voucher configurations."""
    return await AccountServices.create_voucher_type(db, vt_data, current_user.id)


@router.put("/vouchers/types/{vt_id}", response_model=VoucherTypeOut)
async def update_voucher_type(
    vt_id: UUID,
    vt_data: VoucherTypeCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("accounts", "edit"))
):
    """Update voucher configurations. Prohibits editing system default voucher type names."""
    return await AccountServices.update_voucher_type(db, vt_id, vt_data, current_user.id)


@router.delete("/vouchers/types/{vt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_voucher_type(
    vt_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("accounts", "delete"))
):
    """Delete a custom voucher type configuration. System types cannot be deleted."""
    await AccountServices.delete_voucher_type(db, vt_id)


# ==========================================
# BALANCE VALIDATIONS
# ==========================================
@router.post("/validate-balances", response_model=OpeningBalanceTallyOut)
async def validate_opening_balances(
    request_data: BalanceValidationRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("accounts", "view"))
):
    """Verify if total Debit opening balances matches Credit opening balances."""
    return await AccountServices.validate_opening_balances_tally(db, request_data)


# ==========================================
# JOURNAL ENTRY ROUTERS
# ==========================================
@router.post("/journal-entries/{entry_id}/reverse", response_model=JournalEntryOut)
async def reverse_journal_entry(
    entry_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("accounts", "reverse"))
):
    """Reverses a journal entry by posting a balanced mirror entry."""
    from sqlalchemy.future import select
    from sqlalchemy.orm import selectinload
    from app.models.accounts import JournalEntry

    mirror = await AccountServices.reverse_journal_entry(db, entry_id, current_user.id)
    await db.commit()

    # Fetch mirror entry with pre-loaded lines for proper API serialization
    q = await db.execute(
        select(JournalEntry)
        .filter(JournalEntry.id == mirror.id)
        .options(selectinload(JournalEntry.lines))
    )
    return q.scalar_one()
