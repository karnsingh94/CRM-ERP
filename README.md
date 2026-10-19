# AZZUNIQE CRM & ERP System

An enterprise-grade, multi-tenant CRM & ERP platform designed with a clean unified Next.js frontend and an Express/Prisma backend.

---

## 📌 Project Overview

AZZUNIQE CRM & ERP architecture decouples platform administration from tenant management:
* **Single Unified Frontend**: Runs on `http://localhost:3000` with unified authentication `/login` dynamically routing to role-specific workspaces.
* **Backend API**: Runs on `http://localhost:5000` with Express, Prisma ORM, and MySQL database.
* **Four Supported Roles**:
  1. `SUPER_ADMIN` (Master Admin): Platform catalogues, tenant company provisioning, system audit logs, and security controls.
  2. `COMPANY_ADMIN`: Multi-tenant CRM, Products, Sales, Procurement, Inventory, Production, Dispatch, Accounts, and Team.
  3. `DEPARTMENT_HEAD`: Department-specific pipeline, team roster management, and approval queues.
  4. `EMPLOYEE`: Daily task assignments, attendance/shift punch clock, and station operational jobs.

---

## 🏛️ System Architecture & Folder Structure

```text
AZZUNIQE-CRM-ERP/
│
├── frontend/                    # Single Unified Next.js Application (Port 3000)
│   ├── public/                  # Static assets, SVG icons, images
│   │   ├── images/
│   │   ├── icons/
│   │   └── assets/
│   │
│   ├── src/
│   │   ├── app/                 # All routes and layouts
│   │   │   ├── (auth)/          # Unified auth route group
│   │   │   │   ├── login/
│   │   │   │   ├── forgot-password/
│   │   │   │   └── reset-password/
│   │   │   │
│   │   │   ├── (super-admin)/   # Super Admin / Master Admin routes
│   │   │   │   ├── super-admin/
│   │   │   │   │   ├── dashboard/
│   │   │   │   │   ├── services/
│   │   │   │   │   ├── clients/
│   │   │   │   │   ├── audit-logs/
│   │   │   │   │   └── settings/
│   │   │   │   └── layout.jsx
│   │   │   │
│   │   │   ├── (company-admin)/ # Company Admin business routes
│   │   │   │   ├── company/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── services/
│   │   │   │   ├── crm/
│   │   │   │   ├── products/
│   │   │   │   ├── sales/
│   │   │   │   ├── procurement/
│   │   │   │   ├── inventory/
│   │   │   │   ├── accounts/
│   │   │   │   ├── production/
│   │   │   │   ├── dispatch/
│   │   │   │   ├── gate-pass/
│   │   │   │   ├── grn/
│   │   │   │   ├── bom/
│   │   │   │   ├── vendors/
│   │   │   │   ├── team/
│   │   │   │   ├── returns/
│   │   │   │   ├── settings/
│   │   │   │   └── layout.jsx
│   │   │   │
│   │   │   ├── (department-head)/ # Department Head routes
│   │   │   │   ├── department/
│   │   │   │   │   └── dashboard/
│   │   │   │   └── layout.jsx
│   │   │   │
│   │   │   ├── (employee)/      # Employee self-service routes
│   │   │   │   ├── employee/
│   │   │   │   │   └── dashboard/
│   │   │   │   └── layout.jsx
│   │   │   │
│   │   │   ├── layout.jsx       # Root HTML/Body shell & Context Providers
│   │   │   ├── page.jsx         # Root intelligent session resolver
│   │   │   ├── globals.css      # Design system variables & resets
│   │   │   └── not-found.jsx    # Custom 404 handler
│   │   │
│   │   ├── components/
│   │   │   ├── ui/              # Reusable UI primitives: Button, Input, Select, Modal, Table, Card, Badge, Switch
│   │   │   ├── layout/          # Shared layout components: Sidebar, Topbar, Navbar, DashboardLayout, Breadcrumb
│   │   │   └── shared/
│   │   │
│   │   ├── features/            # Role-specific feature logic and components
│   │   │   ├── super-admin/
│   │   │   ├── company-admin/
│   │   │   ├── department-head/
│   │   │   └── employee/
│   │   │
│   │   ├── context/             # AuthContext, CompanyAuthContext, ThemeContext
│   │   ├── hooks/               # Custom React hooks (useCompanyAuth, useCompanyAccess)
│   │   ├── lib/                 # HTTP client (api-client.js, api.js, auth.js)
│   │   ├── services/            # Frontend API client service abstractions
│   │   ├── utils/               # Formatting and utility helpers
│   │   └── constants/           # Core catalog and route constants
│   │
│   ├── package.json
│   ├── next.config.mjs
│   └── jsconfig.json
│
├── backend/                     # Express API Server (Port 5000)
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── routes/
│   │   ├── middlewares/
│   │   └── server.js
│   ├── prisma/
│   ├── tests/
│   └── package.json
│
├── .gitignore
└── README.md
```

---

## 📦 Fixed 7-Service Catalogue Specification

AZZUNIQE is designed around seven fixed core enterprise services:

| # | Service Name | Main Modules | Feature Scope |
| :-: | :--- | :--- | :--- |
| **1** | **CRM & Sales** | • CRM<br>• Product<br>• Sales | Leads, Customers, Contacts, Quotations, Proforma Invoices (PI), Sales Orders, Price Management |
| **2** | **Purchase & Vendor** | • Vendor<br>• Procurement<br>• GRN | Vendor Master, Purchase Requests, Supplier Quotations, POs, Goods Receipt Notes, Quality Inspection |
| **3** | **Inventory & Warehouse**| • Inventory & Warehouse<br>• Gate Pass | Real-time Stock, Stock Transfers, Bin Locations, Gate Passes, Valuations |
| **4** | **Manufacturing & Production**| • Formula / BOM<br>• Production | Bill of Materials (BOM), Production Batching, Work Orders, Yield Tracking |
| **5** | **Dispatch & Returns** | • Dispatch<br>• Returns | Dispatch Planning, Delivery Challans, Customer & Supplier Returns |
| **6** | **Accounts & Banking** | • Accounts & Banking | Invoicing, Credit/Debit Notes, General Ledger, Chart of Accounts, Bank Reconciliations |
| **7** | **Permission Controls** | • System Control | Role-Based Access Control (RBAC), Global Feature Toggles, Security Profiles |

---

## 🚀 Getting Started & Installation

### Prerequisites
* **Node.js**: v20.x or v22.x
* **npm**: v10.x or higher
* **MySQL**: v8.0 or higher

---

### 1. Backend Setup

```powershell
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Configure environment variables
# Copy .env.example to .env and configure your MySQL database URL:
# DATABASE_URL="mysql://root:your_password@localhost:3306/crm_erp_db"
# PORT=5000
# CLIENT_URL="http://localhost:3000"

# Generate Prisma Client
npm run prisma:generate

# Start Backend Server (runs on http://localhost:5000)
npm run dev
```

---

### 2. Frontend Setup (Unified Application)

```powershell
# Navigate to frontend directory
cd frontend

# Install dependencies (only if needed)
npm install

# Start Next.js Development Server (runs on http://localhost:3000)
npm run dev
```

* Unified Application will be live at: `http://localhost:3000`
* Unified Login: `http://localhost:3000/login`

---

## 📜 Available NPM Scripts

### Frontend (`/frontend`)
| Script | Command | Purpose |
| :--- | :--- | :--- |
| `npm run dev` | `next dev --webpack -p 3000` | Starts Next.js development server at port 3000 |
| `npm run build` | `next build --webpack` | Builds production bundle |
| `npm run start` | `next start -p 3000` | Runs production server at port 3000 |
| `npm run lint` | `next lint` | Runs ESLint validation |

### Backend (`/backend`)
| Script | Command | Purpose |
| :--- | :--- | :--- |
| `npm run dev` | `nodemon src/server.js` | Runs Express server on port 5000 |
| `npm run start` | `node src/server.js` | Runs Express server in production mode |
| `npm run test` | `node tests/integration/suite.test.js` | Runs automated integration tests |
| `npm run prisma:generate` | `prisma generate` | Generates `@prisma/client` bindings |
| `npm run prisma:migrate` | `prisma migrate dev` | Applies database migrations |

---

## 🛡️ License

Proprietary — Developed for **AZZUNIQE CRM & ERP SOFTWARE**.
