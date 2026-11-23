# Pharmaceutical Management System — Backend API Documentation

**Project Type:** College Mini-Project  
**Authoritative Reference:** Chen Notation ER Diagrams (Page 1: Pharmacy System, Page 2: Warehouse and Distribution System)  
**Technology Stack:** Node.js, Express.js, MongoDB Atlas (Mongoose 8), JWT Authentication, bcryptjs  
**Postman Collection:** `docs/Pharmaceutical_Management_System.postman_collection.json`  

---

## 1. System Architecture Overview

The backend is built around a **loosely coupled, multi-database architecture**:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        CENTRAL WAREHOUSE SYSTEM                        │
│  Database: "warehouse" (MongoDB Atlas)                                 │
│  - 22 Mongoose Models & Collections                                    │
│  - Manages Suppliers, Procurement (PO & Goods Receipts), Batches,     │
│    Warehouse Stock (FEFO Priority), Storage Locations,                 │
│    Stock Transfers, Invoices, Payments, Supplier/Pharmacy Returns,     │
│    Roles, Users, and Audit Logs.                                       │
└───────────────────▲────────────────────────────────┬───────────────────┘
                    │                                │
      1. Transmit   │                                │ 2. Dispatch Manifest
      Supply Request│                                │    & Alerts
                    │                                │
┌───────────────────┴────────────────────────────────▼───────────────────┐
│                      BRANCH PHARMACY SYSTEM(S)                         │
│  Database: "pharmacy" (or "pharmacy_<branch_id>")                      │
│  - 16 Mongoose Models & Collections                                    │
│  - Manages Customers, Local Medicine Catalog, Batches, Shelf Inventory,│
│    Point-of-Sale (POS Checkout), Payments, Sales Returns,              │
│    Supply Requests, Inward Stock Receipts, Stock Adjustments,          │
│    Alerts (Low Stock, Expiry, In-Transit), Roles, and Users.           │
└────────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Tenets
1. **Database Isolation**: The Warehouse system runs against a dedicated MongoDB database (`warehouse`). Each Pharmacy branch runs on its own database (`pharmacy` or partitioned by branch name).
2. **External Transfer Reference**: Warehouse transfer IDs (`transfer_id`, e.g., `TRF-COMM-001`) are stored as **external reference strings** in the pharmacy database (`StockReceipt.transfer_id`), preventing hard cross-database foreign key constraints while maintaining data integrity.
3. **FEFO (First-Expiry, First-Out) Priority**: Batches are strictly ordered by ascending `expiry_date` so that medications expiring first are dispatched first. Expired medicines cannot be allocated or dispensed.
4. **Non-Negative Stock Rule**: Deductions reject requests exceeding available physical stock (`quantity_on_hand`).
5. **Idempotent Inward Receipts**: `StockReceipt` enforces uniqueness on `transfer_id`, preventing duplicate inventory updates from the same warehouse transfer.
6. **Pharmacy Stock Confirmation**: Stock is only credited to branch pharmacy inventory **after** physical goods receipt confirmation (`POST /api/pharmacy/receipts`).

---

## 2. Authentication & Multi-Tenancy Headers

All secure endpoints require a Bearer JWT token in the `Authorization` header:

```http
Authorization: Bearer <JWT_TOKEN>
```

For Pharmacy requests, branch targeting is controlled via the `x-pharmacy-id` header (defaults to `pharmacy` if omitted):

```http
x-pharmacy-id: pharmacy
```

### Default Seed Credentials

| System | Role | Username | Password |
| :--- | :--- | :--- | :--- |
| **Warehouse** | `WAREHOUSE_ADMIN` | `admin` | `Password@123` |
| **Pharmacy** | `PHARMACY_ADMIN` | `pharmadmin` | `Password@123` |

---

## 3. Warehouse API Endpoints

Base URL: `http://localhost:5000/api/warehouse`

### 3.1 Authentication & Profile
- `POST /api/warehouse/auth/login`: Authenticate warehouse staff & receive JWT.
- `GET /api/warehouse/auth/me`: Retrieve currently authenticated warehouse profile.

### 3.2 Roles & Users
- `GET /api/warehouse/roles`: List all warehouse roles (`WAREHOUSE_ADMIN`, `INVENTORY_MANAGER`, `DISPATCH_OPERATOR`, `AUDITOR`).
- `GET /api/warehouse/users`: List all warehouse staff members.
- `POST /api/warehouse/users`: Register a new warehouse user.

### 3.3 Suppliers Master Data
- `GET /api/warehouse/suppliers`: List all approved pharmaceutical suppliers.
- `POST /api/warehouse/suppliers`: Register a new supplier.
- `GET /api/warehouse/suppliers/:id`: Get supplier details by ID or Code.

### 3.4 Medicines Catalog
- `GET /api/warehouse/medicines`: List all medicines in the central formulary.
- `POST /api/warehouse/medicines`: Register a new medicine.
- `GET /api/warehouse/medicines/:id`: Get medicine details.

### 3.5 Storage Locations & Pharmacies Registry
- `GET /api/warehouse/locations`: List warehouse racks/bins (e.g. Zone A, Cold Room).
- `POST /api/warehouse/locations`: Register a new storage bin.
- `GET /api/warehouse/pharmacies`: List branch pharmacies registered in central distribution.
- `POST /api/warehouse/pharmacies`: Register a new branch pharmacy.

### 3.6 Procurement: Purchase Orders (PO)
- `POST /api/warehouse/purchase-orders`: Create a purchase order to a supplier.
- `GET /api/warehouse/purchase-orders`: List purchase orders (filterable by supplier & status).
- `GET /api/warehouse/purchase-orders/:id`: Get purchase order with line items.
- `PUT /api/warehouse/purchase-orders/:id/status`: Update PO status (`SUBMITTED`, `APPROVED`, `CANCELLED`).

### 3.7 Procurement: Goods Receipts (GR & Batch Inwards)
- `POST /api/warehouse/goods-receipts`: Receive physical shipment against a PO. Creates new `Batch` records and increments `WarehouseStock`.
- `GET /api/warehouse/goods-receipts`: List goods receipts.
- `GET /api/warehouse/goods-receipts/:id`: Get goods receipt with received line items.

### 3.8 Inventory Management & FEFO Queries
- `GET /api/warehouse/stocks`: View live warehouse inventory levels across all batches.
- `GET /api/warehouse/stocks/fefo/:medicineCode`: Query available unexpired batches sorted in strict **FEFO** order (earliest expiry first).
- `POST /api/warehouse/adjustments`: Record manual stock adjustments (damage, shrinkage, cycle count) with audit tracking.

### 3.9 Dispatches & Transfers
- `GET /api/warehouse/supply-requests`: View supply requests queued by branch pharmacies.
- `POST /api/warehouse/transfers`: Create a stock transfer with automated FEFO batch allocation.
- `PUT /api/warehouse/transfers/:id/dispatch`: Dispatch transfer: deducts warehouse stock, sets status to `DISPATCHED`, and auto-generates `Invoice`.
- `POST /api/warehouse/transfers/:id/notify`: Broadcast dispatch alert directly to target branch pharmacy database.

### 3.10 Invoices, Payments & Returns
- `GET /api/warehouse/invoices`: List dispatch invoices (filter by pharmacy, status).
- `GET /api/warehouse/invoices/:id`: Get invoice details and line items.
- `POST /api/warehouse/payments`: Record payment against an invoice (updates status to `PARTIALLY_PAID` or `PAID`).
- `POST /api/warehouse/returns/supplier`: Return defective/damaged goods to a supplier.
- `POST /api/warehouse/returns/pharmacy`: Accept returned stock from a branch pharmacy.
- `GET /api/warehouse/audit-logs`: Audit trail for all warehouse actions.

---

## 4. Pharmacy API Endpoints

Base URL: `http://localhost:5000/api/pharmacy`

### 4.1 Authentication & Profile
- `POST /api/pharmacy/auth/login`: Authenticate pharmacy staff & receive JWT.
- `GET /api/pharmacy/auth/me`: Retrieve current pharmacy user profile.

### 4.2 Customers Master Data
- `GET /api/pharmacy/customers`: Search and list registered customers.
- `POST /api/pharmacy/customers`: Register a new customer.
- `GET /api/pharmacy/customers/:id`: Get customer by ID or phone number.

### 4.3 Medicines & Shelf Inventory
- `GET /api/pharmacy/medicines`: List local pharmacy medicines.
- `POST /api/pharmacy/medicines`: Add medicine to branch formulary.
- `POST /api/pharmacy/adjustments`: Record shelf stock adjustment (damage, expired, breakages).

### 4.4 Replenishment: Supply Requests
- `GET /api/pharmacy/supply-requests`: List branch replenishment orders.
- `POST /api/pharmacy/supply-requests`: Submit new replenishment request.
- `POST /api/pharmacy/supply-requests/:id/transmit`: Transmit supply request directly into Central Warehouse distribution queue.

### 4.5 Inward Receipts (Inter-Service Bridge)
- `GET /api/pharmacy/receipts/warehouse-transfer/:transferId`: Query dispatch manifest directly from Central Warehouse using external `transfer_id`.
- `POST /api/pharmacy/receipts`: Confirm physical receipt of shipment and credit pharmacy inventory. Rejects duplicate submissions (`409 Conflict`).
- `GET /api/pharmacy/receipts`: List inward receipt history.

### 4.6 Point-of-Sale (POS) & Billing
- `POST /api/pharmacy/sales`: Checkout transaction. Deducts stock from specified batches. Validates against expired medications and prevents negative inventory.
- `GET /api/pharmacy/sales`: List sales history.
- `GET /api/pharmacy/sales/:id`: Get sale invoice with itemized breakdown.

### 4.7 Sales Returns & Refunds
- `POST /api/pharmacy/returns`: Process customer medicine return. Optionally restocks unexpired, sealed items to inventory and records refund.

### 4.8 Branch Alerts
- `GET /api/pharmacy/alerts`: Retrieve alerts (`LOW_STOCK`, `EXPIRING_SOON`, `STOCK_IN_TRANSIT`).
- `PUT /api/pharmacy/alerts/:id/resolve`: Mark alert as resolved.

---

## 5. Sample Requests and Responses

### 5.1 Warehouse Login

**Request:**
```http
POST /api/warehouse/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "Password@123"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "6ae89d1b452834b693e50664",
      "user_id": "WH-USR-001",
      "name": "Warehouse Administrator",
      "username": "admin",
      "email": "admin@warehouse.com",
      "role": {
        "id": "6ae89d1b452834b693e5065c",
        "role_id": "ROLE-WH-ADMIN",
        "role_name": "WAREHOUSE_ADMIN"
      }
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 5.2 Warehouse FEFO Batch Query

**Request:**
```http
GET /api/warehouse/stocks/fefo/MED-PCM-500
Authorization: Bearer <whToken>
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "FEFO batches retrieved successfully",
  "data": {
    "medicine": {
      "medicine_id": "MED-PCM-500",
      "name": "Paracetamol 500mg"
    },
    "fefoBatches": [
      {
        "batch_id": "6ae8b1b443245aa41aa1cd21",
        "batch_number": "BAT-PCM-2027-3444",
        "manufacturing_date": "2025-06-01T00:00:00.000Z",
        "expiry_date": "2027-06-30T00:00:00.000Z",
        "quantity_on_hand": 1750,
        "quantity_reserved": 0,
        "available_quantity": 1750,
        "location": "LOC-ZA-R01-B01"
      },
      {
        "batch_id": "6ae8b1b443245aa41aa1cd18",
        "batch_number": "BAT-PCM-2028-3444",
        "manufacturing_date": "2026-01-01T00:00:00.000Z",
        "expiry_date": "2028-12-31T00:00:00.000Z",
        "quantity_on_hand": 3000,
        "quantity_reserved": 0,
        "available_quantity": 3000,
        "location": "LOC-ZA-R01-B01"
      }
    ]
  }
}
```

---

### 5.3 Pharmacy Transmit Supply Request to Central Warehouse

**Request:**
```http
POST /api/pharmacy/supply-requests/6ae8b30935b16876b6599250/transmit
Authorization: Bearer <phToken>
x-pharmacy-id: pharmacy
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Supply request successfully transmitted to Central Warehouse",
  "data": {
    "pharmacyRequestId": "REQ-COMM-0909",
    "warehouseRequestId": "REQ-COMM-0909",
    "warehousePharmacyId": "PHARM-IND-01",
    "pharmacyName": "Apollo Care Pharmacy - Indiranagar",
    "status": "PENDING",
    "itemsCount": 1,
    "transmittedAt": "2026-11-02T15:58:02.124Z"
  }
}
```

---

### 5.4 Pharmacy Lookup Warehouse Transfer Manifest

**Request:**
```http
GET /api/pharmacy/receipts/warehouse-transfer/TRF-COMM-0909
Authorization: Bearer <phToken>
x-pharmacy-id: pharmacy
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Warehouse transfer manifest retrieved successfully",
  "data": {
    "transfer_id": "TRF-COMM-0909",
    "status": "DISPATCHED",
    "dispatch_date": "2026-11-02T15:58:02.980Z",
    "pharmacy_id": "PHARM-IND-01",
    "pharmacy_name": "Apollo Care Pharmacy - Indiranagar",
    "shipping_reference": "N/A",
    "item_count": 1,
    "items": [
      {
        "transfer_item_id": "TRI-TRF-COMM-0909-01",
        "batch_number": "BAT-PCM-2027-3444",
        "medicine_id": "MED-PCM-500",
        "medicine_name": "Paracetamol",
        "dosage": "500mg",
        "formulation": "Tablet",
        "manufacturing_date": "2025-06-01T00:00:00.000Z",
        "expiry_date": "2027-06-30T00:00:00.000Z",
        "quantity_dispatched": 250,
        "unit_cost": "15.00"
      }
    ]
  }
}
```

---

### 5.5 Pharmacy Point-of-Sale (POS) Checkout

**Request:**
```http
POST /api/pharmacy/sales
Authorization: Bearer <phToken>
x-pharmacy-id: pharmacy
Content-Type: application/json

{
  "customer": "CUST-001",
  "payment_method": "UPI",
  "discount_amount": 0,
  "items": [
    {
      "batch": "BAT-PCM-2027-3444",
      "quantity": 10,
      "unit_price": 17.50
    }
  ]
}
```

**Success Response (201 Created):**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Sale transaction completed successfully",
  "data": {
    "sale": {
      "sale_id": "SALE-881290",
      "customer": "6ae8a0c2834b693e50692",
      "sale_date": "2026-11-02T16:05:00.000Z",
      "total_amount": "175.00",
      "discount_amount": "0.00",
      "status": "COMPLETED",
      "_id": "6ae8b501d1654d255a09f301"
    },
    "payment": {
      "payment_id": "PAY-881290",
      "amount": "175.00",
      "method": "UPI",
      "payment_date": "2026-11-02T16:05:00.000Z"
    },
    "items": [
      {
        "sale_item_id": "SLI-SALE-881290-01",
        "batch": "6ae8b30b35b16876b6599298",
        "quantity": 10,
        "unit_price": "17.50",
        "total_price": "175.00"
      }
    ]
  }
}
```

**Negative Inventory Rejection Response (400 Bad Request):**
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Insufficient stock for batch BAT-PCM-2027-3444. Available: 240, requested: 99999"
}
```

**Duplicate Receipt Rejection Response (409 Conflict):**
```json
{
  "success": false,
  "statusCode": 409,
  "message": "Stock receipt for warehouse transfer 'TRF-COMM-0909' has already been processed."
}
```

---

## 6. College Project Evaluation Guide

To demonstrate and test this system during viva or practical evaluation:

1. **Start the Backend Server**:
   ```powershell
   cd "D:\Pharmaceutical management\backend"
   npm.cmd start
   ```
   The server launches on port 5000 and connects to both `warehouse` and `pharmacy` Atlas databases.

2. **Run Full Automated Verification Test Suite**:
   ```powershell
   npm.cmd run test:all
   ```
   Executes all test scripts sequentially:
   - `test:auth`: Validates JWT creation, password hashing, and master CRUD.
   - `test:inventory`: Validates PO creation, goods receipt, FEFO sorting, transfer allocation, dispatch invoice, receipt confirmation, POS checkout, and non-negative inventory enforcement.
   - `test:bridge`: Validates inter-service communication (pharmacy request transmission, warehouse dispatch broadcast, live manifest query, and invoice payment).

3. **Postman Live Demonstration**:
   - Import `backend/docs/Pharmaceutical_Management_System.postman_collection.json` into Postman.
   - Run folder `1. Warehouse - Auth & Users` -> `Warehouse Login (Admin)`. The `whToken` variable auto-populates.
   - Run folder `7. Pharmacy - Auth & Customers` -> `Pharmacy Login`. The `phToken` variable auto-populates.
   - Execute dispatches and POS sales to showcase end-to-end logistics and dispensary management.
