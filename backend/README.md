# Pharmaceutical Management System — Multi-Database Backend

A modular, production-grade backend for the **Pharmaceutical Management System** college mini-project built with **Node.js**, **Express**, and **MongoDB Atlas** (using **Mongoose 8**).

This backend implements a **multi-database architecture** strictly derived from the two Chen ER diagrams:
1. **Central Warehouse Database (`warehouse`):** 22 collections (Suppliers, POs, Goods Receipts, Supplier Returns, Batches, Stock, Storage Locations, Adjustments, Audits, Invoices, Payments, Transfers, Transfer Items, Pharmacy Returns, Pharmacies, Supply Requests, Request Items, Roles, Users).
2. **Pharmacy Branch Database (`pharmacy`):** 16 collections (Customers, Sales, Sale Items, Payments, Sales Returns, Medicines, Batches, Stock, Adjustments, Alerts, Supply Requests, Request Items, Stock Receipts, Receipt Items, Roles, Users).

---

## Key Features & Business Logic

- **Multi-Database Tenancy**: Central Warehouse operates on `warehouse` while branch pharmacies operate on isolated databases (`pharmacy`, or partitioned per branch via `x-pharmacy-id` header).
- **Loose Coupling**: Warehouse transfer IDs (`transfer_id`) are stored as external references in pharmacy databases, avoiding direct cross-database foreign keys.
- **FEFO (First-Expiry, First-Out) Allocation**: Dispatch automatically prioritizes unexpired batches with earlier expiry dates.
- **Strict Inventory Protection**: Rejects negative stock, prevents dispensing expired/quarantined medication, and updates pharmacy stock only upon verified receipt.
- **Idempotent Inward Receipts**: Enforces unique `transfer_id` constraint to prevent duplicate inventory updates.
- **Inter-Service Bridge**: Programmatic and API-driven synchronization for supply request transmission, dispatch alerts, and live manifest lookups.
- **Role-Based Access Control (RBAC)**: JWT authentication with bcrypt password hashing and granular role authorization (`WAREHOUSE_ADMIN`, `INVENTORY_MANAGER`, `DISPATCH_OPERATOR`, `AUDITOR`, `PHARMACY_ADMIN`, `PHARMACIST`, `CASHIER`).
- **Audit Logging**: Full audit trail for warehouse dispatches, stock adjustments, and goods receipts.

---

## Directory Structure

```text
backend/
├── src/
│   ├── app.js                          # Express app configuration & middlewares
│   ├── server.js                       # Server entry point & DB lifecycle
│   │
│   ├── config/
│   │   ├── env.js                      # Environment variables loader & validator
│   │   ├── warehouseDatabase.js        # Dedicated connection to Central Warehouse DB
│   │   ├── pharmacyDatabase.js         # Multi-tenant connection pool for Pharmacy DBs
│   │   └── database.js                 # Master database coordinator & test runner
│   │
│   ├── models/
│   │   ├── commonSchema.js             # Shared schema options, Decimal128 currency helper, bcrypt methods
│   │   ├── warehouse/                  # 22 Mongoose Models (Warehouse & Distribution System)
│   │   └── pharmacy/                   # 16 Mongoose Models (Pharmacy System)
│   │
│   ├── controllers/
│   │   ├── warehouse/                  # Warehouse domain controllers
│   │   └── pharmacy/                   # Pharmacy domain controllers
│   │
│   ├── routes/
│   │   ├── index.js                    # Base router & /api/health check
│   │   ├── warehouse/                  # Warehouse REST routes (/api/warehouse/*)
│   │   └── pharmacy/                   # Pharmacy REST routes (/api/pharmacy/*)
│   │
│   ├── services/
│   │   ├── interServiceBridge.js       # Cross-system communication bridge
│   │   ├── warehouse/                  # Warehouse business logic services
│   │   └── pharmacy/                   # Pharmacy business logic services
│   │
│   ├── middleware/
│   │   ├── authMiddleware.js           # JWT verification & multi-tenant context
│   │   ├── roleMiddleware.js           # RBAC permissions
│   │   ├── errorMiddleware.js          # Centralized error handler
│   │   └── validationMiddleware.js     # Input validation runner
│   │
│   ├── validators/
│   │   ├── warehouse/
│   │   └── pharmacy/
│   │
│   ├── utils/
│   │   ├── ApiError.js
│   │   ├── ApiResponse.js
│   │   ├── generateToken.js
│   │   └── constants.js
│   │
│   └── scripts/
│       ├── createIndexes.js            # Initializer for all 38 collections & indexes
│       └── seedData.js                 # Realistic seed data script
│
├── tests/
│   ├── testAuthAndCrud.js              # Auth & CRUD test suite (6/6 tests)
│   ├── testInventoryAndTransfer.js     # Inventory, FEFO & Transfer test suite (10/10 tests)
│   └── testInterCommunication.js       # Inter-service bridge test suite (8/8 tests)
│
├── docs/
│   ├── API_DOCUMENTATION.md            # Comprehensive API specs, schemas & viva guide
│   └── Pharmaceutical_Management_System.postman_collection.json # Exportable Postman collection
│
├── .env                                # Local Atlas URI & credentials (git-ignored)
├── .env.example                        # Template environment variables
├── package.json                        # Backend dependencies & npm scripts
└── README.md
```

---

## Default Login Credentials

| System | Role | Username | Password |
| :--- | :--- | :--- | :--- |
| **Warehouse** | `WAREHOUSE_ADMIN` | `admin` | `Password@123` |
| **Pharmacy** | `PHARMACY_ADMIN` | `pharmadmin` | `Password@123` |

---

## Quick Start Commands (Windows PowerShell)

Open PowerShell and navigate to `backend/`:

```powershell
cd "D:\Pharmaceutical management\backend"
```

### 1. Test Database Connections
```powershell
npm.cmd run test-db
```

### 2. Initialize Collections & Indexes (All 38 Collections)
```powershell
npm.cmd run init-db
```

### 3. Seed Realistic Master Data & Admin Users
```powershell
npm.cmd run seed
```

### 4. Run Automated Test Suites (All 235 Tests across 8 Suites)
```powershell
# Run the complete test suite (Baseline + All Engines E1-E4 + Final Verification)
npm.cmd run test:full

# Or run individual engine suites
npm.cmd run test:e1             # Engine E1: Warehouse Inventory & Append-Only Ledger (49/49 passed)
npm.cmd run test:e2             # Engine E2: Pharmacy Order State Machine & Discrepancy (46/46 passed)
npm.cmd run test:e3             # Engine E3: Batch Management & Min-Heap FEFO Priority Queue (50/50 passed)
npm.cmd run test:e4             # Engine E4: Concurrent Transactions, Idempotency & Error Quality (33/33 passed)
npm.cmd run test:verification   # Final E1-E4 Comprehensive Verification Suite (33/33 passed)

# Or run baseline integration suites
npm.cmd run test:auth           # Auth & Multi-Tenant CRUD (6/6 passed)
npm.cmd run test:inventory      # Inventory & Basic Transfers (10/10 passed)
npm.cmd run test:bridge         # Warehouse-to-Pharmacy Bridge (8/8 passed)
```

### 5. Start the Server
```powershell
# Production mode
npm.cmd start

# Development mode with live reload
npm.cmd run dev
```

Server runs at `http://localhost:5000`. Health check: `GET http://localhost:5000/api/health`.

---

## Postman API Testing

1. Open Postman -> Click **Import**.
2. Select `backend/docs/Pharmaceutical_Management_System.postman_collection.json`.
3. The collection is organized into 11 logical folders with automated JWT token capture:
   - `0. System Health`
   - `1. Warehouse - Auth & Users`
   - `2. Warehouse - Master Data (Suppliers, Medicines, Locations, Pharmacies)`
   - `3. Warehouse - Procurement (PO & Goods Receipts)`
   - `4. Warehouse - Inventory & FEFO`
   - `5. Warehouse - Dispatches & Transfers`
   - `6. Warehouse - Invoices, Payments & Returns`
   - `7. Pharmacy - Auth & Customers`
   - `8. Pharmacy - Supply Requests & Inward Receipts`
   - `9. Pharmacy - Point of Sale (POS) & Returns`
   - `10. Pharmacy - Adjustments & Alerts`

Refer to [`docs/API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md) for full request/response schemas and evaluation procedures.
