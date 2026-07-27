import io
import zipfile
from datetime import date
from decimal import Decimal
from typing import List, Dict, Any

from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        canvas.Canvas.__init__(self, *args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_number(self, page_count):
        self.setFont("Helvetica", 9)
        page_width = self._pagesize[0]
        self.drawRightString(page_width - 30, 20, f"Page {self._pageNumber} of {page_count}")

styles = getSampleStyleSheet()
title_style = styles['Heading1']
title_style.alignment = 1 # Center
normal_style = styles['Normal']

subtitle_style = ParagraphStyle(
    "SubtitleCentered",
    parent=styles['Heading2'],
    alignment=1
)

date_style = ParagraphStyle(
    "DateCentered",
    parent=styles['Normal'],
    alignment=1
)

def generate_statement_pdf(pump: Any, sessions: List[Any], start_date: date, end_date: date) -> bytes:
    buffer = io.BytesIO()
    # Use landscape for statements to accommodate many account columns
    doc = SimpleDocTemplate(buffer, pagesize=landscape(letter), rightMargin=20, leftMargin=20, topMargin=30, bottomMargin=30)
    elements = []
    
    elements.append(Paragraph(f"{pump.name}", title_style))
    elements.append(Spacer(1, 0.1*inch))
    elements.append(Paragraph(f"Financial Statement", subtitle_style))
    elements.append(Paragraph(f"<b>{start_date}</b> to <b>{end_date}</b>", date_style))
    elements.append(Spacer(1, 0.25*inch))
    
    # Identify accounts and sort so IOCL is first
    accounts = sorted(pump.pump_accounts, key=lambda acc: 0 if "iocl" in acc.name.lower() else 1)
    account_ids = [acc.id for acc in accounts]
    
    # Determine font size upfront based on column count
    num_accs = len(accounts)
    total_cols = 4 + num_accs
    font_size = 9 if total_cols <= 6 else (8 if total_cols <= 9 else 7)
    
    dynamic_cell_style = ParagraphStyle(
        "DynamicCell",
        parent=styles['Normal'],
        fontSize=font_size,
        alignment=2 # Right align
    )
    
    dynamic_total_style = ParagraphStyle(
        "DynamicTotal",
        parent=styles['Normal'],
        fontSize=font_size,
        fontName="Helvetica-Bold",
        alignment=2 # Right align
    )
    
    # Table headers
    headers = ["Date", "Opening Cash", "Closing Cash", "Short/Over"]
    for acc in accounts:
        headers.append(f"{acc.name} Deposit")
    
    data = [headers]
    
    total_short_over = Decimal('0')
    account_totals = {acc.id: Decimal('0') for acc in accounts}
    
    for s in sessions:
        short_over = s.shortage_overage or Decimal(0)
        total_short_over += short_over
        
        # Calculate deposits per account for this session
        session_deposits = {acc.id: Decimal('0') for acc in accounts}
        for txn in s.account_transactions:
            if txn.account_id in session_deposits:
                session_deposits[txn.account_id] += txn.amount
                account_totals[txn.account_id] += txn.amount
        
        # Format short/over with color
        so_color = "green" if short_over > 0 else ("red" if short_over < 0 else "black")
        so_text = f"<font color={so_color}>{short_over:,.2f}</font>"
        
        row = [
            s.log_date.strftime("%Y-%m-%d"),
            f"{s.opening_cash_balance:,.2f}",
            f"{s.closing_cash_balance or Decimal(0):,.2f}",
            Paragraph(so_text, dynamic_cell_style)
        ]
        
        for acc_id in account_ids:
            row.append(f"{session_deposits[acc_id]:,.2f}")
            
        data.append(row)
        
    # Totals row
    t_so_color = "green" if total_short_over > 0 else ("red" if total_short_over < 0 else "black")
    t_so_text = f"<font color={t_so_color}>{total_short_over:,.2f}</font>"
    
    totals_row = ["TOTALS", "", "", Paragraph(t_so_text, dynamic_total_style)]
    for acc_id in account_ids:
        totals_row.append(f"{account_totals[acc_id]:,.2f}")
    data.append(totals_row)
    
    # Determine dynamic column widths for landscape (11 inches = 792 points, minus 40pt margins = 752pt)
    available_width = 752
    # Base columns: Date, Opening, Closing, Short/Over
    base_width = 75 if num_accs < 6 else 65
    col_widths = [base_width, base_width, base_width, base_width]
    
    remaining_width = available_width - sum(col_widths)
    acc_col_width = remaining_width / num_accs if num_accs > 0 else 0
    for _ in accounts:
        col_widths.append(acc_col_width)
        
    t = Table(data, repeatRows=1, colWidths=col_widths)
    t.setStyle(TableStyle([
        ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor('#1e293b')),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), font_size),
        ('LINEABOVE', (0,0), (-1,0), 1, colors.HexColor('#cbd5e1')),
        ('LINEBELOW', (0,0), (-1,0), 1, colors.HexColor('#94a3b8')),
        ('ALIGN', (0,0), (-1,-1), 'RIGHT'),
        ('ALIGN', (0,0), (0,-1), 'LEFT'), # Date column left aligned
        ('ALIGN', (0,0), (-1,0), 'CENTER'), # Headers centered
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        
        # Totals row
        ('FONTNAME', (0,-1), (-1,-1), 'Helvetica-Bold'),
        ('LINEABOVE', (0,-1), (-1,-1), 1, colors.HexColor('#94a3b8')),
        ('LINEBELOW', (0,-1), (-1,-1), 2, colors.HexColor('#1e293b')),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#f8fafc')),
    ]))
    
    elements.append(t)
    doc.build(elements, canvasmaker=NumberedCanvas)
    
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes

def generate_report_pdf(pump: Any, sessions: List[Any], margins: Dict[int, Decimal], exps: Dict[str, Decimal], start_date: date, end_date: date) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    elements = []
    
    elements.append(Paragraph(f"{pump.name}", title_style))
    elements.append(Spacer(1, 0.1*inch))
    elements.append(Paragraph(f"Financial Report", subtitle_style))
    elements.append(Paragraph(f"<b>{start_date}</b> to <b>{end_date}</b>", date_style))
    elements.append(Spacer(1, 0.25*inch))
    # Define professional table styles
    def get_pro_table_style(has_total_row=True):
        style = [
            ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor('#1e293b')),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('LINEABOVE', (0,0), (-1,0), 1, colors.HexColor('#cbd5e1')),
            ('LINEBELOW', (0,0), (-1,0), 1, colors.HexColor('#94a3b8')),
            ('ALIGN', (1,0), (-1,-1), 'RIGHT'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ]
        if has_total_row:
            style.extend([
                ('FONTNAME', (0,-1), (-1,-1), 'Helvetica-Bold'),
                ('LINEABOVE', (0,-1), (-1,-1), 1, colors.HexColor('#94a3b8')),
                ('LINEBELOW', (0,-1), (-1,-1), 2, colors.HexColor('#1e293b')),
            ])
        else:
            style.extend([
                ('LINEBELOW', (0,-1), (-1,-1), 1, colors.HexColor('#e2e8f0')),
            ])
        return TableStyle(style)
        
    section_title_style = ParagraphStyle(
        "SectionTitle",
        parent=styles['Heading2'],
        textColor=colors.HexColor('#334155'),
        spaceBefore=20,
        spaceAfter=10,
        fontSize=12,
        textTransform='uppercase'
    )

    # 1. Gross Profit Calculation
    gross_profit = Decimal('0')
    volume_by_product = {}
    total_sales_value = Decimal('0')
    
    # Inventory variance calculation
    variance_by_tank = {}
    
    for s in sessions:
        # Nozzle Logs (Sales & Margins)
        for n_log in s.nozzle_logs:
            prod_id = n_log.nozzle.tank.product_id
            vol = n_log.gross_liters_sold or Decimal(0)
            value = vol * (n_log.product_price or Decimal(0))
            if prod_id not in volume_by_product:
                volume_by_product[prod_id] = {'name': n_log.nozzle.tank.product.name, 'vol': Decimal(0), 'value': Decimal(0)}
            volume_by_product[prod_id]['vol'] += vol
            volume_by_product[prod_id]['value'] += value
            total_sales_value += value
            
        # Tank Logs (Variance)
        for t_log in s.tank_logs:
            t_id = t_log.tank_id
            var = t_log.calculated_variance or Decimal(0)
            if t_id not in variance_by_tank:
                variance_by_tank[t_id] = {'name': t_log.tank.name, 'var': Decimal(0), 'days': 0}
            variance_by_tank[t_id]['var'] += var
            variance_by_tank[t_id]['days'] += 1
            
    # Draw Revenue & Margins Table
    elements.append(Paragraph("GROSS PROFIT", section_title_style))
    margin_data = [["Product", "Liters Sold", "Revenue (Rs.)", "Margin (Rs./L)", "Gross Profit (Rs.)"]]
    for pid, pdata in volume_by_product.items():
        margin = margins.get(pid, Decimal('0'))
        profit = pdata['vol'] * margin
        gross_profit += profit
        margin_data.append([
            pdata['name'], 
            f"{pdata['vol']:,.2f}", 
            f"{pdata['value']:,.2f}",
            f"{margin:,.2f}", 
            f"{profit:,.2f}"
        ])
    margin_data.append(["TOTAL", "", f"{total_sales_value:,.2f}", "", f"{gross_profit:,.2f}"])
    
    tm = Table(margin_data, colWidths=[1.5*inch, 1.2*inch, 1.2*inch, 1.2*inch, 1.5*inch])
    tm.setStyle(get_pro_table_style(has_total_row=True))
    elements.append(tm)
    
    # 2. Expenditures
    elements.append(Paragraph("EXPENDITURES", section_title_style))
    exp_data = [
        ["Category", "Amount (Rs.)"],
        ["Bank Expenditures", f"{exps['bank']:,.2f}"],
        ["IOCL Expenditures", f"{exps['iocl']:,.2f}"],
        ["Salaries", f"{exps['salary']:,.2f}"],
        ["Misc Expenditures", f"{exps['misc']:,.2f}"]
    ]
    total_exp = exps['bank'] + exps['iocl'] + exps['salary'] + exps['misc']
    exp_data.append(["TOTAL EXPENDITURES", f"{total_exp:,.2f}"])
    
    te = Table(exp_data, colWidths=[3*inch, 2*inch])
    te.setStyle(get_pro_table_style(has_total_row=True))
    elements.append(te)
    
    # 3. Inventory Loss/Gain
    elements.append(Paragraph("INVENTORY VARIANCE", section_title_style))
    inv_data = [["Tank", "Total Variance (Liters)", "Average Daily Var (L/Day)"]]
    for tid, tdata in variance_by_tank.items():
        avg = tdata['var'] / Decimal(tdata['days']) if tdata['days'] > 0 else Decimal(0)
        
        # Color coding for variance
        v_color = "green" if tdata['var'] >= 0 else "red"
        avg_color = "green" if avg >= 0 else "red"
        
        v_text = f"<font color={v_color}>{tdata['var']:,.2f}</font>"
        avg_text = f"<font color={avg_color}>{avg:,.2f}</font>"
        
        inv_data.append([
            tdata['name'],
            Paragraph(v_text, ParagraphStyle("RAlign", alignment=2)),
            Paragraph(avg_text, ParagraphStyle("RAlign", alignment=2))
        ])
    ti = Table(inv_data, colWidths=[2.5*inch, 2.5*inch, 2*inch])
    ti.setStyle(get_pro_table_style(has_total_row=False))
    elements.append(ti)
    elements.append(Spacer(1, 0.4*inch))
    
    # 4. Final Net Profit/Loss
    net_profit = gross_profit - total_exp
    
    color = colors.green if net_profit >= 0 else colors.red
    label = "NET PROFIT" if net_profit >= 0 else "NET LOSS"
    
    net_data = [[label, f"Rs. {abs(net_profit):,.2f}"]]
    tn = Table(net_data, colWidths=[3.5*inch, 2*inch])
    tn.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 16),
        ('TEXTCOLOR', (1,0), (1,0), color),
        ('TEXTCOLOR', (0,0), (0,0), colors.HexColor('#0f172a')),
        ('ALIGN', (1,0), (1,0), 'RIGHT'),
        ('LINEABOVE', (0,0), (-1,-1), 2, colors.HexColor('#1e293b')),
        ('LINEBELOW', (0,0), (-1,-1), 3, colors.HexColor('#1e293b')),
        ('TOPPADDING', (0,0), (-1,-1), 12),
        ('BOTTOMPADDING', (0,0), (-1,-1), 12),
    ]))
    elements.append(tn)
    
    doc.build(elements, canvasmaker=NumberedCanvas)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes

def generate_report_zip(pump: Any, sessions: List[Any], margins: Dict[int, Decimal], exps: Dict[str, Decimal], start_date: date, end_date: date) -> bytes:
    statement_pdf = generate_statement_pdf(pump, sessions, start_date, end_date)
    report_pdf = generate_report_pdf(pump, sessions, margins, exps, start_date, end_date)
    
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        zip_file.writestr(f"statement_{start_date}_to_{end_date}.pdf", statement_pdf)
        zip_file.writestr(f"report_{start_date}_to_{end_date}.pdf", report_pdf)
        
    return zip_buffer.getvalue()
