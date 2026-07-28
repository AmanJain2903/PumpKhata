# PumpKhata ⛽📊 (v1.0.0)

**PumpKhata** is a proprietary, closed-loop Fuel Pump Management System designed for multi-pump fuel station firms. The system completely eliminates manual pen-and-paper tracking, migrating daily operations to a secure, digital enterprise ledger.

Developed as a mobile-first, cross-platform Progressive Web Application (PWA), PumpKhata v1.0.0 optimizes physical stock auditing, multi-product dispenser configurations, daily shift reconciliations, B2B credit ledger tracking, custom bank deposits, and automated monthly business intelligence reporting with PDF exports.

---

## 🚀 Core Features (v1.0.0 Release)

### 1. Secure Access Control & Auth
* **Google OAuth2 Integration**: Secure, unified login via Google SSO. Only whitelisted users can access the system.
* **Role-Based Access Control (RBAC)**: Distinct permissions for `admin` (daily operations) and `super_admin` (user management & global configuration).
* **Session Management**: JWT-based authentication tokens.

### 2. Master Data Management / MDM
* **Configuration CRUD**: Owner interface to provision stations, tanks, machines, nozzles, and products.
* **Custom Bank Accounts**: Manage station bank accounts (e.g., IOCL, Paytm, ICICI). Specifically track which accounts are linked to Paytm QR codes for automated digital inflow reconciliation.
* **Dynamic Pricing**: Dynamic price and cost margin updates per liter. Price histories are timestamped to ensure historical log reconciliations utilize the rate active at that specific time.

### 3. Daily Shift Log & Meter Tracking
* **Auto-Population**: Opens nozzle logs with the previous day's closing readings.
* **Rollover Logic**: Detects meter rollovers/resets via an authenticated "Meter Reset" flag when closing reading < opening reading.
* **Wet-Stock Audits**: Demands actual dip-rod/sensor physical stock readings at shift closing to match against expected book stock and calculate variance.

### 4. Credit Accounts & B2B Ledger
* **B2B Ledger**: Maintains client buyer profiles with real-time outstanding balances.
* **Credit Sales**: Allows a portion of daily shift revenue to be logged as a credit sale, instantly incrementing the customer's pending debt.
* **Payment Log**: Captures partial or full payments clearing outstanding buyer debts.

### 5. Daily Financial Reconciliation
* **Net-Sales Expectation**: Expected revenue is calculated strictly using net volume sold.
* **Payment Split**: Records cash collected versus digital collections, tying digital inputs to specific customized payment methods.
* **Cash Deposits**: Seamlessly record physical cash deposits from the station's cash pool directly into custom bank accounts.
* **Overage/Shortage Audits**: Automatically compares collected cash/digital/credit aggregates against expected net revenue targets, flagging variances.

### 6. Business Intelligence & Reports (PDF Exports)
* **Financial Statements**: Granular PDF ledger showing opening/closing cash balances, shortages, automated digital collections (Paytm/IOCL), and individual cash deposits for every custom station account.
* **Financial Reports**: Comprehensive PDF generation providing a full operational breakdown:
  * Revenue and Margins (Gross Profit Calculation)
  * Inventory Variance Profit/Loss (Tank Variance × Product Margin)
  * Price Change Gain/Loss
  * Total Expenditures
  * Final Net Profit/Loss Calculation
* **Traceability**: All generated PDF documents are auto-watermarked with the generating user's identity.

### 7. Automated Maintenance
* **Data Lifespan Task**: A background asynchronous task seamlessly deletes logs older than 2 years to prevent database bloating and optimize index querying speeds.

---

## 🧮 Core Operational Formulas

### 1. Nozzle Metering
$$\text{Gross Liters Sold} = \text{Closing Reading} - \text{Opening Reading}$$
$$\text{Net Liters Sold} = \text{Gross Liters Sold} - \text{Testing Liters}$$

### 2. Wet-Stock Inventory Reconciliation
$$\text{Expected Book Stock} = \text{Yesterday's Closing Physical Stock} + \text{Fuel Received Today} - \sum(\text{Gross Liters Dispensed})$$
$$\text{Variance Profit/Loss} = (\text{Actual Physical Stock} - \text{Expected Book Stock}) \times \text{Product Margin}$$

### 3. Financial Reconciliation
$$\text{Expected Revenue} = \sum(\text{Net Liters Sold} \times \text{Selling Price})$$
$$\text{Overage / Shortage} = \text{Cash Collected} + \text{Digital Payments} + \text{Credit Sales Logged} - \text{Expected Revenue}$$

---

## 🛠️ Technology Stack & Architecture

* **Frontend**: React + TypeScript + Vite + Tailwind CSS v4.
* **Backend**: Python 3.10+ + FastAPI (asynchronous, auto-documented JSON endpoints).
* **Database**: PostgreSQL (relational schemas optimized for transactional write performance) via SQLAlchemy 2.0.
* **PDF Generation**: ReportLab (Python)
* **Testing**: Pytest with in-memory SQLite isolation, integrated into GitHub Actions CI pipeline.

### Repository Layout

```
├── .github/workflows/         # CI/CD Test Pipelines
├── backend/                   # FastAPI Python server application
│   ├── app/                   # Backend routes, database setup & PDF services
│   ├── tests/                 # Unit and Integration test suite
│   └── requirements.txt       # Python package dependencies
├── frontend/                  # React + Vite + Tailwind CSS application
│   ├── src/                   # React components and dashboard views
│   ├── vite.config.ts         # Vite configuration
│   └── package.json           # Node.js dependencies
└── README.md                  # This file
```

---

## 🔌 Running Locally

### Prerequisites
* Python 3.10+
* Node.js v22.12+ (or v24.x LTS)
* PostgreSQL Database (or SQLite for testing)

### 1. Setting up the Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# Configure database and Google Auth settings in .env
uvicorn app.main:app --reload
```

### 2. Testing the Backend
```bash
cd backend
pytest tests/
```

### 3. Setting up the Frontend
```bash
cd frontend
npm install
npm run dev
```

---
*PumpKhata v1.0.0 - Centralized Fuel Station Ledger System*
