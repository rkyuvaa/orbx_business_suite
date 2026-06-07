from uuid import UUID, uuid4
from typing import List, Optional, Dict
from sqlalchemy.future import select
from sqlalchemy import text, func, cast, Numeric
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.accounts import AccountGroup, LedgerAccount, VoucherType
from app.models.auth import User
from app.schemas.accounts import (
    AccountGroupCreate, LedgerAccountCreate, VoucherTypeCreate,
    OpeningBalanceTallyOut, BalanceValidationRequest
)


class AccountServices:

    # ==========================================
    # ACCOUNT GROUPS SERVICES
    # ==========================================
    @staticmethod
    async def create_account_group(db: AsyncSession, group_data: AccountGroupCreate, user_id: UUID) -> AccountGroup:
        """Create a new account group."""
        # Check parent existence
        nature = group_data.nature
        if group_data.parent_id:
            q_parent = await db.execute(select(AccountGroup).filter(AccountGroup.id == group_data.parent_id))
            parent = q_parent.scalar_one_or_none()
            if not parent:
                raise HTTPException(status_code=404, detail="Parent group not found.")
            # Inherit parent group's nature
            nature = parent.nature

        # Check duplicate name
        q_dup = await db.execute(select(AccountGroup).filter(AccountGroup.name == group_data.name))
        if q_dup.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Account group name already exists.")

        group = AccountGroup(
            id=uuid4(),
            name=group_data.name,
            parent_id=group_data.parent_id,
            nature=nature,
            created_by_id=user_id,
            updated_by_id=user_id
        )
        db.add(group)
        await db.commit()
        await db.refresh(group)
        return group

    @staticmethod
    async def list_account_groups(
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100,
        flat: bool = False,
        include_inactive: bool = False
    ) -> List[AccountGroup]:
        """List account groups flat or paginated."""
        stmt = select(AccountGroup)
        if not include_inactive:
            stmt = stmt.filter(AccountGroup.is_active == True)
        
        if not flat:
            stmt = stmt.offset(skip).limit(limit)
        
        query = await db.execute(stmt)
        return list(query.scalars().all())

    @staticmethod
    async def delete_account_group(db: AsyncSession, group_id: UUID) -> None:
        """Delete an account group if it doesn't contain subgroups or ledgers."""
        # Check subgroups
        q_sub = await db.execute(select(AccountGroup).filter(AccountGroup.parent_id == group_id))
        if q_sub.scalars().first():
            raise HTTPException(status_code=409, detail="Cannot delete group containing subgroups.")
        
        # Check ledgers
        q_ledg = await db.execute(select(LedgerAccount).filter(LedgerAccount.group_id == group_id))
        if q_ledg.scalars().first():
            raise HTTPException(status_code=409, detail="Cannot delete group containing ledger accounts.")
        
        q_group = await db.execute(select(AccountGroup).filter(AccountGroup.id == group_id))
        group = q_group.scalar_one_or_none()
        if not group:
            raise HTTPException(status_code=404, detail="Account group not found.")
        
        await db.delete(group)
        await db.commit()

    @staticmethod
    async def get_coa_hierarchy(db: AsyncSession) -> List[Dict]:
        """
        Recursive CTE to load parent-child structure of AccountGroups in 1 optimized query,
        then maps them into a tree structure along with active Ledgers at the service layer.
        """
        cte_query = text("""
            WITH RECURSIVE coa_tree AS (
                -- Anchor member
                SELECT id, name, parent_id, nature, 0 AS depth, CAST(name AS varchar(255)) AS path
                FROM account_groups
                WHERE parent_id IS NULL AND is_active = true
                
                UNION ALL
                
                -- Recursive member
                SELECT child.id, child.name, child.parent_id, parent.nature, parent.depth + 1, CAST(parent.path || ' > ' || child.name AS varchar(255))
                FROM account_groups child
                JOIN coa_tree parent ON child.parent_id = parent.id
                WHERE child.is_active = true
            )
            SELECT id, name, parent_id, nature, depth, path FROM coa_tree;
        """)
        
        groups_result = await db.execute(cte_query)
        groups_rows = groups_result.all()

        # Fetch all active ledgers
        ledgers_result = await db.execute(
            select(LedgerAccount)
            .filter(LedgerAccount.is_active == True)
            .options(selectinload(LedgerAccount.group))
        )
        ledgers_list = list(ledgers_result.scalars().all())

        # Map ledgers by their group_id
        ledgers_by_group: Dict[UUID, List[LedgerAccount]] = {}
        for l in ledgers_list:
            ledgers_by_group.setdefault(l.group_id, []).append(l)

        # Build dictionary tree nodes
        nodes: Dict[UUID, Dict] = {}
        for row in groups_rows:
            group_id = row.id
            nodes[group_id] = {
                "id": group_id,
                "name": row.name,
                "parent_id": row.parent_id,
                "nature": row.nature,
                "depth": row.depth,
                "path": row.path,
                "subgroups": [],
                "ledgers": ledgers_by_group.get(group_id, [])
            }

        root_nodes = []
        for node_id, node in nodes.items():
            parent_id = node["parent_id"]
            if parent_id is None:
                root_nodes.append(node)
            else:
                parent_node = nodes.get(parent_id)
                if parent_node:
                    parent_node["subgroups"].append(node)

        return root_nodes

    # ==========================================
    # LEDGER ACCOUNTS SERVICES
    # ==========================================
    @staticmethod
    async def create_ledger_account(db: AsyncSession, account_data: LedgerAccountCreate, user_id: UUID) -> LedgerAccount:
        """Create a new ledger account."""
        # Check code uniqueness
        q_code = await db.execute(select(LedgerAccount).filter(LedgerAccount.code == account_data.code))
        if q_code.scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"Ledger account code '{account_data.code}' already exists.")

        # Check name uniqueness under the same group_id
        q_name = await db.execute(
            select(LedgerAccount).filter(
                LedgerAccount.name == account_data.name,
                LedgerAccount.group_id == account_data.group_id
            )
        )
        if q_name.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail=f"Ledger account name '{account_data.name}' already exists in this group."
            )

        # Check group existence
        q_group = await db.execute(select(AccountGroup).filter(AccountGroup.id == account_data.group_id))
        group = q_group.scalar_one_or_none()
        if not group:
            raise HTTPException(status_code=404, detail="Account group not found.")

        ledger = LedgerAccount(
            id=uuid4(),
            code=account_data.code,
            name=account_data.name,
            group_id=account_data.group_id,
            opening_bal=account_data.opening_bal,
            opening_bal_type=account_data.opening_bal_type,
            currency=account_data.currency,
            is_closing_stock=account_data.is_closing_stock,
            sundry_type=account_data.sundry_type,
            partnership_type=account_data.partnership_type,
            created_by_id=user_id,
            updated_by_id=user_id
        )
        db.add(ledger)
        await db.commit()
        await db.refresh(ledger)
        return ledger

    @staticmethod
    async def list_ledger_accounts(db: AsyncSession, skip: int = 0, limit: int = 100) -> List[LedgerAccount]:
        """List ledger accounts with pagination."""
        query = await db.execute(
            select(LedgerAccount)
            .options(selectinload(LedgerAccount.group))
            .offset(skip)
            .limit(limit)
        )
        return list(query.scalars().all())

    @staticmethod
    async def update_ledger_account(db: AsyncSession, account_id: UUID, account_data: LedgerAccountCreate, user_id: UUID) -> LedgerAccount:
        """Update an existing ledger account."""
        q_ledg = await db.execute(select(LedgerAccount).filter(LedgerAccount.id == account_id))
        ledger = q_ledg.scalar_one_or_none()
        if not ledger:
            raise HTTPException(status_code=404, detail="Ledger account not found.")

        # Validate unique code if changed
        if ledger.code != account_data.code:
            q_code = await db.execute(select(LedgerAccount).filter(LedgerAccount.code == account_data.code))
            if q_code.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Ledger account code already exists.")

        # Validate unique name in group if changed
        if ledger.name != account_data.name or ledger.group_id != account_data.group_id:
            q_name = await db.execute(
                select(LedgerAccount).filter(
                    LedgerAccount.name == account_data.name,
                    LedgerAccount.group_id == account_data.group_id
                )
            )
            if q_name.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Ledger account name already exists in this group.")

        ledger.code = account_data.code
        ledger.name = account_data.name
        ledger.group_id = account_data.group_id
        ledger.opening_bal = account_data.opening_bal
        ledger.opening_bal_type = account_data.opening_bal_type
        ledger.currency = account_data.currency
        ledger.is_closing_stock = account_data.is_closing_stock
        ledger.sundry_type = account_data.sundry_type
        ledger.partnership_type = account_data.partnership_type
        ledger.updated_by_id = user_id
        ledger.updated_at = func.now()

        db.add(ledger)
        await db.commit()
        await db.refresh(ledger)
        return ledger

    @staticmethod
    async def has_transactions(db: AsyncSession, account_id: UUID) -> bool:
        """
        Central extensible validation check to see if ledger account is referenced in transaction tables.
        # TODO: extend when GL journal entries, GST ledger entries, TDS ledger entries, AP, AR, and Bank Reconciliation modules are added.
        """
        return False

    @staticmethod
    async def delete_ledger_account(db: AsyncSession, account_id: UUID) -> None:
        """Delete ledger account if no transactions exist."""
        q_ledg = await db.execute(select(LedgerAccount).filter(LedgerAccount.id == account_id))
        ledger = q_ledg.scalar_one_or_none()
        if not ledger:
            raise HTTPException(status_code=404, detail="Ledger account not found.")

        if await AccountServices.has_transactions(db, account_id):
            raise HTTPException(status_code=409, detail="Cannot delete ledger account with active transaction history.")

        await db.delete(ledger)
        await db.commit()

    @staticmethod
    async def validate_opening_balances_tally(db: AsyncSession, request_data: BalanceValidationRequest) -> OpeningBalanceTallyOut:
        """Tally opening balances (Dr = Cr) using Numeric casting for precise calculations."""
        # Calculate Debit total
        stmt_dr = select(func.sum(cast(LedgerAccount.opening_bal, Numeric(15, 2)))).filter(
            LedgerAccount.opening_bal_type == "Dr",
            LedgerAccount.is_active == True
        )
        # Calculate Credit total
        stmt_cr = select(func.sum(cast(LedgerAccount.opening_bal, Numeric(15, 2)))).filter(
            LedgerAccount.opening_bal_type == "Cr",
            LedgerAccount.is_active == True
        )
        
        dr_res = await db.execute(stmt_dr)
        cr_res = await db.execute(stmt_cr)
        
        dr_total = float(dr_res.scalar() or 0.0)
        cr_total = float(cr_res.scalar() or 0.0)
        
        difference = round(abs(dr_total - cr_total), 2)
        tallies = difference == 0.0
        
        return OpeningBalanceTallyOut(
            dr_total=dr_total,
            cr_total=cr_total,
            difference=difference,
            tallies=tallies
        )

    # ==========================================
    # VOUCHER TYPES SERVICES
    # ==========================================
    @staticmethod
    async def list_voucher_types(db: AsyncSession) -> List[VoucherType]:
        """List all voucher configurations."""
        query = await db.execute(select(VoucherType).filter(VoucherType.is_active == True))
        return list(query.scalars().all())

    @staticmethod
    async def create_voucher_type(db: AsyncSession, vt_data: VoucherTypeCreate, user_id: UUID) -> VoucherType:
        """Create a custom voucher type."""
        # Check duplicate name
        q_dup = await db.execute(select(VoucherType).filter(VoucherType.name == vt_data.name))
        if q_dup.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Voucher type name already exists.")

        vt = VoucherType(
            id=uuid4(),
            name=vt_data.name,
            prefix=vt_data.prefix,
            numbering_method=vt_data.numbering_method,
            is_system=False,
            created_by_id=user_id,
            updated_by_id=user_id
        )
        db.add(vt)
        await db.commit()
        await db.refresh(vt)
        return vt

    @staticmethod
    async def update_voucher_type(db: AsyncSession, vt_id: UUID, vt_data: VoucherTypeCreate, user_id: UUID) -> VoucherType:
        """Update voucher configuration, guarding against system-seeded VoucherType renames."""
        q_vt = await db.execute(select(VoucherType).filter(VoucherType.id == vt_id))
        vt = q_vt.scalar_one_or_none()
        if not vt:
            raise HTTPException(status_code=404, detail="Voucher type not found.")

        # Guard system seed configurations from renaming
        if vt.is_system and vt.name != vt_data.name:
            raise HTTPException(status_code=400, detail="Renaming system default voucher configurations is prohibited.")

        vt.name = vt_data.name
        vt.prefix = vt_data.prefix
        vt.numbering_method = vt_data.numbering_method
        vt.updated_by_id = user_id
        vt.updated_at = func.now()

        db.add(vt)
        await db.commit()
        await db.refresh(vt)
        return vt

    @staticmethod
    async def delete_voucher_type(db: AsyncSession, vt_id: UUID) -> None:
        """Delete voucher type unless it is a system default configuration."""
        q_vt = await db.execute(select(VoucherType).filter(VoucherType.id == vt_id))
        vt = q_vt.scalar_one_or_none()
        if not vt:
            raise HTTPException(status_code=404, detail="Voucher type not found.")

        if vt.is_system:
            raise HTTPException(status_code=403, detail="System default voucher configurations cannot be deleted.")

        await db.delete(vt)
        await db.commit()
