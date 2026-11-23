# Pharmaceutical Management System — API Documentation

## Overview
This document specifies all backend REST APIs for the Pharmaceutical Management System, connecting a Central Warehouse with multiple independent, isolated Branch Pharmacies (multi-tenant MongoDB Atlas architecture).

---

## 1. Authentication & Headers

| Header | Required | Purpose |
| :--- | :--- | :--- |
| `Authorization` | Yes (protected routes) | `Bearer <JWT_TOKEN>` |
| `Content-Type` | Yes (POST/PUT) | `application/json` |
| `x-pharmacy-id` | Optional (Pharmacy routes) | Tenant selector (e.g. `PHARM-IND-01` -> connects to `pharmacy_pharm_ind_01`; defaults to `pharmacy`). |

### Error Format
All errors return a consistent JSON schema:
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Human-readable error description",
  "errors": []
}
```

---

## 2. Engine E1 — Warehouse Inventory & Transaction Ledger APIs

### 2.1 Reconcile Warehouse Batch Stock
Compares physical stored inventory (`quantity_on_hand`) against the append-only ledger derivation:
$$\text{derived\_stock} = \text{opening} + \text{stock\_in} + \text{usable\_returns} - \text{dispatch} - \text{damage}$$

* **Method / Path:** `GET /api/warehouse/stocks/reconcile`
* **Query Parameters:**
  * `batch_id` (optional): Batch ObjectId or alphanumeric Batch number (`BAT-001`). If omitted, reconciles all stocks in the warehouse.
* **Headers:** `Authorization: Bearer <warehouse_token>`
* **Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "batch_id": "6afdeca6bae0c7d372a003df",
    "batch_number": "BAT-E1-RECON-81330",
    "stored_stock": 123,
    "derived_stock": 123,
    "matched": true,
    "difference": 0,
    "breakdown": {
      "opening": 100,
      "stock_in": 50,
      "usable_returns": 5,
      "dispatch": 30,
      "damage": 2,
      "return_damaged": 0
    },
    "ledger_entries_count": 5
  },
  "message": "Batch stock reconciliation completed"
}
```

---

### 2.2 Warehouse Report: Stock by Batch
Retrieves real-time batch inventory with storage locations and expiry flags.

* **Method / Path:** `GET /api/warehouse/reports/stock-by-batch`
* **Query Parameters:**
  * `medicine_id` (optional): Filter by medicine ID (e.g., `MED-PCM-500`).
  * `status` (optional): Filter by stock status (`AVAILABLE`, `LOW_STOCK`, `OUT_OF_STOCK`, `EXPIRED`).
* **Headers:** `Authorization: Bearer <warehouse_token>`
* **Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "count": 12,
    "report": [
      {
        "stock_id": "STK-WH-81330",
        "batch_id": "BAT-ID-81330",
        "batch_number": "BAT-PCM-2027-01",
        "medicine": {
          "medicine_id": "MED-PCM-500",
          "name": "Paracetamol",
          "dosage": "500mg",
          "formulation": "Tablet"
        },
        "storage_location": {
          "location_id": "LOC-A1-R1",
          "zone": "A",
          "rack_bin": "R1-B2"
        },
        "quantity_on_hand": 150,
        "quantity_reserved": 0,
        "available_quantity": 150,
        "stock_status": "AVAILABLE",
        "manufacturing_date": "2026-01-01T00:00:00.000Z",
        "expiry_date": "2028-01-01T00:00:00.000Z",
        "is_expired": false
      }
    ]
  },
  "message": "Warehouse stock by batch report generated successfully"
}
```

---

### 2.3 Warehouse Report: Transaction History by Date Range
Queries the immutable, append-only `TransactionLedger` with aggregated breakdown totals.

* **Method / Path:** `GET /api/warehouse/reports/transaction-history`
* **Query Parameters:**
  * `from_date` (optional): ISO date (e.g. `2026-01-01`)
  * `to_date` (optional): ISO date (e.g. `2026-12-31`)
  * `txn_type` (optional): `STOCK_IN` | `DISPATCH` | `RETURN_USABLE` | `RETURN_DAMAGED` | `DAMAGE` | `OPENING_BALANCE`
  * `medicine_id` (optional): ObjectId string
  * `batch_id` (optional): ObjectId string
* **Headers:** `Authorization: Bearer <warehouse_token>`
* **Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "summary": {
      "total_transactions": 24,
      "total_stock_in": 5000,
      "total_dispatch": 1200,
      "total_usable_returns": 50,
      "total_damaged_returns": 2,
      "total_damage": 15
    },
    "transactions": [
      {
        "ledger_id": "LED-WH-81330-101",
        "txn_type": "STOCK_IN",
        "medicine_id": { "medicine_id": "MED-PCM-500", "name": "Paracetamol" },
        "batch_id": { "batch_number": "BAT-PCM-2027-01", "expiry_date": "2028-01-01T00:00:00.000Z" },
        "quantity_delta": 100,
        "reference_type": "GOODS_RECEIPT",
        "reference_id": "GR-WH-001",
        "notes": "Goods receipt accepted from PO-001",
        "created_at": "2026-11-18T18:20:00.000Z"
      }
    ]
  },
  "message": "Warehouse transaction history retrieved successfully"
}
```

---

### 2.4 Warehouse Report: Expiry Risk
Classifies warehouse stock into `NORMAL`, `EXPIRING_SOON` (<= 60 days), `CRITICAL` (<= 30 days), and `EXPIRED`.

* **Method / Path:** `GET /api/warehouse/reports/expiry`
* **Query Parameters:**
  * `days` (optional, default: 60): Day window threshold.
  * `expired` (optional, default: false): If true, returns only expired batches.
* **Headers:** `Authorization: Bearer <warehouse_token>`
* **Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "total_batches": 18,
    "critical_count": 2,
    "report": [
      {
        "batch_id": "BAT-ID-01",
        "batch_number": "BAT-PCM-2027-01",
        "medicine": { "name": "Paracetamol", "dosage": "500mg" },
        "expiry_date": "2026-12-01T00:00:00.000Z",
        "days_until_expiry": 13,
        "risk_status": "CRITICAL",
        "quantity_on_hand": 150,
        "available_quantity": 150
      }
    ]
  },
  "message": "Warehouse expiry report generated successfully"
}
```

---

### 2.5 Warehouse Report: Dispatch Per Pharmacy
Aggregates dispatches, item lines, and total units delivered per branch pharmacy.

* **Method / Path:** `GET /api/warehouse/reports/dispatch-per-pharmacy`
* **Query Parameters:**
  * `pharmacy_id` (optional): Filter by pharmacy ObjectId
  * `from_date` (optional): Filter by dispatch start date
  * `to_date` (optional): Filter by dispatch end date
* **Headers:** `Authorization: Bearer <warehouse_token>`
* **Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "total_pharmacies": 2,
    "pharmacies": [
      {
        "pharmacy_id": "PHARM-IND-01",
        "name": "Apollo Care Pharmacy - Indiranagar",
        "address": "100 Feet Road, Indiranagar, Bengaluru",
        "total_dispatches": 3,
        "total_units_dispatched": 750,
        "transfers": [
          {
            "transfer_id": "TRF-COMM-8333",
            "shipping_reference": "SPEED-POST-01",
            "dispatch_date": "2026-11-18T18:22:00.000Z",
            "items_count": 1,
            "total_units": 250,
            "items": [
              {
                "transfer_item_id": "TRI-001",
                "batch_number": "BAT-PCM-2027-2272",
                "quantity_dispatched": 250
              }
            ]
          }
        ]
      }
    ]
  },
  "message": "Dispatch per pharmacy report generated successfully"
}
```

---

### 2.6 Goods Receipt (Stock-In)
Receives supplier purchase order items into warehouse inventory, auto-allocates storage location, creates or finds the batch, and writes a `STOCK_IN` row to the append-only ledger.

* **Method / Path:** `POST /api/warehouse/goods-receipts`
* **Headers:** `Authorization: Bearer <warehouse_token>`
* **Request Body:**
```json
{
  "receipt_id": "GR-2026-001",
  "purchase_order": "6ae8aad1598bde6bbe85ffcb",
  "items": [
    {
      "po_item": "6ae8aad1598bde6bbe85ffcc",
      "quantity_received": 100,
      "batch_number": "BAT-PCM-2028-01",
      "manufacturing_date": "2026-01-01",
      "expiry_date": "2028-01-01",
      "storage_location": "6ae8aad1598bde6bbe85ffcd"
    }
  ]
}
```
* **Success Response (201 Created):**
```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "goodsReceipt": { "receipt_id": "GR-2026-001", "status": "ACCEPTED" },
    "batches": [ { "batch_number": "BAT-PCM-2028-01" } ],
    "stocks": [ { "quantity_on_hand": 100, "stock_status": "AVAILABLE" } ]
  },
  "message": "Goods receipt processed and warehouse inventory updated successfully"
}
```

---

### 2.7 Dispatch Stock Transfer & Generate Manifest
Deducts warehouse stock, writes a signed negative `DISPATCH` row to the append-only ledger, creates an unpaid invoice, and generates a JSON manifest.

* **Method / Path:** `PUT /api/warehouse/transfers/:id/dispatch`
* **Headers:** `Authorization: Bearer <warehouse_token>`
* **Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "transfer": { "transfer_id": "TRF-COMM-001", "status": "DISPATCHED" },
    "invoice": { "invoice_id": "INV-TRF-COMM-001", "status": "UNPAID" },
    "dispatchedItems": [ { "quantity_dispatched": 25 } ],
    "manifest": {
      "transfer_id": "TRF-COMM-001",
      "status": "DISPATCHED",
      "pharmacy_id": "PHARM-IND-01",
      "pharmacy_name": "Apollo Care Pharmacy - Indiranagar",
      "shipping_reference": "SPEED-POST-01",
      "item_count": 1,
      "items": [
        {
          "transfer_item_id": "TRI-001",
          "batch_number": "BAT-PCM-2027-2272",
          "medicine_id": "MED-PCM-500",
          "medicine_name": "Paracetamol",
          "dosage": "500mg",
          "formulation": "Tablet",
          "quantity_dispatched": 25,
          "unit_cost": "15.00"
        }
      ]
    }
  },
  "message": "Stock transfer dispatched and warehouse inventory updated successfully"
}
```

---

### 2.8 Process Pharmacy Return (Usable vs Damaged)
Accepts goods returned by a pharmacy. Usable returns restore physical available stock and record `RETURN_USABLE` (+delta). Damaged returns do NOT increase available stock and record `RETURN_DAMAGED` (delta 0).

* **Method / Path:** `POST /api/warehouse/returns/pharmacy`
* **Headers:** `Authorization: Bearer <warehouse_token>`
* **Request Body:**
```json
{
  "transfer_item": "6afdecf37e09a9294c4a27fe",
  "quantity": 8,
  "reason": "Broken ampoules during pharmacy transit",
  "restock_to_inventory": false
}
```
* **Success Response (201 Created):**
```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "pharmacyReturn": { "return_id": "RET-PH-001", "quantity": 8, "reason": "Broken ampoules" },
    "restockedToInventory": false,
    "warehouseStockOnHand": 125
  },
  "message": "Pharmacy return accepted successfully"
}
```

---

### 2.9 Stock Adjustment & Damage Recording
Records physical stock corrections or damage. Rejects any damage request that exceeds available stock with HTTP 400.

* **Method / Path:** `POST /api/warehouse/adjustments`
* **Headers:** `Authorization: Bearer <warehouse_token>`
* **Request Body:**
```json
{
  "batch": "BAT-PCM-2027-01",
  "quantity": -2,
  "reason": "Water damage during warehouse inspection"
}
```
* **Success Response (201 Created):**
```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "adjustment": { "adjustment_id": "ADJ-001", "quantity": -2, "reason": "Water damage" },
    "stock": { "quantity_on_hand": 123 }
  },
  "message": "Stock adjustment recorded successfully"
}
```
* **Rejection Response when `|qty| > available` (400 Bad Request):**
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Cannot adjust quantity by -10. Current quantity on hand is 5, which would result in negative stock."
}
```


---

## 3. Engine E2 — Pharmacy Order & Dispatch APIs

### 3.1 Strict Order State Machine Transitions
Transitions order status according to the valid state machine rules:
```
CREATED / PENDING
   ├──> STOCK_CHECKING
   │       ├──> RESERVED
   │       │       └──> CONFIRMED ──> DISPATCHED ──> COMPLETED
   │       └──> PENDING_STOCK (Backordered)
   │               └──> CANCELLED
   │       └──> REJECTED
   └──> CANCELLED
```
Disallowed transitions return `409 Conflict`. Every valid transition automatically logs a record in `OrderStatusHistory`.

* **Method / Path:** `PUT /api/warehouse/supply-requests/:id/status`
* **Headers:** `Authorization: Bearer <warehouse_token>`
* **Request Body:**
```json
{
  "status": "CONFIRMED",
  "notes": "Approved by warehouse dispatcher"
}
```
* **Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "request": {
      "_id": "6afdecf37e09a9294c4a28aa",
      "status": "CONFIRMED",
      "updatedAt": "2026-11-18T18:30:00.000Z"
    },
    "history": {
      "from_status": "RESERVED",
      "to_status": "CONFIRMED",
      "user": "6afdecf37e09a9294c4a28ab",
      "notes": "Approved by warehouse dispatcher"
    }
  },
  "message": "Order status transitioned to CONFIRMED successfully"
}
```
* **Invalid Transition Error (409 Conflict):**
```json
{
  "success": false,
  "statusCode": 409,
  "message": "Invalid status transition from PENDING to COMPLETED. Allowed transitions: STOCK_CHECKING, CANCELLED"
}
```

---

### 3.2 Order Status History
Retrieves full chronological audit trail of all transitions for a given supply request.

* **Method / Path:**
  * Warehouse: `GET /api/warehouse/supply-requests/:id/history`
  * Pharmacy: `GET /api/pharmacy/supply-requests/:id/history`
* **Headers:**
  * Warehouse: `Authorization: Bearer <warehouse_token>`
  * Pharmacy: `Authorization: Bearer <pharmacy_token>`, `x-pharmacy-id: <pharmacy_id>`
* **Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "_id": "6afdecf37e09a9294c4a28ac",
      "order_id": "6afdecf37e09a9294c4a28aa",
      "from_status": "CREATED",
      "to_status": "STOCK_CHECKING",
      "changed_at": "2026-11-18T18:25:00.000Z",
      "notes": "Checking warehouse inventory"
    },
    {
      "_id": "6afdecf37e09a9294c4a28ad",
      "order_id": "6afdecf37e09a9294c4a28aa",
      "from_status": "STOCK_CHECKING",
      "to_status": "RESERVED",
      "changed_at": "2026-11-18T18:26:00.000Z",
      "notes": "Batches allocated"
    }
  ]
}
```

---

### 3.3 Create Pharmacy Order (with Alert Linking & Partial Backorder fields)
Creates an order with support for linking from low-stock alerts and tracking fulfillment status per item.

* **Method / Path:** `POST /api/pharmacy/supply-requests`
* **Headers:** `Authorization: Bearer <pharmacy_token>`, `x-pharmacy-id: <pharmacy_id>`
* **Request Body:**
```json
{
  "priority": "HIGH",
  "from_alert_id": "6afdecf37e09a9294c4a28ae",
  "items": [
    {
      "medicine": "6afdecf37e09a9294c4a28af",
      "quantity_requested": 50
    }
  ],
  "remarks": "Order triggered by low stock alert"
}
```
* **Success Response (201 Created):**
```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "_id": "6afdecf37e09a9294c4a28b0",
    "status": "PENDING",
    "from_alert": "6afdecf37e09a9294c4a28ae",
    "items": [
      {
        "medicine": "6afdecf37e09a9294c4a28af",
        "quantity_requested": 50,
        "quantity_fulfilled": 0,
        "quantity_pending": 50,
        "is_backordered": false
      }
    ]
  },
  "message": "Supply request created successfully"
}
```

---

### 3.4 Cancel Order (Pharmacy)
Cancels an order if it has not yet reached confirmed or dispatched stages.

* **Method / Path:** `PUT /api/pharmacy/supply-requests/:id/cancel`
* **Headers:** `Authorization: Bearer <pharmacy_token>`, `x-pharmacy-id: <pharmacy_id>`
* **Request Body:**
```json
{
  "reason": "Overestimated branch demand"
}
```
* **Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "request": {
      "_id": "6afdecf37e09a9294c4a28b0",
      "status": "CANCELLED"
    }
  },
  "message": "Supply request cancelled successfully"
}
```

---

### 3.5 Inter-Service Warehouse Communication (Service Auth)
Secure service-to-service communication between branch pharmacy services and warehouse services requiring `x-service-token`.

* **Service Headers:** `x-service-token: <SHARED_SECRET_OR_JWT>`
* **Endpoints:**
  1. `POST /api/warehouse/service/supply-requests`: Transmits pharmacy request to central warehouse.
  2. `GET /api/warehouse/service/manifest/:transferId`: Fetches dispatch manifest for receipt reconciliation.
  3. `POST /api/warehouse/service/discrepancies`: Syncs receipt discrepancies to warehouse database.
* **Unauthorized Rejection (401 Unauthorized):**
```json
{
  "success": false,
  "statusCode": 401,
  "message": "Service authentication token missing or invalid"
}
```

---

### 3.6 Receipt Reconciliation & Discrepancy Recording (Pharmacy)
Pharmacy receives dispatched items and verifies them against the warehouse manifest.
- Only verified quantities are credited to the branch pharmacy inventory.
- Any shortages (e.g., dispatched 30, received 28), excess quantities, or wrong batches create `ReceiptDiscrepancy` records in both the pharmacy and warehouse databases.

* **Method / Path:** `POST /api/pharmacy/stock-receipts/confirm-receipt`
* **Headers:** `Authorization: Bearer <pharmacy_token>`, `x-pharmacy-id: <pharmacy_id>`
* **Request Body:**
```json
{
  "transfer_id": "6afdecf37e09a9294c4a28c0",
  "received_items": [
    {
      "medicine": "6afdecf37e09a9294c4a28af",
      "batch_number": "BAT-PCM-2027-01",
      "quantity_received": 28,
      "expiry_date": "2027-06-30T00:00:00.000Z"
    }
  ],
  "discrepancies": [
    {
      "medicine_id": "6afdecf37e09a9294c4a28af",
      "batch_number": "BAT-PCM-2027-01",
      "type": "SHORTAGE",
      "expected_quantity": 30,
      "received_quantity": 28,
      "reason": "Damaged / missing 2 units in transit carton"
    }
  ]
}
```
* **Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "receipt": {
      "status": "DISCREPANCY",
      "discrepancies_count": 1
    },
    "credited_inventory": [
      {
        "batch_number": "BAT-PCM-2027-01",
        "credited_quantity": 28
      }
    ]
  },
  "message": "Receipt confirmed with discrepancy logged"
}
```

---

### 3.7 Central Warehouse Discrepancies Listing
Warehouse managers inspect logged discrepancies across all branch pharmacies.

* **Method / Path:** `GET /api/warehouse/discrepancies`
* **Headers:** `Authorization: Bearer <warehouse_token>`
* **Query Parameters:**
  * `status` (optional): `OPEN` | `RESOLVED` | `INVESTIGATING`
  * `pharmacy_id` (optional): Filter by pharmacy code
* **Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "_id": "6afdecf37e09a9294c4a28d1",
      "pharmacy_id": "PHARM-IND-01",
      "type": "SHORTAGE",
      "expected_quantity": 30,
      "received_quantity": 28,
      "difference": -2,
      "reason": "Damaged / missing 2 units in transit carton",
      "status": "OPEN",
      "created_at": "2026-11-18T18:40:00.000Z"
    }
  ]
}
```

---

### 3.8 Pharmacy Return to Central Warehouse
Initiates a return of stock from a branch pharmacy back to the central warehouse. Deducts pharmacy stock and logs `DISPATCH` in the branch ledger.

* **Method / Path:** `POST /api/pharmacy/returns/to-warehouse`
* **Headers:** `Authorization: Bearer <pharmacy_token>`, `x-pharmacy-id: <pharmacy_id>`
* **Request Body:**
```json
{
  "items": [
    {
      "medicine_id": "6afdecf37e09a9294c4a28af",
      "batch_id": "6afdecf37e09a9294c4a28c5",
      "quantity": 5,
      "is_usable": false,
      "reason": "Stock returned due to recall notice"
    }
  ]
}
```
* **Success Response (201 Created):**
```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "return_id": "RET-IND-2026-004",
    "items_count": 1,
    "status": "INITIATED"
  },
  "message": "Return to warehouse initiated successfully"
}
```

---

### 3.9 Pharmacy Tenant Isolation Enforcement
Users authenticated to a specific pharmacy cannot supply an `x-pharmacy-id` header corresponding to a different branch.
- If a user belonging to `PHARM-IND-01` attempts to query or mutate `PHARM-KOR-02` resources, the request is rejected immediately with HTTP 403.

* **Error Response (403 Forbidden):**
```json
{
  "success": false,
  "statusCode": 403,
  "message": "Tenant mismatch: token is bound to pharmacy PHARM-IND-01, cannot access PHARM-KOR-02"
}
```


---

## 4. Engine E3 — Batch & Inventory Alert (FEFO Allocation & Availability)

### 4.1 FEFO Min-Heap Priority Queue Engine
The system uses an in-memory binary Min-Heap priority queue (`fefoMinHeap.js`) to evaluate and allocate medicine batches in First-Expired, First-Out order:
* **Primary Key:** `expiry_date` (ascending: earliest expiration first).
* **Tie-Breaker 1:** `received_date` / `createdAt` (ascending: earliest inward batch first).
* **Tie-Breaker 2:** Deterministic alphanumeric batch identifier comparison.
* **Exclusion of Expired Batches:** Any batch with `expiry_date <= now` is strictly excluded from allocation.
* **Complexity:**
  * Heap Construction: $O(n \log n)$ where $n$ is candidate unexpired batches.
  * Batch Extraction: $O(k \log n)$ where $k \le n$ is batches allocated.
  * Total Runtime: $O(n \log n + k \log n)$.
  * Auxiliary Space: $O(n)$.
* **Pure Function:** Returns proposed allocation descriptor without mutating database records or in-memory objects.

---

### 4.2 Warehouse Stock Availability Check
Calculates whether warehouse inventory can fulfill a target quantity. Returns status `FULL`, `PARTIAL`, or `NONE` and lists the proposed batches.

* **Method / Path:**
  * `GET /api/warehouse/stocks/availability/:medicineId?quantity=N`
  * `GET /api/warehouse/stocks/availability?medicine_id=...&quantity=N`
* **Headers:** `Authorization: Bearer <warehouse_token>`
* **Success Response (FULL Fulfillment — 200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "medicine_id": "MED-PCM-500",
    "medicine_name": "Paracetamol 500mg",
    "status": "FULL",
    "requested_quantity": 40,
    "available_quantity": 50,
    "unfulfilled_quantity": 0,
    "batches": [
      {
        "batch_id": "BAT-WH-B2-88123",
        "batch_number": "BAT-WH-B2-88123",
        "expiry_date": "2026-12-31T00:00:00.000Z",
        "qty": 30,
        "available_qty": 30
      },
      {
        "batch_id": "BAT-WH-B1-88123",
        "batch_number": "BAT-WH-B1-88123",
        "expiry_date": "2027-01-31T00:00:00.000Z",
        "qty": 10,
        "available_qty": 20
      }
    ],
    "eligible_batches_count": 2,
    "expired_batches_count": 1
  },
  "message": "Stock availability evaluated: FULL"
}
```

* **Success Response (PARTIAL Fulfillment — 200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "medicine_id": "MED-PCM-500",
    "medicine_name": "Paracetamol 500mg",
    "status": "PARTIAL",
    "requested_quantity": 60,
    "available_quantity": 50,
    "unfulfilled_quantity": 10,
    "batches": [
      {
        "batch_id": "BAT-WH-B2-88123",
        "batch_number": "BAT-WH-B2-88123",
        "expiry_date": "2026-12-31T00:00:00.000Z",
        "qty": 30,
        "available_qty": 30
      },
      {
        "batch_id": "BAT-WH-B1-88123",
        "batch_number": "BAT-WH-B1-88123",
        "expiry_date": "2027-01-31T00:00:00.000Z",
        "qty": 20,
        "available_qty": 20
      }
    ]
  },
  "message": "Stock availability evaluated: PARTIAL"
}
```

* **Success Response (NONE Availability — 200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "medicine_id": "MED-PCM-500",
    "medicine_name": "Paracetamol 500mg",
    "status": "NONE",
    "requested_quantity": 10,
    "available_quantity": 0,
    "unfulfilled_quantity": 10,
    "batches": []
  },
  "message": "Stock availability evaluated: NONE"
}
```

---

### 4.3 Pharmacy Stock Availability Check
Calculates stock availability in a branch pharmacy.

* **Method / Path:**
  * `GET /api/pharmacy/medicines/:id/availability?quantity=N`
  * `GET /api/pharmacy/medicines/availability?medicine_id=...&quantity=N`
* **Headers:** `Authorization: Bearer <pharmacy_token>`, `x-pharmacy-id: <pharmacy_id>`
* **Success Response (200 OK):** Same schema as Warehouse Availability Check.

---

### 4.4 Pharmacy POS Checkout with FEFO Allocation & Expired Rejection
Cashiers can specify `medicine` (enabling automated FEFO allocation) or explicit `batch`.
- Automatically selects the earliest valid unexpired batch.
- Splits single items across multiple batches if requested quantity exceeds one batch.
- Strictly rejects any sale of expired batches with HTTP 400.
- Blocks checkout if requested quantity exceeds available unexpired inventory.

* **Method / Path:** `POST /api/pharmacy/sales`
* **Headers:** `Authorization: Bearer <pharmacy_token>`, `x-pharmacy-id: <pharmacy_id>`
* **Request Body (FEFO Automated Allocation):**
```json
{
  "items": [
    {
      "medicine": "MED-PCM-500",
      "quantity": 40,
      "unit_price": 3.00
    }
  ],
  "payment_method": "CASH"
}
```
* **Success Response (201 Created):**
```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "sale": {
      "sale_id": "SALE-49102",
      "sale_date": "2026-11-19T21:30:00.000Z",
      "total_amount": 120.00
    },
    "items": [
      {
        "sale_item_id": "SLI-SALE-49102-01",
        "batch": "6aff1e4aac0d799834a571a8",
        "quantity": 30,
        "unit_price": 3.00,
        "subtotal": 90.00
      },
      {
        "sale_item_id": "SLI-SALE-49102-02",
        "batch": "6aff1e4aac0d799834a571a9",
        "quantity": 10,
        "unit_price": 3.00,
        "subtotal": 30.00
      }
    ],
    "payment": {
      "payment_id": "PAY-SALE-49102",
      "amount": 120.00,
      "method": "CASH"
    }
  },
  "message": "Sale completed, inventory updated, and payment confirmed"
}
```
* **Rejection on Expired Batch (400 Bad Request):**
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Cannot dispense expired medicine! Batch 'PH-B3-EXP' (Paracetamol 500mg) expired on 2024-01-01."
}
```
* **Rejection on Insufficient Stock (400 Bad Request):**
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Insufficient stock for 'Paracetamol 500mg'. Requested: 80, Available: 50"
}
```

---

## 5. Engine E4 — Concurrent Transaction & Quality Standards

Engine E4 introduces industrial ACID consistency, high-concurrency race protection, idempotency enforcement, and production-grade error sanitization across both the Central Warehouse and Branch Pharmacy databases.

### 5.1 MongoDB Session Transaction Wrapper (`withTransaction`)
Encapsulates multi-document operations in an ACID transaction session (`session = await conn.startSession()`), automatically handling `TransientTransactionError` and `WriteConflict` via exponential backoff retries.
- **Rollback Guarantee:** If an operation aborts or throws midway (e.g. transfer dispatch failure), physical stock deductions, TransactionLedger rows, status updates, and audit logs are completely rolled back.
- **Usage:** Applied to Warehouse Dispatches, Pharmacy Goods Receipts, POS Sales, Customer Returns, and Stock Adjustments.

---

### 5.2 High-Concurrency Protection & Optimistic Locking
Protects inventory updates against race conditions (e.g., simultaneous requests competing for the last available units):
- **Atomic Deduction:** Uses `$inc: { quantity_on_hand: -qty, version: 1 }` combined with filter `{ quantity_on_hand: { $gte: qty } }`.
- **Non-Negative Guarantee:** Physical inventory can never drop below zero under any concurrency volume.
- **Winner / Loser Outcome:** When two concurrent requests compete for the last units, exactly one succeeds (`201 Created`) and the second is safely rejected (`400 Bad Request` with `INSUFFICIENT_STOCK`).

---

### 5.3 Idempotency Service (`Idempotency-Key`)
Guards critical stock-changing POST/PUT mutations against duplicate execution caused by client retries or network drops.

* **Supported Header:** `Idempotency-Key: <unique-uuid-or-token>`
* **Applicable Endpoints:**
  * `POST /api/pharmacy/sales`
  * `POST /api/pharmacy/receipts`
  * `POST /api/pharmacy/returns`
  * `POST /api/pharmacy/returns/to-warehouse`
  * `PUT /api/warehouse/transfers/:id/dispatch`
  * `POST /api/warehouse/adjustments`

#### Idempotency Behaviors
1. **First Execution:** The mutation executes, records an append-only ledger entry and audit log, and saves the response payload and SHA-256 request hash in `idempotency_records`.
2. **Safe Replay:** Sending the exact same `Idempotency-Key` with an identical request body skips execution and replays the cached response (`201 Created` or `200 OK`) with header `X-Idempotency-Replay: true`. Physical stock is deducted only once.
3. **Payload Mismatch Detection:** Reusing an existing `Idempotency-Key` with a different request body is strictly rejected:
```json
{
  "success": false,
  "statusCode": 422,
  "error_code": "IDEMPOTENCY_PAYLOAD_MISMATCH",
  "message": "Idempotency key '...' has already been used with a different request payload.",
  "details": []
}
```

---

### 5.4 Shared Validation Layer
Centralized domain validation rules applied across warehouse and pharmacy controllers:

| Validation Rule | Method | Input Constraints | Error Code | HTTP Status |
| :--- | :--- | :--- | :--- | :--- |
| **Positive Quantity** | `validatePositiveQuantity(val)` | Integer $> 0$. Rejects negative (`-5`), float (`2.5`), strings (`"abc"`), `null`. | `INVALID_QUANTITY` | 400 |
| **Batch Expiry** | `validateBatchExpiry(batchDoc)` | Expiry date must be strictly $> \text{now}$. | `EXPIRED_BATCH` | 400 |
| **Stock Availability** | `validateStockAvailability(stockDoc, qty)` | Available on-hand must be $\ge$ requested quantity. | `INSUFFICIENT_STOCK` | 400 |
| **Return Limit** | `validateReturnLimit(retQty, origQty)` | Return quantity cannot exceed originally sold / dispatched quantity. | `RETURN_LIMIT_EXCEEDED` | 400 |
| **Order State Machine** | `validateOrderStatusTransition(curr, tgt)` | Must be a valid edge in the strict state machine DAG. | `INVALID_STATUS_TRANSITION` | 409 |

---

### 5.5 Standardized Error Responses & Production Security
All error responses adhere to a unified, predictable contract:
```json
{
  "success": false,
  "statusCode": 400,
  "error_code": "INSUFFICIENT_STOCK",
  "message": "Insufficient stock: requested 5 unit(s), but only 0 available on hand",
  "details": [
    {
      "targetId": "6aff23fc80933158af15f82e",
      "requestedQuantity": 5,
      "availableQuantity": 0
    }
  ]
}
```

#### Production Security Rule
When `NODE_ENV === 'production'`:
- Stack traces (`stack` property) are strictly omitted from all HTTP responses.
- Internal database details or query strings are hidden behind standard messages.

---

### 5.6 Integrated Audit Logging
All stock-changing transactions automatically record audit events via `recordAudit()` within the database transaction session:
* Warehouse: Saved to `warehouse.audit_logs`.
* Pharmacy: Saved to `<pharmacy_db>.audit_logs`.
* Audit actions tracked: `STOCK_IN`, `TRANSFER_DISPATCH`, `STOCK_RECEIPT`, `SALE`, `CUSTOMER_RETURN`, `STOCK_ADJUSTMENT`, `DAMAGED_RETURN`.


---

## 6. Multi-Tenant Verification & Cross-Database Saga Architecture

The Pharmaceutical Management System enforces multi-tenant database isolation while maintaining transactional consistency across separate MongoDB Atlas connections.

### 6.1 Idempotency Key Isolation & Compound Index
Idempotency records use a compound unique index `{ key: 1, endpoint: 1 }` in `idempotency_records`:
- **Endpoint Isolation:** The same client idempotency key can safely be utilized across different endpoints (e.g. `/api/pharmacy/sales` and `/api/pharmacy/returns`) without causing collision.
- **Tenant Isolation:** Because pharmacy connections route to isolated database instances (`pharmacy`, `pharmacy_pharm_ind_01`, `pharmacy_pharm_kor_02`), each pharmacy maintains its own isolated `idempotency_records` collection.
- **Concurrent In-Flight Locking:** When simultaneous requests arrive with the same `Idempotency-Key` before the first completes, MongoDB's unique index catches duplicate key errors (`code: 11000`) and the middleware safely returns HTTP 409 `CONCURRENT_REQUEST_IN_FLIGHT`, preventing race conditions or duplicate ledger mutations.

---

### 6.2 MongoDB Session Consistency & ACID Rollback
All stock-changing endpoints participate in an ACID transaction:
1. `withTransaction(dbConnection, async (session) => { ... })`
2. Every database operation (`atomicDeductStock`, `atomicIncrementStock`, `recordLedgerEntry`, `recordAudit`, `order.save`, `history.save`) passes `{ session }`.
3. If an error or abort condition occurs anywhere during execution, MongoDB aborts the entire transaction.
4. Physical stock, document statuses, transaction ledger entries, and audit logs roll back atomically with 0 orphaned records.

---

### 6.3 Cross-Database Operations: Saga Pattern, Persistent Operation IDs & Recovery
Because MongoDB sessions cannot span physically distinct database connections (e.g., Pharmacy tenant DB $\leftrightarrow$ Central Warehouse DB), cross-database coordination utilizes a Two-Phase Saga with retry, idempotency, and compensation:

```
[Client] ---> Pharmacy Returns Endpoint (Phase 1)
                   |
                   v
         [Pharmacy DB Transaction]
         - Deduct pharmacy stock (session)
         - Append RETURN_DAMAGED / RETURN_USABLE ledger entry (session)
         - Commit Pharmacy DB Transaction
                   |
                   v
         [Warehouse DB Sync (Phase 2)]
         - Check if operation_id / return_id already exists (Idempotent replay)
         - Attempt Warehouse Return creation with exponential retries (up to 3x)
                   |
          +--------+--------+
          |                 |
       (Success)         (Network error / timeout after retries)
          |                 |
          v                 v
     HTTP 201         [Pre-Compensation Verification]
                      - Inspect Warehouse DB for operation_id
                      |
             +--------+--------+
             |                 |
       (Already Committed) (Truly Failed)
             |                 |
             v                 v
        Saga Recovery   [Compensating Transaction]
        (Skip rollback, - Check if already compensated
         return 201)    - Restore pharmacy stock (+qty)
                        - Append offsetting RETURN_USABLE ledger entry
                        - Fail request safely with HTTP 500
```

#### Production Saga Recovery Guarantees
1. **Persistent Unique Operation IDs:** Every cross-database return accepts a persistent unique `operation_id` (or inherits `return_id` / client `Idempotency-Key`).
2. **Idempotent Warehouse Processing:** Inside Phase 2 and within its retry loop, the warehouse connection explicitly inspects `PharmacyReturn.findOne({ return_id })` before executing writes. If an earlier attempt committed right before a socket timeout, it reuses the committed record without re-incrementing stock.
3. **Lost Response Protection (Pre-Compensation Check):** If a network partition occurs while the server is receiving the warehouse commit acknowledgment, the saga does **not** blindly execute a compensating transaction. It queries the Warehouse DB directly:
   - If the warehouse record committed, the saga marks the transaction as **recovered** (`saga_recovered: true`) and returns HTTP 201, avoiding duplicate stock creation.
   - If the warehouse record does not exist, the compensating transaction runs safely on the Pharmacy DB.
4. **Non-Duplicate Compensation:** The compensating transaction queries `TransactionLedger` for existing `SAGA_COMPENSATION` entries matching the `reference_id` to guarantee stock is never restored more than once.

Similarly, during Stock Receipt Confirmation (`POST /api/pharmacy/receipts`), discrepancy notifications to the Central Warehouse execute via a retryable workflow (`executeWithRetry`) after the Pharmacy DB transaction commits cleanly.

---

### 6.4 Concurrency Retries & Exponential Jitter
High-concurrency bursts competing for identical MongoDB documents are subject to transient write conflicts. The `withTransaction` wrapper automatically handles transient errors (`TransientTransactionError`, `WriteConflict`, `code: 112`) with up to 8 exponential jittered retries (`100ms * 1.5^(attempt-1) + random_jitter`), guaranteeing:
- Stock balances never become negative under burst traffic.
- Zero duplicate ledger rows or audit logs on retry, because aborted sessions discard all uncommitted writes.
- Final commit guarantees that winning transactions increment or decrement stock exactly once.
