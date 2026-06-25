from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import date, datetime, time, timezone
import io
import csv
import os
import calendar
from zoneinfo import ZoneInfo

from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

from app.database import get_db
from app.models.fuel_pump import FuelPump
from app.models.product import Product
from app.models.tank import Tank
from app.models.machine import Machine, Nozzle
from app.models.log import DailyNozzleLog, DailyTankLog, DailyFinancialLog
from app.models.credit import CreditAccount
from app.routers.operations import get_historical_price_and_margin

IST = ZoneInfo("Asia/Kolkata")

router = APIRouter(prefix="/reports", tags=["Reports & BI"])

# --- Date Helper Functions ---

def get_one_month_ago(d: date) -> date:
    """Safely subtracts exactly one month from the given date."""
    try:
        if d.month == 1:
            return d.replace(year=d.year - 1, month=12)
        else:
            prev_month = d.month - 1
            day = d.day
            while day > 28:
                try:
                    return d.replace(month=prev_month, day=day)
                except ValueError:
                    day -= 1
            return d.replace(month=prev_month, day=day)
    except Exception:
        from datetime import timedelta
        return d - timedelta(days=30)

# --- Core Report Data Generator ---

def generate_monthly_report_data(db: Session, start_date: date, end_date: date, pump_id: Optional[int] = None):
    # Verify pump if specified
    if pump_id is not None:
        pump = db.query(FuelPump).filter(FuelPump.id == pump_id, FuelPump.is_active == True).first()
        if not pump:
            raise HTTPException(status_code=404, detail="Fuel Pump not found")

    # Get active products for the pump(s)
    products_query = db.query(Product)
    if pump_id is not None:
        products_query = products_query.join(Product.pumps).filter(FuelPump.id == pump_id)
    products = products_query.all()

    # Prefetch tanks for variance calculation
    tanks_query = db.query(Tank)
    if pump_id is not None:
        tanks_query = tanks_query.filter(Tank.pump_id == pump_id)
    tanks = tanks_query.all()

    # Aggregates by product
    product_metrics = []
    total_expected_revenue = 0.0
    total_net_profit_margin = 0.0

    for product in products:
        # Find all nozzles connected to this product
        nozzles_query = db.query(Nozzle).join(Nozzle.tank).filter(Tank.product_id == product.id)
        if pump_id is not None:
            nozzles_query = nozzles_query.filter(Tank.pump_id == pump_id)
        nozzles = nozzles_query.all()
        nozzle_ids = [n.id for n in nozzles]

        # Nozzle log aggregates for this range
        nozzle_logs = db.query(DailyNozzleLog).filter(
            DailyNozzleLog.nozzle_id.in_(nozzle_ids) if nozzle_ids else False,
            DailyNozzleLog.log_date >= start_date,
            DailyNozzleLog.log_date <= end_date
        ).all()

        total_gross_liters = 0.0
        nozzle_revenue = 0.0
        nozzle_profit = 0.0

        for log in nozzle_logs:
            gross = float(log.gross_liters_sold)
            total_gross_liters += gross
            price, margin = get_historical_price_and_margin(db, product.id, log.log_timestamp)
            nozzle_revenue += gross * float(price)
            nozzle_profit += gross * float(margin)

        # Tanks storing this product
        t_ids = [t.id for t in tanks if t.product_id == product.id]

        # Tank log aggregates for this range
        tank_logs = db.query(DailyTankLog).filter(
            DailyTankLog.tank_id.in_(t_ids) if t_ids else False,
            DailyTankLog.log_date >= start_date,
            DailyTankLog.log_date <= end_date
        ).all()

        total_testing_liters = sum(float(log.testing_liters) for log in tank_logs)
        
        # Testing deductions (testing liters generate 0 revenue and 0 profit margin)
        testing_revenue_deduction = 0.0
        testing_profit_deduction = 0.0
        for log in tank_logs:
            testing = float(log.testing_liters)
            if testing > 0:
                price, margin = get_historical_price_and_margin(db, product.id, log.log_timestamp)
                testing_revenue_deduction += testing * float(price)
                testing_profit_deduction += testing * float(margin)

        net_liters = total_gross_liters - total_testing_liters
        net_revenue = nozzle_revenue - testing_revenue_deduction
        net_profit = nozzle_profit - testing_profit_deduction

        product_metrics.append({
            "product_id": product.id,
            "product_name": product.name,
            "gross_liters_sold": total_gross_liters,
            "testing_liters": total_testing_liters,
            "net_liters_sold": net_liters,
            "expected_revenue": net_revenue,
            "net_profit_margin": net_profit
        })

        total_expected_revenue += net_revenue
        total_net_profit_margin += net_profit

    # Aggregates by Tank (variance and testing)
    tank_metrics = []
    for tank in tanks:
        tank_logs = db.query(DailyTankLog).filter(
            DailyTankLog.tank_id == tank.id,
            DailyTankLog.log_date >= start_date,
            DailyTankLog.log_date <= end_date
        ).all()

        total_testing = sum(float(log.testing_liters) for log in tank_logs)
        total_variance = sum(float(log.calculated_variance) for log in tank_logs)

        tank_metrics.append({
            "tank_id": tank.id,
            "tank_name": tank.name,
            "product_name": tank.product.name,
            "testing_liters": total_testing,
            "total_variance": total_variance
        })

    # Outstanding credit balance
    credit_accounts_query = db.query(CreditAccount)
    if pump_id is not None:
        credit_accounts_query = credit_accounts_query.filter(CreditAccount.pump_id == pump_id)
    credit_accounts = credit_accounts_query.all()
    total_outstanding_credit = sum(float(acc.current_outstanding_balance) for acc in credit_accounts)

    # General financial ledger summary
    financial_logs_query = db.query(DailyFinancialLog)
    if pump_id is not None:
        financial_logs_query = financial_logs_query.filter(DailyFinancialLog.pump_id == pump_id)
    financial_logs = financial_logs_query.filter(
        DailyFinancialLog.log_date >= start_date,
        DailyFinancialLog.log_date <= end_date
    ).all()

    total_cash_collected = sum(float(log.cash_collected) for log in financial_logs)
    total_digital_collected = sum(float(log.digital_collected) for log in financial_logs)
    total_credit_sales = sum(float(log.credit_sales_logged) for log in financial_logs)
    total_shortage_overage = sum(float(log.shortage_overage) for log in financial_logs)

    return {
        "report_period": f"{start_date.isoformat()} to {end_date.isoformat()}",
        "generated_at": datetime.now(IST).strftime("%Y-%m-%d %H:%M:%S"),
        "start_date": start_date,
        "end_date": end_date,
        "pump_id": pump_id,
        "summary": {
            "expected_revenue": total_expected_revenue,
            "net_profit_margin": total_net_profit_margin,
            "total_cash_collected": total_cash_collected,
            "total_digital_collected": total_digital_collected,
            "total_credit_sales_logged": total_credit_sales,
            "total_shortage_overage": total_shortage_overage,
            "outstanding_credit_balance": total_outstanding_credit
        },
        "products": product_metrics,
        "tanks": tank_metrics
    }

# --- PDF Generation Helper ---

def generate_monthly_report_pdf(data: dict) -> io.BytesIO:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )
    story = []
    
    # Styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        textColor=colors.HexColor('#1A365D'),
        spaceAfter=10
    )
    subtitle_style = ParagraphStyle(
        'SubtitleStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=10,
        textColor=colors.HexColor('#4A5568'),
        spaceAfter=15
    )
    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        textColor=colors.HexColor('#2C5282'),
        spaceBefore=12,
        spaceAfter=6
    )
    normal_style = styles['Normal']
    
    # Title & Metadata
    title_text = "PumpKhata Consolidated Operations Report"
    if data['pump_id'] is not None:
        title_text = f"PumpKhata Operations Report - Station ID: {data['pump_id']}"
    story.append(Paragraph(title_text, title_style))
    story.append(Paragraph(f"Period: {data['report_period']}  |  Generated At: {data['generated_at']} (IST)", subtitle_style))
    
    # Financial Summary Table
    story.append(Paragraph("Financial Summary", section_heading))
    summary = data['summary']
    summary_data = [
        [Paragraph("<b>Metric</b>", normal_style), Paragraph("<b>Value (INR)</b>", normal_style)],
        [Paragraph("Expected Revenue", normal_style), Paragraph(f"{summary['expected_revenue']:.2f}", normal_style)],
        [Paragraph("Net Profit Margin", normal_style), Paragraph(f"{summary['net_profit_margin']:.2f}", normal_style)],
        [Paragraph("Cash Collected Today", normal_style), Paragraph(f"{summary['total_cash_collected']:.2f}", normal_style)],
        [Paragraph("Digital Payments Collected", normal_style), Paragraph(f"{summary['total_digital_collected']:.2f}", normal_style)],
        [Paragraph("Credit Sales Logged", normal_style), Paragraph(f"{summary['total_credit_sales_logged']:.2f}", normal_style)],
        [Paragraph("Shortage / Overage", normal_style), Paragraph(f"{summary['total_shortage_overage']:.2f}", normal_style)],
        [Paragraph("Outstanding Credit Balance", normal_style), Paragraph(f"{summary['outstanding_credit_balance']:.2f}", normal_style)]
    ]
    t_summary = Table(summary_data, colWidths=[260, 260])
    t_summary.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#E2E8F0')),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('BOTTOMPADDING', (0,0), (-1,0), 6),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E0')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F7FAFC')])
    ]))
    story.append(t_summary)
    story.append(Spacer(1, 10))
    
    # Product Sales Table
    story.append(Paragraph("Product Sales Breakdown", section_heading))
    product_headers = ["ID", "Product", "Gross Liters", "Testing Liters", "Net Liters", "Expected Rev", "Profit Margin"]
    product_table_data = [[Paragraph(f"<b>{h}</b>", normal_style) for h in product_headers]]
    for prod in data["products"]:
        product_table_data.append([
            Paragraph(str(prod["product_id"]), normal_style),
            Paragraph(prod["product_name"], normal_style),
            Paragraph(f"{prod['gross_liters_sold']:.2f}", normal_style),
            Paragraph(f"{prod['testing_liters']:.2f}", normal_style),
            Paragraph(f"{prod['net_liters_sold']:.2f}", normal_style),
            Paragraph(f"{prod['expected_revenue']:.2f}", normal_style),
            Paragraph(f"{prod['net_profit_margin']:.2f}", normal_style),
        ])
    t_products = Table(product_table_data, colWidths=[30, 80, 80, 80, 80, 90, 90])
    t_products.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#E2E8F0')),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('BOTTOMPADDING', (0,0), (-1,0), 6),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E0')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F7FAFC')])
    ]))
    story.append(t_products)
    story.append(Spacer(1, 10))
    
    # Tank Variances Table
    story.append(Paragraph("Tank Inventory & Volumetric Variances", section_heading))
    tank_headers = ["ID", "Tank Name", "Product", "Testing Poured Back", "Variance (Liters)"]
    tank_table_data = [[Paragraph(f"<b>{h}</b>", normal_style) for h in tank_headers]]
    for tank in data["tanks"]:
        tank_table_data.append([
            Paragraph(str(tank["tank_id"]), normal_style),
            Paragraph(tank["tank_name"], normal_style),
            Paragraph(tank["product_name"], normal_style),
            Paragraph(f"{tank['testing_liters']:.2f}", normal_style),
            Paragraph(f"{tank['total_variance']:.2f}", normal_style),
        ])
    t_tanks = Table(tank_table_data, colWidths=[40, 120, 110, 110, 140])
    t_tanks.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#E2E8F0')),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('BOTTOMPADDING', (0,0), (-1,0), 6),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E0')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F7FAFC')])
    ]))
    story.append(t_tanks)
    
    doc.build(story)
    buffer.seek(0)
    return buffer

# --- CSV Generation Helper ---

def generate_csv_string_helper(data: dict) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Title
    writer.writerow([f"MONTHLY OPERATIONS STATEMENT: {data['report_period']}"])
    if data['pump_id']:
        writer.writerow([f"Fuel Pump Station ID: {data['pump_id']}"])
    else:
        writer.writerow(["Consolidated Organization Statement"])
    writer.writerow([f"Generated At (IST): {data['generated_at']}"])
    writer.writerow([])
    
    # Financial summary
    writer.writerow(["FINANCIAL SUMMARY"])
    writer.writerow(["Expected Revenue", f"INR {data['summary']['expected_revenue']:.2f}"])
    writer.writerow(["Net Profit Margin", f"INR {data['summary']['net_profit_margin']:.2f}"])
    writer.writerow(["Cash Collected", f"INR {data['summary']['total_cash_collected']:.2f}"])
    writer.writerow(["Digital Collected", f"INR {data['summary']['total_digital_collected']:.2f}"])
    writer.writerow(["Credit Sales Logged", f"INR {data['summary']['total_credit_sales_logged']:.2f}"])
    writer.writerow(["Reconciliation Shortage/Overage", f"INR {data['summary']['total_shortage_overage']:.2f}"])
    writer.writerow(["Total Outstanding B2B Credit Balance", f"INR {data['summary']['outstanding_credit_balance']:.2f}"])
    writer.writerow([])
    
    # Product Sales breakdown
    writer.writerow(["PRODUCT SALES BREAKDOWN"])
    writer.writerow(["Product ID", "Product Name", "Gross Liters Sold", "Testing Liters", "Net Liters Sold", "Expected Revenue", "Profit Margin"])
    for prod in data["products"]:
        writer.writerow([
            prod["product_id"],
            prod["product_name"],
            f"{prod['gross_liters_sold']:.2f}",
            f"{prod['testing_liters']:.2f}",
            f"{prod['net_liters_sold']:.2f}",
            f"{prod['expected_revenue']:.2f}",
            f"{prod['net_profit_margin']:.2f}"
        ])
    writer.writerow([])
    
    # Tank Inventory breakdown
    writer.writerow(["TANK INVENTORY & VARIANCE"])
    writer.writerow(["Tank ID", "Tank Name", "Product Stored", "Testing Liters Poured Back", "Volumetric Variance (Liters)"])
    for tank in data["tanks"]:
        writer.writerow([
            tank["tank_id"],
            tank["tank_name"],
            tank["product_name"],
            f"{tank['testing_liters']:.2f}",
            f"{tank['total_variance']:.2f}"
        ])
    return output.getvalue()

# --- Automated Generation Service ---

def generate_and_save_monthly_report(db: Session, year: int, month: int, pump_id: Optional[int] = None) -> tuple[str, str]:
    """Generates the calendar month reports and writes PDF and CSV statements to backend/generated_reports."""
    # Find last day of previous month
    last_day = calendar.monthrange(year, month)[1]
    start_date = date(year, month, 1)
    end_date = date(year, month, last_day)

    data = generate_monthly_report_data(db, start_date, end_date, pump_id)
    
    # Create directory if it doesn't exist
    dir_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../generated_reports"))
    os.makedirs(dir_path, exist_ok=True)

    suffix = f"_pump_{pump_id}" if pump_id is not None else ""
    pdf_filename = f"report_{year}_{month:02d}{suffix}.pdf"
    csv_filename = f"report_{year}_{month:02d}{suffix}.csv"

    pdf_path = os.path.join(dir_path, pdf_filename)
    csv_path = os.path.join(dir_path, csv_filename)

    # 1. Generate & Write PDF
    pdf_buf = generate_monthly_report_pdf(data)
    with open(pdf_path, "wb") as f:
        f.write(pdf_buf.getbuffer())

    # 2. Generate & Write CSV
    csv_content = generate_csv_string_helper(data)
    with open(csv_path, "w", encoding="utf-8") as f:
        f.write(csv_content)

    print(f"Generated monthly report for {year}-{month:02d} at {pdf_path}")
    return pdf_path, csv_path

# --- Routes ---

@router.get("/monthly")
def get_monthly_report(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    pump_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Fetch the monthly BI operations report for a pump or consolidated across organization."""
    if end_date is None:
        end_date = datetime.now(IST).date()
    if start_date is None:
        start_date = get_one_month_ago(end_date)
        
    return generate_monthly_report_data(db, start_date, end_date, pump_id)

@router.get("/monthly/csv")
def export_monthly_report_csv(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    pump_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Export the monthly BI operations report as a downloadable CSV file."""
    if end_date is None:
        end_date = datetime.now(IST).date()
    if start_date is None:
        start_date = get_one_month_ago(end_date)
        
    data = generate_monthly_report_data(db, start_date, end_date, pump_id)
    csv_content = generate_csv_string_helper(data)
    
    filename = f"pumpkhata_monthly_report_{start_date.isoformat()}_to_{end_date.isoformat()}.csv"
    headers = {
        'Content-Disposition': f'attachment; filename="{filename}"'
    }
    return StreamingResponse(io.BytesIO(csv_content.encode('utf-8')), media_type='text/csv', headers=headers)

@router.get("/monthly/pdf")
def export_monthly_report_pdf(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    pump_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Export the monthly BI operations report as a downloadable vector PDF file."""
    if end_date is None:
        end_date = datetime.now(IST).date()
    if start_date is None:
        start_date = get_one_month_ago(end_date)
        
    data = generate_monthly_report_data(db, start_date, end_date, pump_id)
    pdf_buf = generate_monthly_report_pdf(data)
    
    filename = f"pumpkhata_monthly_report_{start_date.isoformat()}_to_{end_date.isoformat()}.pdf"
    headers = {
        'Content-Disposition': f'attachment; filename="{filename}"'
    }
    return StreamingResponse(pdf_buf, media_type='application/pdf', headers=headers)
