from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth, admin, customers, suppliers, products,
    purchase, inventory, sales, payments, reports, accounts
)

api_router = APIRouter()

# Include resource endpoints
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication & Session"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin System Config"])
api_router.include_router(customers.router, prefix="/customers", tags=["Customer Master"])
api_router.include_router(suppliers.router, prefix="/suppliers", tags=["Supplier Master"])
api_router.include_router(products.router, prefix="/products", tags=["Product Catalog"])
api_router.include_router(purchase.router, prefix="/purchase", tags=["Purchase Orders & GRN"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["Warehouse Stock Ledger"])
api_router.include_router(sales.router, prefix="/sales", tags=["Sales Orders & Tax Invoices"])
api_router.include_router(payments.router, prefix="/payments", tags=["Customer Outstanding & Receipting"])
api_router.include_router(reports.router, prefix="/reports", tags=["Analytics & BI Reports"])
api_router.include_router(accounts.router, prefix="/accounts", tags=["Chart of Accounts & Ledgers"])
