from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core import deps
from app.models.business import Branch, Company, Customer
from app.models.sales import Invoice, InvoiceItem, SalesOrder
from app.schemas.transaction import (
    SalesOrderOut, SalesOrderCreate,
    InvoiceOut, InvoiceCreate,
    InvoiceEmailRequest,
    CreditNoteCreate, CreditNoteOut
)
from app.services.tx_services import TxServices

router = APIRouter()


# ==========================================
# SALES ORDERS ENDPOINTS
# ==========================================
@router.get("/so", response_model=List[SalesOrderOut])
async def list_sales_orders(
    branch_id: Optional[UUID] = Query(None, description="Filter orders by branch"),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("sales", "view"))
):
    """Retrieve lists of sales orders."""
    return await TxServices.list_sales_orders(db, branch_id)


@router.post("/so", response_model=SalesOrderOut, status_code=status.HTTP_201_CREATED)
async def create_sales_order(
    so_data: SalesOrderCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("sales", "create"))
):
    """Create a new Sales Order."""
    return await TxServices.create_sales_order(db, so_data)





# ==========================================
# TAX INVOICES ENDPOINTS
# ==========================================
@router.get("/invoices", response_model=List[InvoiceOut])
async def list_invoices(
    branch_id: Optional[UUID] = Query(None, description="Filter invoices by branch"),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("sales", "view"))
):
    """List all registered Tax Invoices."""
    return await TxServices.list_invoices(db, branch_id)


@router.post("/invoices", response_model=InvoiceOut, status_code=status.HTTP_201_CREATED)
async def generate_invoice(
    inv_data: InvoiceCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("sales", "create"))
):
    """Generate a sequential Tax Invoice with automatic CGST+SGST/IGST breakdown."""
    return await TxServices.create_invoice(db, inv_data)


@router.put("/so/{so_id}", response_model=SalesOrderOut)
async def update_sales_order(
    so_id: UUID,
    so_data: SalesOrderCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("sales", "create"))
):
    """Update an existing Sales Order."""
    return await TxServices.update_sales_order(db, so_id, so_data)


@router.post("/so/{so_id}/cancel", response_model=SalesOrderOut)
async def cancel_sales_order(
    so_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("sales", "edit"))
):
    """Mark a Sales Order as Cancelled."""
    return await TxServices.cancel_sales_order(db, so_id)


@router.post("/invoices/{invoice_id}/cancel", response_model=InvoiceOut)
async def cancel_invoice(
    invoice_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("sales", "edit"))
):
    """Mark a Tax Invoice as Cancelled and reverse stock updates."""
    return await TxServices.cancel_invoice(db, invoice_id)


@router.delete("/so/{so_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sales_order(
    so_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("sales", "delete"))
):
    """Delete a sales order."""
    await TxServices.delete_sales_order(db, so_id)
    return None


@router.delete("/invoices/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_invoice(
    invoice_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("sales", "delete"))
):
    """Delete an invoice."""
    await TxServices.delete_invoice(db, invoice_id)
    return None


# ==========================================
# EMAIL INVOICE ENDPOINT
# ==========================================
@router.post("/invoices/{invoice_id}/email")
async def email_invoice(
    invoice_id: UUID,
    email_req: InvoiceEmailRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("sales", "view"))
):
    """
    Generate a PDF of the Tax Invoice and email it to the customer.

    Recipient email falls back to the customer's email on record if not provided
    in the request body.
    """
    from app.services.mail_service import generate_invoice_pdf, send_invoice_email

    # ── 1. Fetch Invoice with all related data ──────────────────────────────
    q_inv = await db.execute(
        select(Invoice)
        .filter(Invoice.id == invoice_id)
        .options(
            selectinload(Invoice.items).selectinload(InvoiceItem.product),
            selectinload(Invoice.sales_order).selectinload(SalesOrder.customer),
            selectinload(Invoice.delivery_challan),
        )
    )
    invoice = q_inv.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    # ── 2. Resolve customer and recipient email ──────────────────────────────
    customer = None
    if invoice.sales_order and invoice.sales_order.customer:
        customer = invoice.sales_order.customer
    elif invoice.delivery_challan and invoice.delivery_challan.customer_id:
        q_cust = await db.execute(
            select(Customer).filter(Customer.id == invoice.delivery_challan.customer_id)
        )
        customer = q_cust.scalar_one_or_none()

    recipient_email = email_req.recipient_email
    if not recipient_email:
        if customer and customer.email:
            recipient_email = customer.email
        else:
            raise HTTPException(
                status_code=422,
                detail="No recipient email provided and the customer has no email on record."
            )

    # ── 3. Fetch Company and Branch details ──────────────────────────────────
    q_br = await db.execute(select(Branch).filter(Branch.id == invoice.branch_id))
    branch = q_br.scalar_one_or_none()

    company = None
    if branch:
        q_co = await db.execute(select(Company).filter(Company.id == branch.company_id))
        company = q_co.scalar_one_or_none()

    # ── 4. Build GST breakup ──────────────────────────────────────────────────
    gst_breakup = invoice.gst_breakup if isinstance(invoice.gst_breakup, dict) else {}

    # ── 5. Assemble PDF data dict ─────────────────────────────────────────────
    items_data = []
    for item in invoice.items:
        product = item.product
        items_data.append({
            "product_name": product.name if product else "Unknown",
            "hsn_code": product.hsn_code if product else "",
            "qty": item.qty,
            "rate": item.rate,
            "discount_amount": item.discount_amount,
            "tax_rate": item.tax_rate,
            "tax_amount": item.tax_amount,
            "amount": item.amount,
        })

    pdf_data = {
        "invoice_number": invoice.invoice_number,
        "date": invoice.date,
        "due_date": invoice.due_date,
        "sales_order_number": invoice.sales_order.so_number if invoice.sales_order else None,
        "reference_note": invoice.reference_note,
        "reference_date": invoice.reference_date,
        # Company
        "company_name": company.name if company else "ORBX Corporation",
        "company_address": company.address if company else "",
        "company_gstin": company.gstin if company else "",
        "company_email": company.email if company else "",
        "company_phone": company.phone if company else "",
        "company_bank_name": company.bank_name if company else None,
        "company_bank_account_no": company.bank_account_no if company else None,
        "company_bank_ifsc_code": company.bank_ifsc_code if company else None,
        "company_bank_branch_location": company.bank_branch_location if company else None,
        # Customer
        "customer_name": customer.name if customer else "Unknown",
        "customer_gstin": customer.gstin if customer else "",
        "customer_billing_address": customer.billing_address if customer else "",
        "customer_shipping_address": customer.shipping_address if customer else "",
        # Branch
        "branch_code": branch.code if branch else "",
        "invoice_terms": branch.invoice_terms if branch else "",
        "invoice_footer": branch.invoice_footer if branch else "",
        # Financials
        "items": items_data,
        "subtotal": invoice.subtotal,
        "discount_amount": invoice.discount_amount,
        "tax_amount": invoice.tax_amount,
        "total_amount": invoice.total_amount,
        "gst_breakup": gst_breakup,
    }

    # ── 6. Generate PDF ───────────────────────────────────────────────────────
    try:
        pdf_bytes = generate_invoice_pdf(pdf_data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {exc}")

    # ── 7. Build subject and body ──────────────────────────────────────────────
    company_name = (company.name if company else "ORBX ERP")
    cust_name = (customer.name if customer else "Customer")
    inv_date_str = (invoice.date.strftime('%d-%m-%Y') if invoice.date else "")
    amt_due_str = f"{invoice.total_amount:.2f}"

    subject = email_req.subject
    if not subject:
        if company and company.email_subject_template:
            try:
                subject = company.email_subject_template.format(
                    invoice_number=invoice.invoice_number,
                    company_name=company_name,
                    customer_name=cust_name,
                    invoice_date=inv_date_str,
                    amount_due=amt_due_str
                )
            except Exception:
                subject = f"Tax Invoice {invoice.invoice_number} from {company_name}"
        else:
            subject = f"Tax Invoice {invoice.invoice_number} from {company_name}"

    body = email_req.body
    if not body:
        if company and company.email_body_template:
            try:
                body = company.email_body_template.format(
                    invoice_number=invoice.invoice_number,
                    company_name=company_name,
                    customer_name=cust_name,
                    invoice_date=inv_date_str,
                    amount_due=amt_due_str
                )
            except Exception:
                body = (
                    f"Dear {cust_name},\n\n"
                    f"Please find attached your Tax Invoice {invoice.invoice_number}.\n\n"
                    f"Invoice Date: {inv_date_str}\n"
                    f"Amount Due: ₹{amt_due_str}\n\n"
                    f"Thank you for your business.\n\n"
                    f"Regards,\n{company_name}"
                )
        else:
            body = (
                f"Dear {cust_name},\n\n"
                f"Please find attached your Tax Invoice {invoice.invoice_number}.\n\n"
                f"Invoice Date: {inv_date_str}\n"
                f"Amount Due: ₹{amt_due_str}\n\n"
                f"Thank you for your business.\n\n"
                f"Regards,\n{company_name}"
            )
    filename = f"Invoice_{invoice.invoice_number}.pdf"

    # Assemble dynamic SMTP settings from database if configured
    smtp_settings = None
    if company:
        smtp_settings = {
            "smtp_host": company.smtp_host,
            "smtp_port": company.smtp_port,
            "smtp_user": company.smtp_user,
            "smtp_password": company.smtp_password,
            "email_from": company.email_from,
        }

    # ── 8. Send email ──────────────────────────────────────────────────────────
    try:
        await send_invoice_email(
            to_email=recipient_email,
            subject=subject,
            body=body,
            pdf_bytes=pdf_bytes,
            filename=filename,
            smtp_settings=smtp_settings,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Email delivery failed: {exc}")

    return {"message": f"Invoice emailed successfully to {recipient_email}"}


# ==========================================
# CREDIT NOTES ENDPOINTS
# ==========================================
@router.get("/credit-notes", response_model=List[CreditNoteOut])
async def list_credit_notes(
    branch_id: Optional[UUID] = Query(None, description="Filter by branch"),
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("sales", "view"))
):
    """List all Credit Notes."""
    return await TxServices.list_credit_notes(db, branch_id)


@router.post("/credit-notes", response_model=CreditNoteOut, status_code=status.HTTP_201_CREATED)
async def create_credit_note(
    cn_data: CreditNoteCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("sales", "create"))
):
    """Create a Credit Note against a Tax Invoice (Sales Return)."""
    return await TxServices.create_credit_note(db, cn_data)


@router.delete("/credit-notes/{cn_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_credit_note(
    cn_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.PermissionChecker("sales", "delete"))
):
    """Delete/cancel a Credit Note and reverse all effects."""
    await TxServices.delete_credit_note(db, cn_id)
    return None
