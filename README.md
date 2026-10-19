# AZZUNIQE CRM & ERP System

An enterprise-grade, multi-tenant CRM & ERP management platform designed with a multi-tier permission architecture: **Service ➔ Main Module ➔ Sub-Module**.

---

## 📌 Project Overview

AZZUNIQE CRM & ERP decouples platform administration from tenant management:
* **Super Admin (Platform Owner)**: Manages global Service catalogues, Main Modules, Sub-Module feature screens, and provisions distinct tenant companies.
* **Company / Client Admin (Tenant)**: Manages day-to-day CRM and ERP operations (leads, quotations, inventory, invoicing, production) based strictly on permissions granted by Super Admin.
* **Dynamic Permission Engine**: Granular access control allowing Full Service, Full Module, or Custom Sub-Module feature screen assignment per tenant.

---

## 🏛️ System Architecture

```text
CRM & ERP/
├── .gitignore
├── README.md                               <-- Root Documentation
│
├── backend/                                <-- Node.js + Express + MySQL + Prisma
│   ├── .env                                <-- Server & Database Environment Variables
│   ├── .env.example                        <-- Environment Template
│   ├── package.json                        <-- Scripts & Dependencies
│   ├── prisma/
│   │   └── schema.prisma                   <-- Prisma MySQL Models & Relations
│   └── src/
│       ├── config/
│       │   └── prisma.js                   <-- PrismaClient Singleton
│       ├── routes/
│       │   └── api.routes.js               <-- REST API Endpoints
│       ├── services/
│       │   └── catalog.service.js          <-- Catalogue Store & Persistence Layer
│       └── server.js                       <-- Express Server Entrypoint
│
└── frontend/                               <-- Unified Next.js application (Port 3000)
    ├── public/                             <-- Static images, icons, and assets
    ├── package.json                        <-- Scripts & dependencies
    └── src/
        ├── app/                            <-- App Router pages and role route groups
        │   ├── (auth)/                     <-- Login and password recovery
        │   ├── (super-admin)/              <-- /super-admin routes
        │   ├── (company-admin)/            <-- Company CRM/ERP routes
        │   ├── (department-head)/          <-- Department routes
        │   └── (employee)/                 <-- Employee routes
        ├── components/                     <-- Portals, layouts, modules, and UI
        ├── config/                         <-- Route metadata
        ├── constants/                      <-- Core 7-Service catalogue
        ├── context/                        <-- Authentication and theme providers
        ├── hooks/                          <-- Company authentication and access
        └── lib/                            <-- API and authentication helpers
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

## 🛠️ Technology Stack

### Backend
* **Runtime**: Node.js (ES Modules, `"type": "module"`)
* **Framework**: Express.js
* **Database**: MySQL
* **ORM**: Prisma ORM (v6.4.1)
* **Utilities**: `dotenv`, `cors`, `nodemon`

### Frontend (`frontend`)
* **Framework**: Next.js 16 (App Router)
* **Syntax**: Pure JavaScript / JSX (No TSX)
* **Engine**: Webpack (`--webpack` mode for cross-platform reliability)
* **Styling**: Vanilla CSS Modules with custom CSS variables
* **Design System**:
  * Light theme background (`#f8fafc` & `#ffffff`)
  * Deep enterprise navy blue sidebar (`#0f172a` / `#1e293b`)
  * High-contrast black/slate typography (`#0f172a`)
  * Interactive Red / Green state toggles with animated toast alerts
  * Live Client Panel Simulator modal

---

## 🚀 Getting Started & Installation

### Prerequisites
* **Node.js**: v20.x or v22.x
* **npm**: v10.x or higher
* **MySQL**: v8.0 or higher (optional for resilient mode)

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

# Run Database Migrations (requires active MySQL instance)
npm run prisma:migrate

# Start Backend Server (development mode with nodemon)
npm run dev
```

* Backend API will run at: `http://localhost:5000`
* Health Check: `http://localhost:5000/api/health`
* DB Status: `http://localhost:5000/api/db-status`

---

### 2. Frontend Setup

```powershell
# Navigate to the unified frontend directory
cd frontend

# Install dependencies
npm install

# Configure environment variables
# Verify NEXT_PUBLIC_API_URL=http://localhost:5000/api in .env

# Start Next.js Development Server
npm run dev
```

* Super Admin Portal will be available at: `http://localhost:3000`

---

## 🔑 Key Features Implemented

1. **Super Admin Dashboard**:
   * Real-time metrics counters for Services, Main Modules, Sub-Modules, and provisioned Client Panels.
   * Live status monitoring chips for Backend API and MySQL Prisma connectivity.
   * Recent provisioned companies and platform audit activity feed.

2. **Services Catalogue Management (All-on-One-Page)**:
   * View all active and inactive services with module counts and display ordering.
   * Instant status toggling (Active 🟢 / Inactive 🔴) with animated Toast notifications.
   * Modal to create new global services.

3. **Single Service Detail View**:
   * Inspect any service's hierarchical structure.
   * Main Module accordion cards with nested Sub-Module (Screen/Route) tags.
   * Inline actions to add Main Modules and Sub-Modules directly.

4. **Company / Client Admin Provisioning**:
   * Add new tenant companies with company name, admin name, email, mobile, and password.
   * **Hierarchical Permission Tree**:
     * `[x] Full Service`: Grants all modules and sub-modules under that service.
     * `[FULL MODULE]`: Grants all sub-modules under that specific module.
     * `[CUSTOM]`: Select individual sub-modules with "Select All" shortcut.
   * Instant Active/Inactive toggle switch with feedback toasts.
   * Delete company panels with confirmation.

5. **Live Client Panel Simulator**:
   * Click **"👁️ Live Preview"** on any client row to open a dynamic simulation modal.
   * Renders the client's perspective: only displays services, modules, and screens permitted by Super Admin.
   * Live demonstration of permission-driven multi-tenant architecture.

6. **Audit Trail**:
   * Automatic event tracking for Service, Module, Client, and Permission changes with timestamps and actor details.

---

## 📜 Available NPM Scripts

### Backend (`/backend`)
| Script | Command | Purpose |
| :--- | :--- | :--- |
| `npm run dev` | `nodemon src/server.js` | Runs Express server with live reload |
| `npm run start` | `node src/server.js` | Runs Express server in production mode |
| `npm run prisma:generate` | `prisma generate` | Generates `@prisma/client` bindings |
| `npm run prisma:migrate` | `prisma migrate dev` | Applies database migrations to MySQL |
| `npm run prisma:studio` | `prisma studio` | Opens Prisma GUI browser at port 5555 |

### Frontend (`/frontend`)
| Script | Command | Purpose |
| :--- | :--- | :--- |
| `npm run dev` | `next dev --webpack -p 3000` | Starts the unified Next.js development server |
| `npm run build` | `next build --webpack` | Builds the production bundle |
| `npm run start` | `next start -p 3000` | Runs the production server |
| `npm run lint` | `eslint src` | Runs ESLint validation |

---

## 🛡️ License

Proprietary — Developed for **AZZUNIQE CRM & ERP SOFTWARE**.
