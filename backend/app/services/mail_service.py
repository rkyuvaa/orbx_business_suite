"""
Mail Service — PDF Invoice Generation + SMTP Email Dispatch.

Generates a professional A4 tax invoice PDF using reportlab and sends it
as an email attachment via aiosmtplib (async SMTP).
"""
import io
import email as email_lib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from typing import Optional, List, Dict, Any

import aiosmtplib
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT

from app.core.config import settings


# ─────────────────────────────────────────────────────────────────────────────
# PDF GENERATION
# ─────────────────────────────────────────────────────────────────────────────

FOREST_GREEN = colors.HexColor("#1B4332")
FOREST_LIGHT = colors.HexColor("#2D6A4F")
SLATE_700 = colors.HexColor("#334155")
SLATE_400 = colors.HexColor("#94A3B8")
SLATE_200 = colors.HexColor("#E2E8F0")
BLACK = colors.black
WHITE = colors.white


def _num_to_words(num: float) -> str:
    """Convert a number to Indian-style words for the amount-in-words line."""
    units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven',
             'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen',
             'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
    tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty',
            'Sixty', 'Seventy', 'Eighty', 'Ninety']

    def convert_lt1000(n: int) -> str:
        if n < 20:
            return units[n]
        if n < 100:
            return tens[n // 10] + (' ' + units[n % 10] if n % 10 else '')
        return (units[n // 100] + ' Hundred' +
                (' and ' + convert_lt1000(n % 100) if n % 100 else ''))

    def convert(n: int) -> str:
        if n == 0:
            return ''
        parts = []
        if n >= 10_000_000:
            parts.append(convert_lt1000(n // 10_000_000) + ' Crore')
            n %= 10_000_000
        if n >= 100_000:
            parts.append(convert_lt1000(n // 100_000) + ' Lakh')
            n %= 100_000
        if n >= 1_000:
            parts.append(convert_lt1000(n // 1_000) + ' Thousand')
            n %= 1_000
        if n > 0:
            parts.append(convert_lt1000(n))
        return ' '.join(parts)

    n = round(float(num), 2)
    rupees = int(n)
    paise = round((n - rupees) * 100)
    word = (convert(rupees) + ' Rupees') if rupees else 'Zero Rupees'
    if paise:
        word += ' and ' + convert_lt1000(paise) + ' Paise'
    return word + ' Only'


def generate_invoice_pdf(data: Dict[str, Any]) -> bytes:
    """
    Build a professional A4 Tax Invoice PDF and return raw bytes.

    Expected keys in `data`:
      invoice_number, date (datetime), due_date (optional),
      company_name, company_address, company_gstin, company_email, company_phone,
      customer_name, customer_gstin, customer_billing_address, customer_shipping_address,
      branch_code, invoice_terms, invoice_footer,
      items: [{ product_name, hsn_code, qty, rate, discount_amount, tax_rate, tax_amount, amount }],
      subtotal, discount_amount, tax_amount, total_amount,
      gst_breakup: { cgst, sgst, igst }
    """
    buf = io.BytesIO()
    PAGE_W, PAGE_H = A4
    MARGIN = 15 * mm

    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=MARGIN,
    )

    styles = getSampleStyleSheet()
    base_font = "Helvetica"

    def style(name, **kw):
        if "fontName" not in kw:
            kw["fontName"] = base_font
        s = ParagraphStyle(name, **kw)
        return s

    s_company = style("company", fontSize=14, fontName="Helvetica-Bold",
                      textColor=FOREST_GREEN, alignment=TA_CENTER, leading=18)
    s_company_sub = style("company_sub", fontSize=8, textColor=SLATE_700,
                          alignment=TA_CENTER, leading=11)
    s_doc_title = style("doc_title", fontSize=13, fontName="Helvetica-Bold",
                        textColor=BLACK, alignment=TA_RIGHT)
    s_doc_meta = style("doc_meta", fontSize=8, textColor=SLATE_700, alignment=TA_RIGHT)
    s_section_label = style("sec_label", fontSize=7, fontName="Helvetica-Bold",
                             textColor=SLATE_400, leading=10)
    s_party_name = style("party_name", fontSize=9, fontName="Helvetica-Bold",
                          textColor=BLACK)
    s_party_detail = style("party_detail", fontSize=8, textColor=SLATE_700, leading=11)
    s_footer_note = style("footer_note", fontSize=7, textColor=SLATE_400,
                           alignment=TA_CENTER)
    s_amount_words = style("amount_words", fontSize=7.5, fontName="Helvetica-BoldOblique",
                            textColor=SLATE_700)

    story = []

    # ── HEADER: Company block ──────────────────────────────────────────────
    story.append(Paragraph(data.get("company_name", "ORBX CORPORATION"), s_company))
    addr_parts = filter(None, [
        data.get("company_address", ""),
        f"GSTIN: {data.get('company_gstin', '')}",
        f"Email: {data.get('company_email', '')}  |  Phone: {data.get('company_phone', '')}",
    ])
    story.append(Paragraph("<br/>".join(addr_parts), s_company_sub))
    story.append(HRFlowable(width="100%", thickness=1, color=FOREST_GREEN,
                             spaceAfter=4 * mm))

    # ── DOCUMENT TITLE + NUMBER ─────────────────────────────────────────────
    inv_num = data.get("invoice_number", "")
    inv_date = data.get("date")
    date_str = inv_date.strftime("%d-%m-%Y") if inv_date else ""
    due_date = data.get("due_date")
    due_str = due_date.strftime("%d-%m-%Y") if due_date else ""

    title_table = Table(
        [[
            Paragraph("TAX INVOICE", s_doc_title),
        ]],
        colWidths=[PAGE_W - 2 * MARGIN],
    )
    story.append(title_table)

    meta_rows = [[
        Paragraph(f"<b>Invoice No.:</b> {inv_num}", s_doc_meta),
    ]]
    if date_str:
        meta_rows.append([Paragraph(f"<b>Date:</b> {date_str}", s_doc_meta)])
    if due_str:
        meta_rows.append([Paragraph(f"<b>Due Date:</b> {due_str}", s_doc_meta)])

    meta_tbl = Table(meta_rows, colWidths=[PAGE_W - 2 * MARGIN])
    story.append(meta_tbl)
    story.append(HRFlowable(width="100%", thickness=0.5, color=SLATE_200,
                             spaceBefore=2 * mm, spaceAfter=3 * mm))

    # ── BILL TO / SHIP TO ──────────────────────────────────────────────────
    def party_block(label: str, name: str, gstin: str, address: str) -> List:
        return [
            Paragraph(label, s_section_label),
            Paragraph(name or "", s_party_name),
            Paragraph((address or "").replace("\n", "<br/>"), s_party_detail),
            Paragraph(f"GSTIN: <b>{gstin or 'N/A'}</b>", s_party_detail),
        ]

    bill_block = party_block(
        "BILL TO:",
        data.get("customer_name", ""),
        data.get("customer_gstin", ""),
        data.get("customer_billing_address", ""),
    )
    ship_block = party_block(
        "SHIP TO:",
        data.get("customer_name", ""),
        "",
        data.get("customer_shipping_address", "") or data.get("customer_billing_address", ""),
    )

    # Combine into a two-column layout
    addr_table = Table(
        [[bill_block, ship_block]],
        colWidths=[(PAGE_W - 2 * MARGIN) * 0.5, (PAGE_W - 2 * MARGIN) * 0.5],
    )
    addr_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEAFTER", (0, 0), (0, 0), 0.5, SLATE_200),
        ("LEFTPADDING", (1, 0), (1, 0), 6),
    ]))
    story.append(addr_table)
    story.append(HRFlowable(width="100%", thickness=0.5, color=SLATE_200,
                             spaceBefore=3 * mm, spaceAfter=3 * mm))

    # ── ITEMS TABLE ─────────────────────────────────────────────────────────
    items = data.get("items", [])
    has_discount = any((item.get("discount_amount") or 0) > 0 for item in items)

    th_style = ParagraphStyle("th", fontName="Helvetica-Bold", fontSize=8,
                               textColor=WHITE, alignment=TA_CENTER)
    td_style = ParagraphStyle("td", fontName=base_font, fontSize=8,
                               textColor=SLATE_700, alignment=TA_CENTER)
    td_left = ParagraphStyle("td_l", fontName=base_font, fontSize=8,
                              textColor=SLATE_700, alignment=TA_LEFT)
    td_right = ParagraphStyle("td_r", fontName=base_font, fontSize=8,
                               textColor=SLATE_700, alignment=TA_RIGHT)
    td_bold_right = ParagraphStyle("td_br", fontName="Helvetica-Bold", fontSize=8,
                                    textColor=BLACK, alignment=TA_RIGHT)

    headers = ["S.No.", "Item Description", "HSN", "Qty", "Rate (₹)"]
    if has_discount:
        headers.append("Disc (₹)")
    headers += ["GST %", "Amount (₹)"]

    col_widths_base = [10 * mm, None, 18 * mm, 12 * mm, 20 * mm]
    if has_discount:
        col_widths_base.append(18 * mm)
    col_widths_base += [14 * mm, 22 * mm]

    # Distribute remaining width to "Item Description" column (index 1)
    fixed_total = sum(w for w in col_widths_base if w is not None)
    avail = PAGE_W - 2 * MARGIN - fixed_total
    col_widths = [avail if w is None else w for w in col_widths_base]

    table_data = [[Paragraph(h, th_style) for h in headers]]

    for idx, item in enumerate(items):
        row = [
            Paragraph(str(idx + 1), td_style),
            Paragraph(item.get("product_name") or "Unknown", td_left),
            Paragraph(item.get("hsn_code") or "N/A", td_style),
            Paragraph(str(item.get("qty", 0)), td_style),
            Paragraph(f"{float(item.get('rate', 0)):.2f}", td_style),
        ]
        if has_discount:
            row.append(Paragraph(f"{float(item.get('discount_amount', 0)):.2f}", td_style))
        row += [
            Paragraph(f"{float(item.get('tax_rate', 0)):.0f}%", td_style),
            Paragraph(f"{float(item.get('amount', 0)):.2f}", td_right),
        ]
        table_data.append(row)

    items_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    items_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), FOREST_GREEN),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, colors.HexColor("#F8FAFC")]),
        ("GRID", (0, 0), (-1, -1), 0.4, SLATE_200),
        ("LINEBELOW", (0, 0), (-1, 0), 1, FOREST_GREEN),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))

    story.append(items_table)
    story.append(Spacer(1, 4 * mm))

    # ── GST SUMMARY + TOTALS ───────────────────────────────────────────────
    gst = data.get("gst_breakup", {})
    cgst = float(gst.get("cgst") or 0)
    sgst = float(gst.get("sgst") or 0)
    igst = float(gst.get("igst") or 0)

    subtotal = float(data.get("subtotal") or 0)
    discount = float(data.get("discount_amount") or 0)
    tax_amt = float(data.get("tax_amount") or 0)
    total = float(data.get("total_amount") or 0)

    totals_rows = [["Subtotal:", f"₹{subtotal:.2f}"]]
    if discount > 0:
        totals_rows.append(["Discount:", f"-₹{discount:.2f}"])
    if cgst > 0:
        totals_rows.append(["CGST:", f"₹{cgst:.2f}"])
    if sgst > 0:
        totals_rows.append(["SGST:", f"₹{sgst:.2f}"])
    if igst > 0:
        totals_rows.append(["IGST:", f"₹{igst:.2f}"])
    totals_rows.append(["Grand Total:", f"₹{total:.2f}"])

    terms_text = data.get("invoice_terms", "") or ""
    
    so_num = data.get("sales_order_number")
    ref_note = data.get("reference_note")
    ref_date = data.get("reference_date")
    ref_date_str = ""
    if ref_date:
        if hasattr(ref_date, "strftime"):
            ref_date_str = ref_date.strftime("%d-%m-%Y")
        else:
            ref_date_str = str(ref_date)
            
    ref_block_text = ""
    if so_num or ref_note or ref_date_str:
        ref_block_text += "<br/><br/><b>Invoice Reference:</b>"
        if so_num:
            ref_block_text += f"<br/>Sales Order No: {so_num}"
        if ref_note:
            ref_block_text += f"<br/>Reference Note: {ref_note}"
        if ref_date_str:
            ref_block_text += f"<br/>Reference Date: {ref_date_str}"
            
    terms_para = Paragraph(
        f"<b>Terms &amp; Conditions:</b><br/>{terms_text}{ref_block_text}",
        ParagraphStyle("terms", fontName=base_font, fontSize=7, textColor=SLATE_700,
                       leading=10)
    )

    def totals_para(label, value, bold=False):
        fn = "Helvetica-Bold" if bold else base_font
        clr = FOREST_GREEN if bold else SLATE_700
        l_style = ParagraphStyle("tl", fontName=fn, fontSize=8,
                                  textColor=clr, alignment=TA_LEFT)
        v_style = ParagraphStyle("tv", fontName=fn, fontSize=8,
                                  textColor=clr, alignment=TA_RIGHT)
        return [Paragraph(label, l_style), Paragraph(value, v_style)]

    totals_table_data = [totals_para(r[0], r[1], bold=(r[0] == "Grand Total:"))
                          for r in totals_rows]
    totals_table = Table(
        totals_table_data,
        colWidths=[30 * mm, 25 * mm],
    )
    totals_table.setStyle(TableStyle([
        ("LINEABOVE", (0, -1), (-1, -1), 0.8, FOREST_GREEN),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 2),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2),
    ]))

    summary_table = Table(
        [[terms_para, totals_table]],
        colWidths=[(PAGE_W - 2 * MARGIN) * 0.55, (PAGE_W - 2 * MARGIN) * 0.45],
    )
    summary_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 2 * mm))

    # Amount in words
    story.append(Paragraph(
        f"<i>Amount in Words: <b>{_num_to_words(total)}</b></i>",
        s_amount_words
    ))
    story.append(HRFlowable(width="100%", thickness=0.5, color=SLATE_200,
                             spaceBefore=3 * mm, spaceAfter=3 * mm))

    # Bank Details
    bank_name = data.get("company_bank_name")
    if bank_name:
        bank_ac = data.get("company_bank_account_no") or ""
        bank_ifsc = data.get("company_bank_ifsc_code") or ""
        bank_branch = data.get("company_bank_branch_location") or ""
        
        bank_title_style = ParagraphStyle("btitle", fontName="Helvetica-Bold", fontSize=8, textColor=BLACK, leading=10)
        bank_val_style = ParagraphStyle("bval", fontName=base_font, fontSize=7.5, textColor=SLATE_700, leading=10)
        
        story.append(Paragraph("<b>Bank Details:</b>", bank_title_style))
        story.append(Paragraph(f"Bank Name: <b>{bank_name}</b>  |  A/C No: <b>{bank_ac}</b>", bank_val_style))
        story.append(Paragraph(f"IFSC Code: <b>{bank_ifsc}</b>  |  Branch: <b>{bank_branch}</b>", bank_val_style))
        story.append(HRFlowable(width="100%", thickness=0.5, color=SLATE_200,
                                 spaceBefore=3 * mm, spaceAfter=3 * mm))

    # ── SIGNATURE ROW ──────────────────────────────────────────────────────
    sig_style = ParagraphStyle("sig", fontName=base_font, fontSize=7.5,
                                textColor=SLATE_700, alignment=TA_LEFT)
    sig_right = ParagraphStyle("sig_r", fontName=base_font, fontSize=7.5,
                                 textColor=SLATE_700, alignment=TA_RIGHT)
    sig_table = Table(
        [[
            Paragraph("Customer Signature", sig_style),
            Paragraph(
                f"Authorized Signatory for <b>{data.get('company_name', '')}</b>",
                sig_right
            ),
        ]],
        colWidths=[(PAGE_W - 2 * MARGIN) / 2] * 2,
    )
    sig_table.setStyle(TableStyle([
        ("LINEABOVE", (0, 0), (0, 0), 0.8, BLACK),
        ("LINEABOVE", (1, 0), (1, 0), 0.8, BLACK),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(sig_table)
    story.append(Spacer(1, 4 * mm))

    # ── FOOTER ─────────────────────────────────────────────────────────────
    footer_text = data.get("invoice_footer", "") or "Thank you for your business!"
    story.append(Paragraph(footer_text, s_footer_note))

    doc.build(story)
    return buf.getvalue()


# ─────────────────────────────────────────────────────────────────────────────
# EMAIL DISPATCH
# ─────────────────────────────────────────────────────────────────────────────

async def send_invoice_email(
    to_email: str,
    subject: str,
    body: str,
    pdf_bytes: bytes,
    filename: str,
    smtp_settings: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Send an email with a PDF attachment via SMTP (async).

    Raises RuntimeError if SMTP credentials are not configured.
    Raises aiosmtplib.SMTPException on delivery failure.
    """
    # Fall back to settings if not provided in smtp_settings dict
    smtp_host = (smtp_settings or {}).get("smtp_host") or settings.SMTP_HOST
    smtp_port = (smtp_settings or {}).get("smtp_port") or settings.SMTP_PORT
    smtp_user = (smtp_settings or {}).get("smtp_user") or settings.SMTP_USER
    smtp_password = (smtp_settings or {}).get("smtp_password") or settings.SMTP_PASSWORD
    email_from = (smtp_settings or {}).get("email_from") or settings.EMAIL_FROM or smtp_user

    # Convert port to int if it's a string
    if smtp_port is not None:
        try:
            smtp_port = int(smtp_port)
        except ValueError:
            smtp_port = 587

    if not smtp_user or not smtp_password or not smtp_host:
        raise RuntimeError(
            "SMTP credentials are not configured. "
            "Please configure SMTP host, user, and password in Company Config or your .env file."
        )

    # Build MIME message
    msg = MIMEMultipart()
    msg["From"] = email_from
    msg["To"] = to_email
    msg["Subject"] = subject

    # Plain text body
    msg.attach(MIMEText(body, "plain"))

    # PDF attachment
    part = MIMEBase("application", "octet-stream")
    part.set_payload(pdf_bytes)
    encoders.encode_base64(part)
    part.add_header(
        "Content-Disposition",
        f"attachment; filename=\"{filename}\"",
    )
    msg.attach(part)

    # Send via async SMTP
    await aiosmtplib.send(
        msg,
        hostname=smtp_host,
        port=smtp_port or 587,
        username=smtp_user,
        password=smtp_password,
        start_tls=True,
    )
