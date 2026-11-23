# Pharmaceutical Management System - Frontend (React.js / MERN Stack)

This is the frontend component of the full **MERN Stack** (MongoDB + Express.js + React.js + Node.js) for the Pharmaceutical Management System.

The user interface reproduces the dual-sliding card authentication layout depicted in the provided design mockup, connected directly to your existing Express + MongoDB Atlas backend without any modifications to backend code.

---

## 🎯 Architecture (MERN Stack)

- **M (MongoDB Atlas):** Multi-database storage for Central Warehouse (`warehouse`) and Branch Dispensaries (`pharmacy`).
- **E (Express.js):** RESTful API micro-services with JWT authentication & role-based access control.
- **R (React.js):** Vite + React single-page frontend application with hooks, component modularity, and Axios service layer.
- **N (Node.js):** Backend runtime environment.

---

## 🎨 Visual Design & Layout (Matches Shared Reference Image)

- **Layout:** Replicating the dual-sliding split-card architecture.
  - Opens in the exact state shown in your screenshot:
    - **Left Side:** Deep Teal panel with *"Welcome Back!"*, *"To keep connected with us please login with your personal info"*, brand logo, watermark diamonds, and ghost button `"SIGN IN"`.
    - **Right Side:** Clean white form panel with `"Create Account"`, circular social icons `f`, `G+`, `in`, input fields with icons (Name, Email, Password), and solid teal button `"SIGN UP"`.
  - Clicking `"SIGN IN"` or `"SIGN UP"` triggers the smooth sliding panel transition.
  - Ambient geometric accents: Amber/Yellow circle at the bottom-left and Coral/Red angled triangle at the top-right.

- **Problem Statement Features:**
  - **Portal Switcher:** Easily toggle between **Central Warehouse** and **Pharmacy Branch**.
  - **Dynamic Roles:**
    - **Central Warehouse:** `WAREHOUSE_ADMIN`, `INVENTORY_MANAGER` (FEFO stock & expiry tracking), `PROCUREMENT_OFFICER`, `DISPATCH_OPERATOR`.
    - **Pharmacy Branch:** `PHARMACY_ADMIN`, `PHARMACIST` (Stock & dispensing), `CASHIER` (Point-of-sale billing & returns).
  - **1-Click Demo Logins:** Quick auto-fill buttons for seeded test accounts (`admin` / `Password@123` & `pharmadmin` / `Password@123`).

---

## 🚀 How to Run the MERN Application

### 1. Start the Backend (Node + Express + MongoDB)
Open a terminal in the `backend` directory:
```powershell
cd "Pharmaceutical management\backend"
npm.cmd start
```
*Backend runs at `http://localhost:5000` (Health check: `http://localhost:5000/api/health`).*

### 2. Start the Frontend (React.js + Vite)
In a second terminal, navigate to the `frontend` directory:
```powershell
cd "Pharmaceutical management\frontend"
npm.cmd run dev
```
*Frontend runs at `http://localhost:3000` with instant Hot-Module-Replacement (HMR).*

---

## 📁 Frontend Directory Structure

```text
frontend/
├── dist/                      # Production build assets
├── node_modules/              # React & Vite dependencies
├── src/
│   ├── components/
│   │   ├── Header.jsx         # System branding & real-time API health monitor
│   │   ├── SignInForm.jsx     # Login form with portal & demo switcher
│   │   ├── SignUpForm.jsx     # Registration form matching image layout
│   │   ├── OverlayPanel.jsx   # Teal sliding overlay panel with watermark motifs
│   │   ├── SessionModal.jsx   # Post-authentication token & role preview modal
│   │   └── Toast.jsx          # Notification system
│   ├── services/
│   │   └── api.js             # Axios client connecting to backend endpoints
│   ├── App.jsx                # Main application state & sliding animation
│   ├── App.css                # Component styling & sliding transitions
│   ├── index.css              # Global styles & variables
│   └── main.jsx               # React DOM entry point
├── index.html                 # HTML entry point
├── package.json               # Frontend dependencies (React, Vite, Axios)
├── vite.config.js             # Vite configuration (port 3000)
└── README.md                  # Documentation
```
