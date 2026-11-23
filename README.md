# Pharmaceutical Management System

College Mini-Project: **Pharmaceutical Management System** multi-database backend built with **Node.js**, **Express**, and **MongoDB Atlas** (using **Mongoose 8**).

Strictly derived from the two authoritative Chen Notation ER Diagrams:
- **Page 1: Pharmacy System**
- **Page 2: Warehouse and Distribution System**

---

## Architecture Overview

- **Central Warehouse System (`warehouse`):** 22 collections managing suppliers, purchase orders, goods receipts, supplier returns, batches, warehouse stock, storage locations, stock adjustments, audit logs, pharmacies, supply requests, stock transfers, pharmacy returns, invoices, and payments.
- **Pharmacy System (`pharmacy`):** 16 collections managing customers, sales, sale items, payments, sales returns, medicines, batches, pharmacy stock, stock adjustments, alerts, supply requests, and stock receipts.
- **Loose Coupling:** Warehouse transfer IDs are stored as external references in pharmacy databases, with interaction occurring through RESTful backend APIs and the Inter-Service Bridge.
- **FEFO Priority:** Dispatches prioritize earlier expiring medication batches first and prevent expired medicine dispatch.
- **Strict Non-Negative Inventory:** Real-time stock checks prevent over-selling and negative inventory.

---

## Directory Structure

```text
D:\Pharmaceutical management/
├── backend/                  # Complete backend service
│   ├── src/                  # Source code (models, routes, controllers, services, config)
│   ├── tests/                # Automated tests (24/24 integration tests)
│   ├── docs/                 # Full API Documentation & Postman Collection
│   │   ├── API_DOCUMENTATION.md
│   │   └── Pharmaceutical_Management_System.postman_collection.json
│   ├── .env                  # MongoDB Atlas credentials (git-ignored)
│   ├── .env.example          # Template environment file
│   ├── package.json          # Backend dependencies & npm scripts
│   └── README.md             # Detailed backend guide
└── README.md                 # Project root overview
```

---

## Quick Start (Windows PowerShell)

Open PowerShell and navigate to the `backend` folder:

```powershell
cd "D:\Pharmaceutical management\backend"
```

1. **Verify Database Connections:**
   ```powershell
   npm.cmd run test-db
   ```

2. **Run Automated Test Suite (All 24 Tests):**
   ```powershell
   npm.cmd run test:all
   ```

3. **Start the Server:**
   ```powershell
   npm.cmd start
   ```

4. **Health Check:**
   `http://localhost:5000/api/health`

5. **API Documentation & Postman:**
   - Documentation: [`backend/docs/API_DOCUMENTATION.md`](backend/docs/API_DOCUMENTATION.md)
   - Postman Collection: [`backend/docs/Pharmaceutical_Management_System.postman_collection.json`](backend/docs/Pharmaceutical_Management_System.postman_collection.json)
