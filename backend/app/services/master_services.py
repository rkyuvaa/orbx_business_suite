from typing import List, Optional
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.models.business import Customer, Supplier
from app.models.product import ProductCategory, Product, ProductPricing
from app.schemas.master import (
    CustomerCreate, CustomerUpdate, SupplierCreate, SupplierUpdate,
    ProductCategoryCreate, ProductCreate, ProductUpdate
)


class MasterServices:
    # ==========================================
    # CUSTOMER SERVICES
    # ==========================================
    @staticmethod
    async def list_customers(db: AsyncSession, branch_id: Optional[UUID] = None, search: Optional[str] = None) -> List[Customer]:
        """List all customer accounts, optionally filtering by active branch and search query."""
        stmt = select(Customer).order_by(Customer.created_at.desc())
        if branch_id:
            stmt = stmt.filter(Customer.branch_id == branch_id)
        if search:
            stmt = stmt.filter(Customer.name.ilike(f"%{search}%") | Customer.code.ilike(f"%{search}%"))
        query = await db.execute(stmt)
        return list(query.scalars().all())

    @staticmethod
    async def create_customer(db: AsyncSession, customer_data: CustomerCreate) -> Customer:
        """Create a customer master record."""
        if not customer_data.code:
            from sqlalchemy import func
            count_query = await db.execute(select(func.count()).select_from(Customer))
            count = count_query.scalar() or 0
            next_num = count + 1
            
            while True:
                candidate = str(next_num)
                query_check = await db.execute(select(Customer).filter(Customer.code == candidate))
                if not query_check.scalar_one_or_none():
                    customer_data.code = candidate
                    break
                next_num += 1
        else:
            # Verify unique code
            query_check = await db.execute(select(Customer).filter(Customer.code == customer_data.code))
            if query_check.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Customer code '{customer_data.code}' already exists."
                )

        customer = Customer(**customer_data.model_dump())
        db.add(customer)
        await db.commit()
        await db.refresh(customer)
        return customer

    @staticmethod
    async def update_customer(db: AsyncSession, customer_id: UUID, customer_data: CustomerUpdate) -> Customer:
        """Update a customer master record."""
        query = await db.execute(select(Customer).filter(Customer.id == customer_id))
        customer = query.scalar_one_or_none()
        if not customer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found.")
        
        for key, value in customer_data.model_dump(exclude_unset=True).items():
            setattr(customer, key, value)
            
        db.add(customer)
        await db.commit()
        await db.refresh(customer)
        return customer

    # ==========================================
    # SUPPLIER SERVICES
    # ==========================================
    @staticmethod
    async def list_suppliers(db: AsyncSession, branch_id: Optional[UUID] = None, search: Optional[str] = None) -> List[Supplier]:
        """List all suppliers, optionally filtering by branch and search query."""
        stmt = select(Supplier).order_by(Supplier.created_at.desc())
        if branch_id:
            stmt = stmt.filter(Supplier.branch_id == branch_id)
        if search:
            stmt = stmt.filter(Supplier.name.ilike(f"%{search}%") | Supplier.code.ilike(f"%{search}%"))
        query = await db.execute(stmt)
        return list(query.scalars().all())

    @staticmethod
    async def create_supplier(db: AsyncSession, supplier_data: SupplierCreate) -> Supplier:
        """Create a supplier record."""
        if not supplier_data.code:
            from sqlalchemy import func
            count_query = await db.execute(select(func.count()).select_from(Supplier))
            count = count_query.scalar() or 0
            next_num = count + 1
            
            while True:
                candidate = str(next_num)
                query_check = await db.execute(select(Supplier).filter(Supplier.code == candidate))
                if not query_check.scalar_one_or_none():
                    supplier_data.code = candidate
                    break
                next_num += 1
        else:
            query_check = await db.execute(select(Supplier).filter(Supplier.code == supplier_data.code))
            if query_check.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Supplier code '{supplier_data.code}' already exists."
                )

        supplier = Supplier(**supplier_data.model_dump())
        db.add(supplier)
        await db.commit()
        await db.refresh(supplier)
        return supplier

    @staticmethod
    async def update_supplier(db: AsyncSession, supplier_id: UUID, supplier_data: SupplierUpdate) -> Supplier:
        """Update supplier profile information."""
        query = await db.execute(select(Supplier).filter(Supplier.id == supplier_id))
        supplier = query.scalar_one_or_none()
        if not supplier:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found.")

        for key, value in supplier_data.model_dump(exclude_unset=True).items():
            setattr(supplier, key, value)

        db.add(supplier)
        await db.commit()
        await db.refresh(supplier)
        return supplier

    # ==========================================
    # PRODUCT CATEGORIES SERVICES
    # ==========================================
    @staticmethod
    async def list_categories(db: AsyncSession) -> List[ProductCategory]:
        """List all product categories."""
        query = await db.execute(select(ProductCategory).order_by(ProductCategory.created_at.desc()))
        return list(query.scalars().all())

    @staticmethod
    async def create_category(db: AsyncSession, category_data: ProductCategoryCreate) -> ProductCategory:
        """Create a new product category."""
        category = ProductCategory(**category_data.model_dump())
        db.add(category)
        await db.commit()
        await db.refresh(category)
        return category

    @staticmethod
    async def update_category(db: AsyncSession, category_id: UUID, category_data: ProductCategoryCreate) -> ProductCategory:
        """Update a product category."""
        query = await db.execute(select(ProductCategory).filter(ProductCategory.id == category_id))
        cat = query.scalar_one_or_none()
        if not cat:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found.")
        
        cat.name = category_data.name
        cat.parent_id = category_data.parent_id
        cat.description = category_data.description
        db.add(cat)
        await db.commit()
        await db.refresh(cat)
        return cat

    # ==========================================
    # PRODUCTS SERVICES
    # ==========================================
    @staticmethod
    async def list_products(db: AsyncSession, search: Optional[str] = None) -> List[Product]:
        """List all product records including branch pricing overrides and search filter."""
        stmt = select(Product).options(selectinload(Product.pricing_overrides)).order_by(Product.created_at.desc())
        if search:
            stmt = stmt.filter(Product.name.ilike(f"%{search}%") | Product.sku.ilike(f"%{search}%"))
        query = await db.execute(stmt)
        return list(query.scalars().all())

    @staticmethod
    async def create_product(db: AsyncSession, product_data: ProductCreate) -> Product:
        """Create a product master record and generate optional price overrides."""
        query_check = await db.execute(select(Product).filter(Product.sku == product_data.sku))
        if query_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product with SKU '{product_data.sku}' already exists."
            )

        # Extract pricing overrides
        overrides_data = product_data.pricing_overrides or []
        product_dict = product_data.model_dump()
        product_dict.pop("pricing_overrides", None)

        product = Product(**product_dict)
        db.add(product)
        await db.commit()
        await db.refresh(product)

        # Seed price overrides
        for override in overrides_data:
            pr = ProductPricing(
                product_id=product.id,
                branch_id=override.branch_id,
                customer_group=override.customer_group,
                price_override=override.price_override
            )
            db.add(pr)
        await db.commit()

        # Re-fetch product with overrides loaded
        query_final = await db.execute(
            select(Product)
            .filter(Product.id == product.id)
            .options(selectinload(Product.pricing_overrides))
        )
        return query_final.scalar_one()

    @staticmethod
    async def update_product(db: AsyncSession, product_id: UUID, product_data: ProductUpdate) -> Product:
        """Update a product and rewrite its custom branch-level price overrides."""
        query = await db.execute(select(Product).filter(Product.id == product_id))
        product = query.scalar_one_or_none()
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")

        data = product_data.model_dump(exclude_unset=True)
        overrides_data = data.pop("pricing_overrides", None)

        # Update product fields
        for key, value in data.items():
            setattr(product, key, value)
        db.add(product)

        # Update price overrides if provided
        if overrides_data is not None:
            # Delete old overrides
            query_old = await db.execute(
                select(ProductPricing).filter(ProductPricing.product_id == product.id)
            )
            for old_o in query_old.scalars().all():
                await db.delete(old_o)

            # Insert new overrides
            for override in overrides_data:
                pr = ProductPricing(
                    product_id=product.id,
                    branch_id=override.get("branch_id"),
                    customer_group=override.get("customer_group"),
                    price_override=override.get("price_override")
                )
                db.add(pr)

        await db.commit()

        # Re-fetch
        query_final = await db.execute(
            select(Product)
            .filter(Product.id == product.id)
            .options(selectinload(Product.pricing_overrides))
        )
        return query_final.scalar_one()

    @staticmethod
    async def delete_customer(db: AsyncSession, customer_id: UUID) -> None:
        """Delete customer record."""
        query = await db.execute(select(Customer).filter(Customer.id == customer_id))
        customer = query.scalar_one_or_none()
        if not customer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found.")
        try:
            await db.delete(customer)
            await db.commit()
        except Exception:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete customer. It may be referenced by active transactions."
            )

    @staticmethod
    async def delete_supplier(db: AsyncSession, supplier_id: UUID) -> None:
        """Delete supplier record."""
        query = await db.execute(select(Supplier).filter(Supplier.id == supplier_id))
        supplier = query.scalar_one_or_none()
        if not supplier:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found.")
        try:
            await db.delete(supplier)
            await db.commit()
        except Exception:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete supplier. It may be referenced by active transactions."
            )

    @staticmethod
    async def delete_product(db: AsyncSession, product_id: UUID) -> None:
        """Delete product record."""
        query = await db.execute(select(Product).filter(Product.id == product_id))
        product = query.scalar_one_or_none()
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")
        try:
            await db.delete(product)
            await db.commit()
        except Exception:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete product. It may be referenced by active transactions."
            )
