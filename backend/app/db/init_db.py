import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.models.auth import Role, Permission, User
from app.models.business import Company, Branch


async def init_db(db: AsyncSession) -> None:
    # 1. Create Default Company
    query_company = await db.execute(select(Company).filter(Company.name == settings.FIRST_COMPANY_NAME))
    company = query_company.scalar_one_or_none()
    if not company:
        company = Company(
            name=settings.FIRST_COMPANY_NAME,
            logo="",
            address="123 Corporate Blvd, Silicon Valley",
            gstin="22AAAAA0000A1Z5",
            email="info@orbx.com",
            phone="+1-555-0199",
            financial_year_start="2026-04-01"
        )
        db.add(company)
        await db.commit()
        await db.refresh(company)
        print(f"Company created: {company.name}")

    # 2. Create Default Branch
    query_branch = await db.execute(select(Branch).filter(Branch.code == settings.FIRST_BRANCH_CODE))
    branch = query_branch.scalar_one_or_none()
    if not branch:
        branch = Branch(
            company_id=company.id,
            branch_name=settings.FIRST_BRANCH_NAME,
            address="Building A, Headquarters Suite",
            code=settings.FIRST_BRANCH_CODE,
            invoice_prefix="INV-",
            invoice_next_number=1,
            invoice_terms="1. Payment is due within 15 days of invoice date.\n2. Interest of 1.5% per month will be charged on late payments.",
            invoice_footer="Thank you for your business!"
        )
        db.add(branch)
        await db.commit()
        await db.refresh(branch)
        print(f"Branch created: {branch.branch_name} ({branch.code})")

    # 3. Create Default Roles
    roles_to_create = [
        {"name": "Super Admin", "desc": "Full root-level administration access to all modules."},
        {"name": "Branch Manager", "desc": "Management control over local masters and transactional processes."},
        {"name": "Sales Executive", "desc": "Execute customer interactions, sales orders, billing, and payment processing."},
        {"name": "Purchase Manager", "desc": "Manage supplier relations, procurement orders, and receipts."},
    ]
    
    seeded_roles = {}
    for r_data in roles_to_create:
        query_role = await db.execute(select(Role).filter(Role.name == r_data["name"]))
        role = query_role.scalar_one_or_none()
        if not role:
            role = Role(
                name=r_data["name"],
                description=r_data["desc"]
            )
            db.add(role)
            await db.commit()
            await db.refresh(role)
            print(f"Role created: {role.name}")
        seeded_roles[r_data["name"]] = role

    # 4. Seed Permissions Matrix
    modules = ["masters", "purchase", "inventory", "sales", "payments", "reports", "admin"]
    actions = ["view", "create", "edit", "delete"]

    # For each role, seed the permissions matrix
    # Super Admin -> All allowed
    super_admin_role = seeded_roles["Super Admin"]
    for mod in modules:
        for act in actions:
            query_p = await db.execute(
                select(Permission).filter(
                    Permission.role_id == super_admin_role.id,
                    Permission.module == mod,
                    Permission.action == act
                )
            )
            p = query_p.scalar_one_or_none()
            if not p:
                p = Permission(
                    role_id=super_admin_role.id,
                    module=mod,
                    action=act,
                    is_allowed=True
                )
                db.add(p)
    
    # Branch Manager -> Most allowed (no deletes, no admin edits except views)
    branch_mgr_role = seeded_roles["Branch Manager"]
    for mod in modules:
        for act in actions:
            query_p = await db.execute(
                select(Permission).filter(
                    Permission.role_id == branch_mgr_role.id,
                    Permission.module == mod,
                    Permission.action == act
                )
            )
            p = query_p.scalar_one_or_none()
            if not p:
                allowed = False
                if mod in ["masters", "purchase", "inventory", "sales", "payments"]:
                    allowed = (act != "delete") # view, create, edit allowed
                elif mod == "reports":
                    allowed = (act == "view") # only view reports
                elif mod == "admin":
                    allowed = (act == "view") # only view company/branch configs
                p = Permission(
                    role_id=branch_mgr_role.id,
                    module=mod,
                    action=act,
                    is_allowed=allowed
                )
                db.add(p)

    # Sales Executive -> Customer, Sales, Payments (view, create, edit)
    sales_exec_role = seeded_roles["Sales Executive"]
    for mod in modules:
        for act in actions:
            query_p = await db.execute(
                select(Permission).filter(
                    Permission.role_id == sales_exec_role.id,
                    Permission.module == mod,
                    Permission.action == act
                )
            )
            p = query_p.scalar_one_or_none()
            if not p:
                allowed = False
                if mod in ["sales", "payments"]:
                    allowed = (act != "delete")
                elif mod == "masters":
                    allowed = (act in ["view", "create"]) # cannot edit or delete customers/products
                elif mod == "inventory":
                    allowed = (act == "view") # only see stock
                p = Permission(
                    role_id=sales_exec_role.id,
                    module=mod,
                    action=act,
                    is_allowed=allowed
                )
                db.add(p)

    # Commit all seeded permissions
    await db.commit()
    print("Permissions matrix seeded successfully.")

    # 5. Create Default Super Admin User
    query_user = await db.execute(select(User).filter(User.email == settings.FIRST_SUPERUSER_EMAIL))
    user = query_user.scalar_one_or_none()
    if not user:
        user = User(
            email=settings.FIRST_SUPERUSER_EMAIL,
            hashed_password=get_password_hash(settings.FIRST_SUPERUSER_PASSWORD),
            full_name="Super Admin",
            role_id=super_admin_role.id,
            branch_id=branch.id
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        print(f"Super Admin user seeded: {user.email}")
    else:
        # Keep password fresh / updated to FIRST_SUPERUSER_PASSWORD
        user.hashed_password = get_password_hash(settings.FIRST_SUPERUSER_PASSWORD)
        db.add(user)
        await db.commit()


async def main() -> None:
    print("Seeding database...")
    async with SessionLocal() as session:
        await init_db(session)
    print("Seeding complete.")


if __name__ == "__main__":
    asyncio.run(main())
