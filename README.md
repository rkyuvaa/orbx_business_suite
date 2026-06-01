# ORBX Business Suite — Enterprise Resource Planning (ERP) System

A modern, production-ready, multi-branch ERP system designed with high-end aesthetic details (Deep Forest Green theme, glassmorphic touches) and high-fidelity accounting engines.

---

## 🚀 Tech Stack

- **Frontend**: React 18, Material UI v5, Redux Toolkit, Axios, Recharts (BI charts), React Hook Form + Yup (Validation).
- **Backend**: FastAPI, SQLAlchemy 2.0 (Async ORM), Alembic (Migrations), Passlib + Bcrypt (Hashing), Python-Jose (JWT session keys).
- **Database**: PostgreSQL 15.
- **Infrastructure**: Nginx (Reverse proxy load routing), Docker, Docker Compose.

---

## 📂 Project Structure

```
erp/
├── docker-compose.yml       # Docker container orchestrations
├── .env.example             # Template for security environment keys
├── init.sh                  # Runs migrations and database seeds inside backend
├── nginx/
│   └── nginx.conf           # Reverse proxy routing (/api -> backend, / -> frontend)
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt     # Python backend dependencies
│   ├── alembic.ini          # Migrations config
│   ├── alembic/             # Alembic versions & environment mappings
│   └── app/
│       ├── main.py          # Fast API boot entry
│       ├── core/            # Config settings, JWT securities, Dependency injection
│       ├── db/              # Async sessions, Base Declaratives, database seeder script
│       ├── models/          # Relational database models (SQLAlchemy 2.0 mapped)
│       ├── schemas/         # Pydantic v2 schemas
│       ├── services/        # Business logic operations per module
│       └── api/             # RESTful API modules & routes aggregator
└── frontend/
    ├── Dockerfile
    ├── nginx.conf           # SPA router fallback configurations
    ├── package.json
    ├── public/
    └── src/
        ├── App.js
        ├── index.js
        ├── api/             # Axios client setups with JWT intercepts and rotation
        ├── app/             # Redux store & Auth / branch slices
        ├── components/      # Common sortable datatables, sleek modals, Form inputs
        ├── layouts/         # Centered AuthLayout and AppLayout (sidebar contextual menus)
        ├── routes/          # Navigation guards & protected gates
        ├── theme/           # Customized Deep Green premium theme palette
        └── pages/           # Pages per module (Masters, Transactions, Analytics, Admin)
```

---

## 🛠️ Step-by-Step Installation & Booting

### 1. Prerequisites
Ensure you have **Docker** and **Docker Compose** installed on your operating system (Windows, macOS, or Linux).

### 2. Configure Environment Secrets
Copy `.env.example` into a new `.env` file in the root directory:
```bash
cp .env.example .env
```
*(Optionally modify usernames, passwords, or generate a fresh 32-byte hex JWT SECRET_KEY using `openssl rand -hex 32`)*.

### 3. Spin Up Docker Containers
Build and run the ERP ecosystem in detached background mode:
```bash
docker-compose up --build -d
```
Docker will pull down PostgreSQL, configure the FastAPI backend container, compile the React SPA static bundles inside Node.js, and route incoming traffic using Nginx.

### 4. Apply Schema Migrations & Seeding
Execute the automatic seeder script inside the active backend container to write relational tables and populate initial matrices:
```bash
docker-compose exec backend bash init.sh
```

---

## 🔑 Initial Credentials

Log in using the seeded superuser account:
- **Email/Username**: `admin@orbx.com`
- **Password**: `AdminPassword123`

---

## 🌟 Highlight Features

1. **Odoo-Style Home Grid**: Full-screen tile grids mapped into Master data, Transaction logs, Analytics reports, and Setup controls, featuring responsive lifts and hover scales.
2. **Contextual Sub-Navigation Sidebar**: Modals or inner modules load responsive, dedicated sidebar folders mapping specific workflows (e.g. Purchase -> GRN -> Bills).
3. **Multi-Branch Context Switching**: Toggle branches inside the top navigation bar. Transactions remain isolated by `branch_id` in databases.
4. **Dynamic Permission Matrix**: Configure role permission matrices (Masters, Transactions, Admin, Reports × View, Create, Edit, Delete) using dynamic checkboxes.
5. **State-Level CGST+SGST/IGST Calculator**: Compares company GSTIN state codes with customer GSTIN codes to dynamically split CGST/SGST or route to IGST.
6. **Live Inventory Ledger**: Auto-calculates stock intakes on GRNs, inventory reductions on Sales deliveries, and manages manual stock adjustments with variance history tracking.
7. **Print-Ready CSS Tax Invoices**: Full CSS print media wraps hiding sidebar menus and top headers to print clean documents.
