from datetime import datetime, date
from typing import List, Optional, Dict
from uuid import UUID, uuid4
from sqlalchemy.future import select
from sqlalchemy import text, func, cast, Numeric
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.accounts import AccountGroup, LedgerAccount, VoucherType, JournalEntry, JournalLine
from app.models.auth import User
from app.schemas.accounts import (
    AccountGroupCreate, LedgerAccountCreate, VoucherTypeCreate,
    OpeningBalanceTallyOut, BalanceValidationRequest, JournalEntryLine
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
    async def post_journal_entry(
        db: AsyncSession,
        voucher_type_name: str,
        reference_id: Optional[UUID],
        reference_type: Optional[str],
        entry_date: date,
        lines: List[JournalEntryLine],
        user_id: UUID,
        narration: Optional[str] = None
    ) -> JournalEntry:
        """
        Posts a balanced double-entry journal entry to the ledger systems.
        Validates that Dr == Cr and all line amounts are positive.
        """
        # 1. Fetch VoucherType by name
        q_vt = await db.execute(select(VoucherType).filter(VoucherType.name == voucher_type_name))
        voucher_type = q_vt.scalar_one_or_none()
        if not voucher_type:
            raise ValueError(f"Voucher type '{voucher_type_name}' not found.")

        # 2. Validate Dr == Cr and amounts > 0 using Decimal
        from decimal import Decimal, ROUND_HALF_UP
        dr_total = Decimal("0.00")
        cr_total = Decimal("0.00")
        quantized_lines = []
        for line in lines:
            amt = Decimal(str(line.amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            if amt <= Decimal("0.00"):
                raise ValueError("Journal line amount must be greater than zero.")
            if line.dr_cr == "Dr":
                dr_total += amt
            elif line.dr_cr == "Cr":
                cr_total += amt
            else:
                raise ValueError(f"Invalid debit/credit flag: '{line.dr_cr}'. Must be 'Dr' or 'Cr'.")
            quantized_lines.append((line, amt))

        if dr_total != cr_total:
            raise ValueError(f"Journal entry imbalanced: Dr {dr_total} != Cr {cr_total}")

        # 3. Create Voucher Number
        from app.core.account_constants import current_fy_dates
        from sqlalchemy import text
        fy_start, _ = current_fy_dates()
        fy_tag = f"{str(fy_start.year)[2:]}{str(fy_start.year + 1)[2:]}"  # e.g. "2627"
        seq_name = f"voucher_seq_{voucher_type.prefix.lower()}_{fy_tag}"
        
        try:
            result = await db.execute(text(f"SELECT nextval('{seq_name}')"))
            seq_val = result.scalar()
            voucher_number = f"{voucher_type.prefix}-{str(seq_val).zfill(5)}"
        except Exception as e:
            try:
                # Try to create missing sequences on-the-fly (e.g. on financial year rollover)
                await AccountServices.ensure_fy_sequences(db)
                result = await db.execute(text(f"SELECT nextval('{seq_name}')"))
                seq_val = result.scalar()
                voucher_number = f"{voucher_type.prefix}-{str(seq_val).zfill(5)}"
            except Exception as retry_e:
                raise ValueError(
                    f"Voucher number sequence '{seq_name}' does not exist for the current financial year. "
                    "Ensure that ensure_fy_sequences has been run."
                ) from retry_e

        # 4. Create JournalEntry
        entry = JournalEntry(
            id=uuid4(),
            voucher_type_id=voucher_type.id,
            voucher_number=voucher_number,
            reference_id=reference_id,
            reference_type=reference_type,
            date=entry_date,
            narration=narration,
            is_reversed=False,
            created_by_id=user_id,
            updated_by_id=user_id
        )
        db.add(entry)

        # 4. Create JournalLines
        for line, amt in quantized_lines:
            jl = JournalLine(
                id=uuid4(),
                journal_entry_id=entry.id,
                ledger_id=line.ledger_id,
                dr_cr=line.dr_cr,
                amount=float(amt),
                narration=line.narration
            )
            db.add(jl)

        return entry

    @staticmethod
    async def reverse_journal_entry(db: AsyncSession, journal_entry_id: UUID, user_id: UUID) -> JournalEntry:
        """
        Reverses a journal entry by posting a balanced mirror entry with flipped Dr/Cr lines.
        Marks the original entry as reversed.
        """
        stmt = (
            select(JournalEntry)
            .filter(JournalEntry.id == journal_entry_id)
            .options(selectinload(JournalEntry.lines))
        )
        q_entry = await db.execute(stmt)
        entry = q_entry.scalar_one_or_none()
        if not entry:
            raise HTTPException(status_code=404, detail="Journal entry not found.")

        # Guard: raise 409 if already reversed
        if entry.is_reversed:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Journal entry is already reversed."
            )

        # Guard: raise 422 if no lines exist
        if not entry.lines:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Cannot reverse journal entry with no lines."
            )

        # Set original is_reversed = True
        entry.is_reversed = True

        # Compile mirror lines (flip Dr/Cr)
        from decimal import Decimal
        mirror_lines = []
        for line in entry.lines:
            flipped_dr_cr = "Cr" if line.dr_cr == "Dr" else "Dr"
            mirror_lines.append(
                JournalEntryLine(
                    ledger_id=line.ledger_id,
                    dr_cr=flipped_dr_cr,
                    amount=Decimal(str(line.amount)),
                    narration=line.narration
                )
            )

        # Fetch voucher type
        q_vt = await db.execute(select(VoucherType).filter(VoucherType.id == entry.voucher_type_id))
        voucher_type = q_vt.scalar_one_or_none()
        if not voucher_type:
            raise HTTPException(status_code=404, detail="Voucher type for journal entry not found.")

        mirror_narration = f"Reversal of journal entry {entry.id}"
        
        # Post mirror entry
        mirror_entry = await AccountServices.post_journal_entry(
            db=db,
            voucher_type_name=voucher_type.name,
            reference_id=entry.id,
            reference_type="JournalEntry",
            entry_date=date.today(),
            lines=mirror_lines,
            user_id=user_id,
            narration=mirror_narration
        )
        
        await db.flush()
        return mirror_entry

    @staticmethod
    async def has_transactions(db: AsyncSession, account_id: UUID, _ledger: Optional[LedgerAccount] = None) -> bool:
        """
        Checks whether the specified ledger account has any associated transactions,
        or if it is designated as a system ledger. If so, deletion is prohibited
        to maintain data integrity and consistency of the double-entry bookkeeping system.
        """
        from app.core.account_constants import SYSTEM_LEDGER_IDS
        from app.models.purchase import PurchaseEntry, PurchaseReturn
        from app.models.accounts import JournalLine
        from sqlalchemy import or_
        from sqlalchemy.sql import exists

        # 1. Short-circuit if account_id is in system ledger list
        if account_id in SYSTEM_LEDGER_IDS:
            return True

        # 2. Fetch ledger if not provided, check is_system
        if _ledger is None:
            q_ledger = await db.execute(select(LedgerAccount).filter(LedgerAccount.id == account_id))
            _ledger = q_ledger.scalar_one_or_none()

        if _ledger and _ledger.is_system:
            return True

        # 3. Check if referenced in PurchaseEntry (payable, purchase, or tax ledger)
        pe_exists = select(PurchaseEntry).where(
            or_(
                PurchaseEntry.payable_ledger_id == account_id,
                PurchaseEntry.purchase_account_id == account_id,
                PurchaseEntry.tax_ledger_id == account_id
            )
        )
        if await db.scalar(select(pe_exists.exists())):
            return True

        # 4. Check if referenced in PurchaseReturn
        pr_exists = select(PurchaseReturn).where(
            PurchaseReturn.debit_note_ledger_id == account_id
        )
        if await db.scalar(select(pr_exists.exists())):
            return True

        # 5. Check if referenced in JournalLine
        jl_exists = select(JournalLine).where(
            JournalLine.ledger_id == account_id
        )
        if await db.scalar(select(jl_exists.exists())):
            return True

        return False

    @staticmethod
    async def delete_ledger_account(db: AsyncSession, account_id: UUID) -> None:
        """Delete ledger account if no transactions exist."""
        q_ledg = await db.execute(select(LedgerAccount).filter(LedgerAccount.id == account_id))
        ledger = q_ledg.scalar_one_or_none()
        if not ledger:
            raise HTTPException(status_code=404, detail="Ledger account not found.")

        if await AccountServices.has_transactions(db, account_id, ledger):
            raise HTTPException(status_code=409, detail="Cannot delete ledger account with active transaction history or system status.")

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

    @staticmethod
    async def ensure_fy_sequences(db: AsyncSession) -> None:
        """Ensure PostgreSQL sequences for seeded voucher types exist for the current financial year."""
        from app.core.account_constants import current_fy_dates
        from sqlalchemy import text
        
        fy_start, _ = current_fy_dates()
        fy_tag = f"{str(fy_start.year)[2:]}{str(fy_start.year + 1)[2:]}"  # e.g. "2627"
        
        for prefix in ["pmt", "rct", "jv", "ctr", "sls", "pur"]:
            seq_name = f"voucher_seq_{prefix}_{fy_tag}"
            await db.execute(text(f"CREATE SEQUENCE IF NOT EXISTS {seq_name} START 1 INCREMENT 1"))
        
        await db.commit()
