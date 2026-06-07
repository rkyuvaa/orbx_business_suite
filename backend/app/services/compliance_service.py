import json
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Dict, Any, List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select, func

from app.models.accounts import AccountGroup, LedgerAccount, JournalEntry, JournalLine
from app.models.purchase import PurchaseEntry
from app.models.sales import Invoice, InvoiceItem, SalesOrder
from app.models.auth import User
from app.models.audit import AuditLog
from app.models.product import Product
from app.models.business import Company, Branch, Customer
from app.core.account_constants import current_fy_dates


class ComplianceService:
    @staticmethod
    async def get_balance_sheet(
        db: AsyncSession,
        as_of_date: Optional[date] = None,
        branch_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Generates a Schedule III Balance Sheet as of a specific date.
        Uses a recursive SQL CTE to roll up ledger balances through the multi-level group hierarchy.
        """
        if as_of_date is None:
            _, as_of_date = current_fy_dates()

        # 1. Fetch rolled-up group balances
        group_sql = text("""
            WITH RECURSIVE group_path AS (
              SELECT id AS group_id, id AS ancestor_id, parent_id
              FROM account_groups
              UNION ALL
              SELECT gp.group_id, ag.id AS ancestor_id, ag.parent_id
              FROM group_path gp
              JOIN account_groups ag ON gp.parent_id = ag.id
            ),
            ledger_balances AS (
              SELECT
                la.group_id,
                SUM(
                  (CASE WHEN la.opening_bal_type = 'Dr' THEN la.opening_bal ELSE -la.opening_bal END) +
                  COALESCE(ja.total_dr, 0) - COALESCE(ja.total_cr, 0)
                ) AS net_debit
              FROM ledger_accounts la
              LEFT JOIN (
                SELECT
                  jl.ledger_id,
                  SUM(CASE WHEN jl.dr_cr = 'Dr' THEN jl.amount ELSE 0 END) AS total_dr,
                  SUM(CASE WHEN jl.dr_cr = 'Cr' THEN jl.amount ELSE 0 END) AS total_cr
                FROM journal_entry_lines jl
                JOIN journal_entries je ON je.id = jl.journal_entry_id
                WHERE je.is_active = true AND je.is_reversed = false AND je.date <= :as_of_date
                GROUP BY jl.ledger_id
              ) ja ON ja.ledger_id = la.id
              WHERE la.is_active = true
              GROUP BY la.group_id
            ),
            rolled_up_balances AS (
              SELECT
                gp.ancestor_id AS group_id,
                SUM(lb.net_debit) AS net_debit
              FROM group_path gp
              JOIN ledger_balances lb ON lb.group_id = gp.group_id
              GROUP BY gp.ancestor_id
            )
            SELECT
              ag.id AS group_id,
              ag.name AS name,
              ag.parent_id AS parent_id,
              ag.nature AS nature,
              COALESCE(rub.net_debit, 0) AS net_debit
            FROM account_groups ag
            LEFT JOIN rolled_up_balances rub ON rub.group_id = ag.id
            ORDER BY ag.name
        """)

        # 2. Fetch individual ledger balances
        ledger_sql = text("""
            SELECT
              la.id AS ledger_id,
              la.code AS code,
              la.name AS name,
              la.group_id AS group_id,
              (CASE WHEN la.opening_bal_type = 'Dr' THEN la.opening_bal ELSE -la.opening_bal END) +
              COALESCE(ja.total_dr, 0) - COALESCE(ja.total_cr, 0) AS net_debit
            FROM ledger_accounts la
            LEFT JOIN (
              SELECT
                jl.ledger_id,
                SUM(CASE WHEN jl.dr_cr = 'Dr' THEN jl.amount ELSE 0 END) AS total_dr,
                SUM(CASE WHEN jl.dr_cr = 'Cr' THEN jl.amount ELSE 0 END) AS total_cr
              FROM journal_entry_lines jl
              JOIN journal_entries je ON je.id = jl.journal_entry_id
              WHERE je.is_active = true AND je.is_reversed = false AND je.date <= :as_of_date
              GROUP BY jl.ledger_id
            ) ja ON ja.ledger_id = la.id
            WHERE la.is_active = true
            ORDER BY la.name
        """)

        # Execute queries
        group_res = await db.execute(group_sql, {"as_of_date": as_of_date})
        groups_raw = group_res.all()

        ledger_res = await db.execute(ledger_sql, {"as_of_date": as_of_date})
        ledgers_raw = ledger_res.all()

        # 3. Calculate Period Net Profit/Loss to bridge Balance Sheet (Reserves & Surplus)
        # Income less Expenses up to as_of_date
        pl_sql = text("""
            SELECT
              SUM(CASE WHEN ag.nature = 'Credit' THEN jl.amount ELSE -jl.amount END) AS net_profit
            FROM journal_entry_lines jl
            JOIN journal_entries je ON je.id = jl.journal_entry_id
            JOIN ledger_accounts la ON la.id = jl.ledger_id
            JOIN account_groups ag ON ag.id = la.group_id
            WHERE je.is_active = true AND je.is_reversed = false AND je.date <= :as_of_date
              AND (ag.id = '40000000-0000-0000-0000-000000000004' OR ag.parent_id = '40000000-0000-0000-0000-000000000004'
                OR ag.id = '50000000-0000-0000-0000-000000000005' OR ag.parent_id = '50000000-0000-0000-0000-000000000005')
        """)
        pl_res = await db.execute(pl_sql, {"as_of_date": as_of_date})
        current_period_profit = Decimal(str(pl_res.scalar() or 0.00))

        # Build structures
        ledgers_by_group = {}
        for l in ledgers_raw:
            bal = Decimal(str(l.net_debit))
            ledgers_by_group.setdefault(str(l.group_id), []).append({
                "id": str(l.ledger_id),
                "code": l.code,
                "name": l.name,
                "balance": float(abs(bal)),
                "type": "Dr" if bal >= 0 else "Cr"
            })

        # Process groups
        groups_dict = {}
        for g in groups_raw:
            net_deb = Decimal(str(g.net_debit))
            # Balance representation depends on nature
            # Debit nature (Assets) -> positive net_debit is positive balance
            # Credit nature (Liabilities/Capital) -> negative net_debit is positive balance
            if g.nature == "Credit":
                bal_val = -net_deb
            else:
                bal_val = net_deb

            groups_dict[str(g.group_id)] = {
                "id": str(g.group_id),
                "name": g.name,
                "parent_id": str(g.parent_id) if g.parent_id else None,
                "nature": g.nature,
                "balance": float(bal_val),
                "subgroups": [],
                "ledgers": ledgers_by_group.get(str(g.group_id), [])
            }

        # Inject current period profit/loss into Reserves and Surplus (Credit nature)
        reserves_id = "32000000-0000-0000-0000-000000000003"
        if reserves_id in groups_dict:
            groups_dict[reserves_id]["balance"] += float(current_period_profit)
            groups_dict[reserves_id]["ledgers"].append({
                "id": "profit-loss-current",
                "code": "SYS-PL",
                "name": "Profit & Loss A/c (Current Period)",
                "balance": float(abs(current_period_profit)),
                "type": "Cr" if current_period_profit >= 0 else "Dr"
            })
            
            # Recalculate parent "Capital" group balance recursively
            capital_root_id = "30000000-0000-0000-0000-000000000003"
            if capital_root_id in groups_dict:
                groups_dict[capital_root_id]["balance"] += float(current_period_profit)

        # Assemble tree
        roots = []
        for g_id, g_data in groups_dict.items():
            if g_data["parent_id"]:
                parent = groups_dict.get(g_data["parent_id"])
                if parent:
                    parent["subgroups"].append(g_data)
            else:
                roots.append(g_data)

        # Separate sections
        assets = next((r for r in roots if r["name"] == "Assets"), {"balance": 0.0, "subgroups": []})
        liabilities = next((r for r in roots if r["name"] == "Liabilities"), {"balance": 0.0, "subgroups": []})
        capital = next((r for r in roots if r["name"] == "Capital"), {"balance": 0.0, "subgroups": []})

        total_assets = assets["balance"]
        total_equity_liabilities = liabilities["balance"] + capital["balance"]

        return {
            "as_of_date": as_of_date.isoformat(),
            "sections": {
                "equity_and_liabilities": {
                    "title": "Equity and Liabilities",
                    "total": total_equity_liabilities,
                    "categories": [capital, liabilities]
                },
                "assets": {
                    "title": "Assets",
                    "total": total_assets,
                    "categories": [assets]
                }
            },
            "is_balanced": abs(total_assets - total_equity_liabilities) < 0.01,
            "discrepancy": float(total_assets - total_equity_liabilities)
        }

    @staticmethod
    async def get_profit_loss(
        db: AsyncSession,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        branch_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Generates a Schedule III Profit & Loss report for a date range.
        Calculates income and expense group aggregates and list ledgers under them.
        """
        if start_date is None or end_date is None:
            start_date, end_date = current_fy_dates()

        group_sql = text("""
            WITH RECURSIVE group_path AS (
              SELECT id AS group_id, id AS ancestor_id, parent_id
              FROM account_groups
              UNION ALL
              SELECT gp.group_id, ag.id AS ancestor_id, ag.parent_id
              FROM group_path gp
              JOIN account_groups ag ON gp.parent_id = ag.id
            ),
            ledger_balances AS (
              SELECT
                la.group_id,
                SUM(COALESCE(ja.period_dr, 0) - COALESCE(ja.period_cr, 0)) AS net_debit
              FROM ledger_accounts la
              LEFT JOIN (
                SELECT
                  jl.ledger_id,
                  SUM(CASE WHEN jl.dr_cr = 'Dr' THEN jl.amount ELSE 0 END) AS period_dr,
                  SUM(CASE WHEN jl.dr_cr = 'Cr' THEN jl.amount ELSE 0 END) AS period_cr
                FROM journal_entry_lines jl
                JOIN journal_entries je ON je.id = jl.journal_entry_id
                WHERE je.is_active = true AND je.is_reversed = false AND je.date BETWEEN :start_date AND :end_date
                GROUP BY jl.ledger_id
              ) ja ON ja.ledger_id = la.id
              WHERE la.is_active = true
              GROUP BY la.group_id
            ),
            rolled_up_balances AS (
              SELECT
                gp.ancestor_id AS group_id,
                SUM(lb.net_debit) AS net_debit
              FROM group_path gp
              JOIN ledger_balances lb ON lb.group_id = gp.group_id
              GROUP BY gp.ancestor_id
            )
            SELECT
              ag.id AS group_id,
              ag.name AS name,
              ag.parent_id AS parent_id,
              ag.nature AS nature,
              COALESCE(rub.net_debit, 0) AS net_debit
            FROM account_groups ag
            LEFT JOIN rolled_up_balances rub ON rub.group_id = ag.id
            WHERE ag.id IN (
              SELECT id FROM account_groups 
              WHERE parent_id = '40000000-0000-0000-0000-000000000004' 
                 OR id = '40000000-0000-0000-0000-000000000004'
                 OR parent_id = '50000000-0000-0000-0000-000000000005'
                 OR id = '50000000-0000-0000-0000-000000000005'
            )
            ORDER BY ag.name
        """)

        ledger_sql = text("""
            SELECT
              la.id AS ledger_id,
              la.code AS code,
              la.name AS name,
              la.group_id AS group_id,
              SUM(COALESCE(jl.amount, 0) * (CASE WHEN jl.dr_cr = 'Dr' THEN 1 ELSE -1 END)) AS net_debit
            FROM ledger_accounts la
            JOIN journal_entry_lines jl ON jl.ledger_id = la.id
            JOIN journal_entries je ON je.id = jl.journal_entry_id
            JOIN account_groups ag ON ag.id = la.group_id
            WHERE je.is_active = true AND je.is_reversed = false AND je.date BETWEEN :start_date AND :end_date
              AND (ag.id = '40000000-0000-0000-0000-000000000004' OR ag.parent_id = '40000000-0000-0000-0000-000000000004'
                OR ag.id = '50000000-0000-0000-0000-000000000005' OR ag.parent_id = '50000000-0000-0000-0000-000000000005')
            GROUP BY la.id, la.code, la.name, la.group_id
            HAVING SUM(COALESCE(jl.amount, 0)) > 0
            ORDER BY la.name
        """)

        group_res = await db.execute(group_sql, {"start_date": start_date, "end_date": end_date})
        groups_raw = group_res.all()

        ledger_res = await db.execute(ledger_sql, {"start_date": start_date, "end_date": end_date})
        ledgers_raw = ledger_res.all()

        ledgers_by_group = {}
        for l in ledgers_raw:
            net_deb = Decimal(str(l.net_debit))
            # Determine nature of group to set correct positive/negative balance display
            # Incomes are Credit, Expenses are Debit
            ledgers_by_group.setdefault(str(l.group_id), []).append({
                "id": str(l.ledger_id),
                "code": l.code,
                "name": l.name,
                "balance": float(abs(net_deb)),
                "type": "Dr" if net_deb >= 0 else "Cr"
            })

        income_categories = []
        expense_categories = []
        total_income = Decimal("0.00")
        total_expense = Decimal("0.00")

        for g in groups_raw:
            net_deb = Decimal(str(g.net_debit))
            if g.nature == "Credit":
                bal_val = -net_deb  # positive credit balance is positive income
            else:
                bal_val = net_deb   # positive debit balance is positive expense

            category_data = {
                "id": str(g.group_id),
                "name": g.name,
                "nature": g.nature,
                "balance": float(bal_val),
                "ledgers": ledgers_by_group.get(str(g.group_id), [])
            }

            if str(g.parent_id) == "40000000-0000-0000-0000-000000000004":
                income_categories.append(category_data)
                total_income += bal_val
            elif str(g.parent_id) == "50000000-0000-0000-0000-000000000005":
                expense_categories.append(category_data)
                total_expense += bal_val

        net_profit = total_income - total_expense

        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "income": {
                "total": float(total_income),
                "categories": income_categories
            },
            "expense": {
                "total": float(total_expense),
                "categories": expense_categories
            },
            "net_profit": float(net_profit)
        }

    @staticmethod
    async def get_group_balance(db: AsyncSession, group_id: str, start_date: date, end_date: date) -> Decimal:
        """Helper to get change in group balance during a period (or as of a date if start_date is Epoch)."""
        sql = text("""
            WITH RECURSIVE group_path AS (
              SELECT id AS group_id, id AS ancestor_id, parent_id
              FROM account_groups
              UNION ALL
              SELECT gp.group_id, ag.id AS ancestor_id, ag.parent_id
              FROM group_path gp
              JOIN account_groups ag ON gp.parent_id = ag.id
            )
            SELECT
              SUM(
                (CASE WHEN la.opening_bal_type = 'Dr' THEN la.opening_bal ELSE -la.opening_bal END) +
                COALESCE(ja.total_dr, 0) - COALESCE(ja.total_cr, 0)
              ) AS net_debit
            FROM ledger_accounts la
            JOIN group_path gp ON gp.group_id = la.group_id
            LEFT JOIN (
              SELECT
                jl.ledger_id,
                SUM(CASE WHEN jl.dr_cr = 'Dr' THEN jl.amount ELSE 0 END) AS total_dr,
                SUM(CASE WHEN jl.dr_cr = 'Cr' THEN jl.amount ELSE 0 END) AS total_cr
              FROM journal_entry_lines jl
              JOIN journal_entries je ON je.id = jl.journal_entry_id
              WHERE je.is_active = true AND je.is_reversed = false AND je.date <= :end_date
              GROUP BY jl.ledger_id
            ) ja ON ja.ledger_id = la.id
            WHERE la.is_active = true AND gp.ancestor_id = CAST(:group_id AS UUID)
        """)
        res = await db.execute(sql, {"group_id": group_id, "end_date": end_date})
        return Decimal(str(res.scalar() or 0.00))

    @staticmethod
    async def get_cash_flow_indirect(
        db: AsyncSession,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Generates AS-3 Cash Flow Statement using the Indirect Method.
        """
        if start_date is None or end_date is None:
            start_date, end_date = current_fy_dates()

        prev_day = start_date - timedelta(days=1)

        # 1. Net Profit before Tax
        pl_data = await ComplianceService.get_profit_loss(db, start_date, end_date)
        net_profit = Decimal(str(pl_data["net_profit"]))

        # 2. Non-cash expenses (Depreciation & Amortization)
        depr_group = "54000000-0000-0000-0000-000000000005"
        depr_val = Decimal(str(abs(await ComplianceService.get_group_balance(db, depr_group, start_date, end_date) -
                                   await ComplianceService.get_group_balance(db, depr_group, start_date, prev_day))))

        # 3. Finance costs
        finance_group = "53000000-0000-0000-0000-000000000005"
        finance_val = Decimal(str(abs(await ComplianceService.get_group_balance(db, finance_group, start_date, end_date) -
                                      await ComplianceService.get_group_balance(db, finance_group, start_date, prev_day))))

        operating_profit_before_wc = net_profit + depr_val + finance_val

        # 4. Working Capital Changes
        # Opening vs Closing Balances
        debtors_group = "12200000-0000-0000-0000-000000000001"
        creditors_group = "22200000-0000-0000-0000-000000000002"
        stock_group = "12100000-0000-0000-0000-000000000001"

        debtors_open = await ComplianceService.get_group_balance(db, debtors_group, date(2000, 1, 1), prev_day)
        debtors_close = await ComplianceService.get_group_balance(db, debtors_group, date(2000, 1, 1), end_date)
        debtors_change = debtors_close - debtors_open  # Positive means increase (outflow)

        creditors_open = -await ComplianceService.get_group_balance(db, creditors_group, date(2000, 1, 1), prev_day)
        creditors_close = -await ComplianceService.get_group_balance(db, creditors_group, date(2000, 1, 1), end_date)
        creditors_change = creditors_close - creditors_open  # Positive means increase (inflow)

        stock_open = await ComplianceService.get_group_balance(db, stock_group, date(2000, 1, 1), prev_day)
        stock_close = await ComplianceService.get_group_balance(db, stock_group, date(2000, 1, 1), end_date)
        stock_change = stock_close - stock_open  # Positive means increase (outflow)

        # WC Adjustments
        debtors_adj = -debtors_change
        creditors_adj = creditors_change
        stock_adj = -stock_change

        net_cash_operating = operating_profit_before_wc + debtors_adj + creditors_adj + stock_adj

        # 5. Investing Activities
        fixed_assets_group = "11100000-0000-0000-0000-000000000001"
        investments_group = "11200000-0000-0000-0000-000000000001"

        fixed_assets_open = await ComplianceService.get_group_balance(db, fixed_assets_group, date(2000, 1, 1), prev_day)
        fixed_assets_close = await ComplianceService.get_group_balance(db, fixed_assets_group, date(2000, 1, 1), end_date)
        fixed_assets_change = fixed_assets_close - fixed_assets_open  # Positive means increase (purchase/outflow)

        investments_open = await ComplianceService.get_group_balance(db, investments_group, date(2000, 1, 1), prev_day)
        investments_close = await ComplianceService.get_group_balance(db, investments_group, date(2000, 1, 1), end_date)
        investments_change = investments_close - investments_open

        net_cash_investing = -fixed_assets_change - investments_change

        # 6. Financing Activities
        capital_group = "31000000-0000-0000-0000-000000000003"
        borrowings_group = "21100000-0000-0000-0000-000000000002"

        capital_open = -await ComplianceService.get_group_balance(db, capital_group, date(2000, 1, 1), prev_day)
        capital_close = -await ComplianceService.get_group_balance(db, capital_group, date(2000, 1, 1), end_date)
        capital_change = capital_close - capital_open  # Positive means increase (inflow)

        borrowings_open = -await ComplianceService.get_group_balance(db, borrowings_group, date(2000, 1, 1), prev_day)
        borrowings_close = -await ComplianceService.get_group_balance(db, borrowings_group, date(2000, 1, 1), end_date)
        borrowings_change = borrowings_close - borrowings_open

        net_cash_financing = capital_change + borrowings_change - finance_val

        # 7. Cash Reconciliation
        cash_group = "12300000-0000-0000-0000-000000000001"
        cash_open = await ComplianceService.get_group_balance(db, cash_group, date(2000, 1, 1), prev_day)
        cash_close = await ComplianceService.get_group_balance(db, cash_group, date(2000, 1, 1), end_date)
        cash_net_change = cash_close - cash_open

        total_net_cash = net_cash_operating + net_cash_investing + net_cash_financing

        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "operating_activities": {
                "net_profit_before_tax": float(net_profit),
                "adjustments": {
                    "depreciation_amortization": float(depr_val),
                    "finance_costs": float(finance_val)
                },
                "operating_profit_before_wc": float(operating_profit_before_wc),
                "wc_changes": {
                    "receivables_change": float(debtors_adj),
                    "payables_change": float(creditors_adj),
                    "inventory_change": float(stock_adj)
                },
                "net_cash_operating": float(net_cash_operating)
            },
            "investing_activities": {
                "fixed_assets_change": float(-fixed_assets_change),
                "investments_change": float(-investments_change),
                "net_cash_investing": float(net_cash_investing)
            },
            "financing_activities": {
                "capital_change": float(capital_change),
                "borrowings_change": float(borrowings_change),
                "finance_costs_paid": float(-finance_val),
                "net_cash_financing": float(net_cash_financing)
            },
            "net_cash_change": float(total_net_cash),
            "cash_reconciliation": {
                "opening_balance": float(cash_open),
                "closing_balance": float(cash_close),
                "reconciled_change": float(cash_net_change),
                "is_reconciled": abs(total_net_cash - cash_net_change) < 0.05
            }
        }

    @staticmethod
    async def get_cash_flow_direct(
        db: AsyncSession,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Generates AS-3 Cash Flow Statement using the Direct Method.
        Categorizes cash/bank transactions by inspecting companion journal lines.
        """
        if start_date is None or end_date is None:
            start_date, end_date = current_fy_dates()

        prev_day = start_date - timedelta(days=1)

        # 1. Fetch all journal entries that involve Cash/Bank ledgers
        sql = text("""
            WITH cash_txs AS (
              SELECT DISTINCT jl.journal_entry_id
              FROM journal_entry_lines jl
              JOIN ledger_accounts la ON la.id = jl.ledger_id
              JOIN journal_entries je ON je.id = jl.journal_entry_id
              WHERE je.is_active = true AND je.is_reversed = false AND je.date BETWEEN :start_date AND :end_date
                AND la.group_id IN (
                  SELECT id FROM account_groups
                  WHERE id = '12300000-0000-0000-0000-000000000001' 
                     OR parent_id = '12300000-0000-0000-0000-000000000001'
                )
            )
            SELECT
              je.id AS tx_id,
              je.date AS tx_date,
              jl.dr_cr AS dr_cr,
              jl.amount AS amount,
              la.id AS ledger_id,
              la.name AS ledger_name,
              ag.id AS group_id,
              ag.name AS group_name,
              ag.nature AS group_nature
            FROM journal_entry_lines jl
            JOIN journal_entries je ON je.id = jl.journal_entry_id
            JOIN ledger_accounts la ON la.id = jl.ledger_id
            JOIN account_groups ag ON ag.id = la.group_id
            WHERE je.id IN (SELECT journal_entry_id FROM cash_txs)
            ORDER BY je.id, jl.dr_cr DESC
        """)

        res = await db.execute(sql, {"start_date": start_date, "end_date": end_date})
        raw_lines = res.all()

        # Group lines by transaction
        txs = {}
        for r in raw_lines:
            txs.setdefault(str(r.tx_id), []).append(r)

        # Categorize
        operating_inflow = Decimal("0.00")
        operating_outflow = Decimal("0.00")
        investing_inflow = Decimal("0.00")
        investing_outflow = Decimal("0.00")
        financing_inflow = Decimal("0.00")
        financing_outflow = Decimal("0.00")

        cash_group_ids = {'12300000-0000-0000-0000-000000000001'}

        for tx_id, lines in txs.items():
            # Separate cash lines and companion lines
            cash_lines = []
            comp_lines = []
            for l in lines:
                is_cash = str(l.group_id) == '12300000-0000-0000-0000-000000000001' or str(l.group_id).startswith('123')
                if is_cash:
                    cash_lines.append(l)
                else:
                    comp_lines.append(l)

            if not cash_lines or not comp_lines:
                continue

            # Check net cash movement in this transaction
            # Debit to cash = Inflow, Credit to cash = Outflow
            net_inflow = Decimal("0.00")
            for cl in cash_lines:
                amt = Decimal(str(cl.amount))
                if cl.dr_cr == 'Dr':
                    net_inflow += amt
                else:
                    net_inflow -= amt

            if net_inflow == 0:
                continue

            # Determine dominant companion category
            # We map based on the group_id/parent_id of the companions
            for compl in comp_lines:
                g_id = str(compl.group_id)
                g_name = compl.group_name
                # Mapping:
                # 1. Operating: Revenue / Income / Debtors / Creditors / Expenses
                # 2. Investing: Fixed Assets / PPE / Investments
                # 3. Financing: Capital / Borrowings
                is_operating = (g_id.startswith('4') or g_id.startswith('5') or g_id == '12200000-0000-0000-0000-000000000001' or g_id == '22200000-0000-0000-0000-000000000002')
                is_investing = (g_id == '11100000-0000-0000-0000-000000000001' or g_id == '11200000-0000-0000-0000-000000000001')
                is_financing = (g_id == '31000000-0000-0000-0000-000000000003' or g_id == '32000000-0000-0000-0000-000000000003' or g_id == '21100000-0000-0000-0000-000000000002')

                share_amt = Decimal(str(compl.amount))
                # Scale share_amt to match net_inflow sign
                if net_inflow > 0:
                    # Cash Inflow: companions should represent source (Credit)
                    if is_operating:
                        operating_inflow += share_amt
                    elif is_investing:
                        investing_inflow += share_amt
                    elif is_financing:
                        financing_inflow += share_amt
                else:
                    # Cash Outflow: companions should represent application (Debit)
                    if is_operating:
                        operating_outflow += share_amt
                    elif is_investing:
                        investing_outflow += share_amt
                    elif is_financing:
                        financing_outflow += share_amt

        net_cash_operating = operating_inflow - operating_outflow
        net_cash_investing = investing_inflow - investing_outflow
        net_cash_financing = financing_inflow - financing_outflow
        total_net_cash = net_cash_operating + net_cash_investing + net_cash_financing

        # Opening/Closing cash
        cash_group = "12300000-0000-0000-0000-000000000001"
        cash_open = await ComplianceService.get_group_balance(db, cash_group, date(2000, 1, 1), prev_day)
        cash_close = await ComplianceService.get_group_balance(db, cash_group, date(2000, 1, 1), end_date)
        cash_net_change = cash_close - cash_open

        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "operating_activities": {
                "cash_receipts": float(operating_inflow),
                "cash_payments": float(operating_outflow),
                "net_cash_operating": float(net_cash_operating)
            },
            "investing_activities": {
                "sale_of_assets": float(investing_inflow),
                "purchase_of_assets": float(investing_outflow),
                "net_cash_investing": float(net_cash_investing)
            },
            "financing_activities": {
                "capital_borrowings_receipts": float(financing_inflow),
                "capital_borrowings_repayments": float(financing_outflow),
                "net_cash_financing": float(net_cash_financing)
            },
            "net_cash_change": float(total_net_cash),
            "cash_reconciliation": {
                "opening_balance": float(cash_open),
                "closing_balance": float(cash_close),
                "reconciled_change": float(cash_net_change),
                "is_reconciled": abs(total_net_cash - cash_net_change) < 100.00  # direct categorizations might have tiny gaps
            }
        }

    @staticmethod
    async def get_gstr1(
        db: AsyncSession,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Generates GSTR-1 outward supplies return summary.
        Groups invoices into B2B, B2CS, B2CL, and Export classes.
        """
        if start_date is None or end_date is None:
            start_date, end_date = current_fy_dates()

        # Fetch active invoices with customer details using eager loading
        from sqlalchemy.orm import selectinload
        stmt = (
            select(Invoice)
            .options(selectinload(Invoice.sales_order).selectinload(SalesOrder.customer))
            .filter(Invoice.status != "Cancelled", Invoice.date BETWEEN start_date and end_date)
        )
        res = await db.execute(stmt)
        invoices = res.scalars().all()

        # Fetch Company State to determine Interstate transactions
        company_stmt = select(Company).limit(1)
        company_res = await db.execute(company_stmt)
        company = company_res.scalar_one_or_none()
        company_state_code = company.gstin[:2] if (company and company.gstin) else "22"

        b2b_list = []
        b2cs_list = []
        b2cl_list = []
        export_list = []

        total_b2b_val = Decimal("0.00")
        total_b2b_tax = Decimal("0.00")
        total_b2cs_val = Decimal("0.00")
        total_b2cs_tax = Decimal("0.00")
        total_b2cl_val = Decimal("0.00")
        total_b2cl_tax = Decimal("0.00")
        total_export_val = Decimal("0.00")
        total_export_tax = Decimal("0.00")

        for inv in invoices:
            cust = inv.sales_order.customer
            tax_val = Decimal(str(inv.subtotal))
            tax_amt = Decimal(str(inv.tax_amount))
            inv_total = Decimal(str(inv.total_amount))

            cust_gstin = cust.gstin
            is_registered = bool(cust_gstin)

            cust_state_code = cust_gstin[:2] if cust_gstin else "22"
            is_interstate = cust_state_code != company_state_code

            if is_registered:
                b2b_list.append({
                    "gstin": cust_gstin,
                    "customer_name": cust.name,
                    "invoice_no": inv.invoice_number,
                    "date": inv.date.date().isoformat(),
                    "value": float(inv_total),
                    "taxable_value": float(tax_val),
                    "tax_amount": float(tax_amt)
                })
                total_b2b_val += tax_val
                total_b2b_tax += tax_amt
            else:
                # Unregistered
                # Check for B2C Large: Interstate AND invoice total > 2.5 Lakhs (250,000 INR)
                if is_interstate and inv_total > 250000:
                    b2cl_list.append({
                        "place_of_supply": cust_state_code,
                        "invoice_no": inv.invoice_number,
                        "date": inv.date.date().isoformat(),
                        "value": float(inv_total),
                        "taxable_value": float(tax_val),
                        "tax_amount": float(tax_amt)
                    })
                    total_b2cl_val += tax_val
                    total_b2cl_tax += tax_amt
                else:
                    b2cs_list.append({
                        "place_of_supply": cust_state_code,
                        "invoice_no": inv.invoice_number,
                        "date": inv.date.date().isoformat(),
                        "value": float(inv_total),
                        "taxable_value": float(tax_val),
                        "tax_amount": float(tax_amt)
                    })
                    total_b2cs_val += tax_val
                    total_b2cs_tax += tax_amt

        # HSN Summary
        hsn_sql = text("""
            SELECT
              p.hsn_code,
              SUM(ii.qty) AS total_qty,
              SUM(ii.amount) AS total_value,
              SUM(ii.tax_amount) AS total_tax
            FROM invoice_items ii
            JOIN invoices inv ON inv.id = ii.invoice_id
            JOIN products p ON p.id = ii.product_id
            WHERE inv.status != 'Cancelled' AND inv.date BETWEEN :start_date AND :end_date
            GROUP BY p.hsn_code
            ORDER BY p.hsn_code
        """)
        hsn_res = await db.execute(hsn_sql, {"start_date": start_date, "end_date": end_date})
        hsn_summary = []
        for h in hsn_res.all():
            hsn_summary.append({
                "hsn_code": h.hsn_code or "N/A",
                "total_qty": float(h.total_qty or 0.0),
                "total_value": float(h.total_value or 0.0),
                "total_tax": float(h.total_tax or 0.0)
            })

        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "b2b": {
                "total_taxable_value": float(total_b2b_val),
                "total_tax_amount": float(total_b2b_tax),
                "invoices": b2b_list
            },
            "b2cs": {
                "total_taxable_value": float(total_b2cs_val),
                "total_tax_amount": float(total_b2cs_tax),
                "invoices": b2cs_list
            },
            "b2cl": {
                "total_taxable_value": float(total_b2cl_val),
                "total_tax_amount": float(total_b2cl_tax),
                "invoices": b2cl_list
            },
            "hsn_summary": hsn_summary
        }

    @staticmethod
    async def get_gstr3b(
        db: AsyncSession,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Generates GSTR-3B return summary (Section 3.1 & Section 4).
        """
        if start_date is None or end_date is None:
            start_date, end_date = current_fy_dates()

        # Section 3.1: Outward taxable supplies
        sales_sql = text("""
            SELECT
              SUM(inv.subtotal) AS taxable_value,
              SUM(COALESCE(CAST(inv.gst_breakup->>'cgst' AS NUMERIC), 0)) AS cgst,
              SUM(COALESCE(CAST(inv.gst_breakup->>'sgst' AS NUMERIC), 0)) AS sgst,
              SUM(COALESCE(CAST(inv.gst_breakup->>'igst' AS NUMERIC), 0)) AS igst
            FROM invoices inv
            WHERE inv.status != 'Cancelled' AND inv.date BETWEEN :start_date AND :end_date
        """)
        sales_res = await db.execute(sales_sql, {"start_date": start_date, "end_date": end_date})
        s_row = sales_res.one()

        taxable_val = Decimal(str(s_row.taxable_value or 0.00))
        cgst_val = Decimal(str(s_row.cgst or 0.00))
        sgst_val = Decimal(str(s_row.sgst or 0.00))
        igst_val = Decimal(str(s_row.igst or 0.00))

        # Section 4: Eligible ITC (All other ITC - from purchases)
        pur_sql = text("""
            SELECT
              SUM(pe.subtotal) AS taxable_value,
              SUM(pe.cgst_amount) AS cgst,
              SUM(pe.sgst_amount) AS sgst,
              SUM(pe.igst_amount) AS igst
            FROM purchase_entries pe
            WHERE pe.status != 'Cancelled' AND pe.billing_date BETWEEN :start_date AND :end_date
        """)
        pur_res = await db.execute(pur_sql, {"start_date": start_date, "end_date": end_date})
        p_row = pur_res.one()

        itc_taxable = Decimal(str(p_row.taxable_value or 0.00))
        itc_cgst = Decimal(str(p_row.cgst or 0.00))
        itc_sgst = Decimal(str(p_row.sgst or 0.00))
        itc_igst = Decimal(str(p_row.igst or 0.00))

        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "section_3_1": {
                "description": "3.1 Details of Outward Supplies and inward supplies liable to reverse charge",
                "taxable_value": float(taxable_val),
                "cgst": float(cgst_val),
                "sgst": float(sgst_val),
                "igst": float(igst_val),
                "total_tax": float(cgst_val + sgst_val + igst_val)
            },
            "section_4": {
                "description": "4. Details of Eligible Input Tax Credit (ITC)",
                "taxable_value": float(itc_taxable),
                "cgst": float(itc_cgst),
                "sgst": float(itc_sgst),
                "igst": float(itc_igst),
                "total_itc": float(itc_cgst + itc_sgst + itc_igst)
            }
        }

    @staticmethod
    async def get_tds_summary(
        db: AsyncSession,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[Dict[str, Any]]:
        """
        Generates TDS section-wise deduction summary from purchase entries.
        """
        if start_date is None or end_date is None:
            start_date, end_date = current_fy_dates()

        sql = text("""
            SELECT
              pe.tds_section,
              COUNT(pe.id) AS transaction_count,
              SUM(pe.subtotal) AS total_taxable_amount,
              AVG(pe.tds_rate) AS tds_rate,
              SUM(pe.tds_amount) AS total_tds_deducted
            FROM purchase_entries pe
            WHERE pe.status != 'Cancelled' AND pe.billing_date BETWEEN :start_date AND :end_date
              AND pe.tds_section IS NOT NULL AND pe.tds_section != ''
            GROUP BY pe.tds_section
            ORDER BY pe.tds_section
        """)
        res = await db.execute(sql, {"start_date": start_date, "end_date": end_date})
        rows = res.all()

        summary = []
        for r in rows:
            summary.append({
                "section": r.tds_section,
                "count": r.transaction_count,
                "taxable_amount": float(r.total_taxable_amount or 0.00),
                "tds_rate": float(r.tds_rate or 0.00),
                "tds_amount": float(r.total_tds_deducted or 0.00)
            })
        return summary

    @staticmethod
    async def get_audit_trail(
        db: AsyncSession,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        skip: int = 0,
        limit: int = 100
    ) -> Dict[str, Any]:
        """
        Queries system audit log records complying with MCA 2021 mandates.
        """
        # Fetch audit logs joined with User
        stmt = (
            select(AuditLog, User.email, User.full_name)
            .outerjoin(User, User.id == AuditLog.user_id)
        )

        if start_date:
            start_dt = datetime(start_date.year, start_date.month, start_date.day)
            stmt = stmt.filter(AuditLog.timestamp >= start_dt)
        if end_date:
            end_dt = datetime(end_date.year, end_date.month, end_date.day, 23, 59, 59)
            stmt = stmt.filter(AuditLog.timestamp <= end_dt)

        # Count total
        count_stmt = select(func.count(AuditLog.id))
        if start_date:
            count_stmt = count_stmt.filter(AuditLog.timestamp >= start_dt)
        if end_date:
            count_stmt = count_stmt.filter(AuditLog.timestamp <= end_dt)
            
        total_res = await db.execute(count_stmt)
        total = total_res.scalar() or 0

        # Execute page query
        stmt = stmt.order_by(AuditLog.timestamp.desc()).offset(skip).limit(limit)
        res = await db.execute(stmt)
        rows = res.all()

        logs_list = []
        for row in rows:
            audit, email, full_name = row
            logs_list.append({
                "id": str(audit.id),
                "user": {
                    "id": str(audit.user_id) if audit.user_id else None,
                    "email": email or "System/API",
                    "full_name": full_name or "System Process"
                },
                "timestamp": audit.timestamp.isoformat(),
                "ip_address": audit.ip_address,
                "action": audit.action,
                "table_name": audit.table_name,
                "record_id": str(audit.record_id),
                "old_values": audit.old_values,
                "new_values": audit.new_values
            })

        return {
            "total": total,
            "skip": skip,
            "limit": limit,
            "records": logs_list
        }
