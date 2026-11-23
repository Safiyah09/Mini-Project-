/**
 * Pharmaceutical Management System - Frontend Authentication Logic
 * Communicates directly with the multi-database backend on http://localhost:5000/api
 * Strictly preserves backend architecture and endpoints without any backend modifications.
 */

// Configuration: API Base Endpoint
const API_BASE_URL = window.API_BASE_URL || 'http://localhost:5000/api';

// Roles Configuration matching Backend Models
const ROLES = {
  warehouse: [
    { value: 'WAREHOUSE_ADMIN', label: 'Warehouse Admin (Full System Administrator)' },
    { value: 'INVENTORY_MANAGER', label: 'Inventory Manager (FEFO Stock & Expiry)' },
    { value: 'PROCUREMENT_OFFICER', label: 'Procurement Officer (Supplier Purchase Orders)' },
    { value: 'DISPATCH_OPERATOR', label: 'Dispatch Operator (Pharmacy Dispatches)' }
  ],
  pharmacy: [
    { value: 'PHARMACY_ADMIN', label: 'Pharmacy Admin (Branch Dispensary Head)' },
    { value: 'PHARMACIST', label: 'Pharmacist (Verifies Stock & Dispenses)' },
    { value: 'CASHIER', label: 'Cashier (Point-of-Sale Billing & Returns)' }
  ]
};

// DOM Elements
const container = document.getElementById('container');
const signInToggleBtn = document.getElementById('signInToggleBtn');
const signUpToggleBtn = document.getElementById('signUpToggleBtn');

// Sign In Form Elements
const signInForm = document.getElementById('signInForm');
const loginUsernameInput = document.getElementById('loginUsername');
const loginPasswordInput = document.getElementById('loginPassword');
const loginPharmacyIdGroup = document.getElementById('loginPharmacyIdGroup');
const loginPharmacyIdInput = document.getElementById('loginPharmacyId');
const loginPortalWarehouseLabel = document.getElementById('loginPortalWarehouseLabel');
const loginPortalPharmacyLabel = document.getElementById('loginPortalPharmacyLabel');
const btnSignInSubmit = document.getElementById('btnSignInSubmit');

// Sign Up Form Elements
const signUpForm = document.getElementById('signUpForm');
const regNameInput = document.getElementById('regName');
const regEmailInput = document.getElementById('regEmail');
const regUsernameInput = document.getElementById('regUsername');
const regPasswordInput = document.getElementById('regPassword');
const regRoleSelect = document.getElementById('regRole');
const regPharmacyIdGroup = document.getElementById('regPharmacyIdGroup');
const regPharmacyIdInput = document.getElementById('regPharmacyId');
const registerPortalWarehouseLabel = document.getElementById('registerPortalWarehouseLabel');
const registerPortalPharmacyLabel = document.getElementById('registerPortalPharmacyLabel');
const btnSignUpSubmit = document.getElementById('btnSignUpSubmit');

// API Health Elements
const apiStatusBadge = document.getElementById('apiStatusBadge');
const apiStatusText = document.getElementById('apiStatusText');
const testApiBtn = document.getElementById('testApiBtn');

// Toast & Modal Elements
const toastContainer = document.getElementById('toastContainer');
const authSuccessModal = document.getElementById('authSuccessModal');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalContinueBtn = document.getElementById('modalContinueBtn');
const logoutBtn = document.getElementById('logoutBtn');
const copyTokenBtn = document.getElementById('copyTokenBtn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupSlidingPanels();
  setupPortalToggles();
  setupPasswordToggles();
  setupQuickDemoAccounts();
  setupModalEvents();
  checkApiHealth();
  checkExistingSession();
});

/* ==========================================================================
   1. Sliding Panels Animation Toggle
   Starts in right-panel-active (matches reference image: Teal Left, Signup Right)
   ========================================================================== */
function setupSlidingPanels() {
  if (signInToggleBtn) {
    signInToggleBtn.addEventListener('click', () => {
      container.classList.remove('right-panel-active');
    });
  }

  if (signUpToggleBtn) {
    signUpToggleBtn.addEventListener('click', () => {
      container.classList.add('right-panel-active');
    });
  }

  const forgotBtn = document.getElementById('forgotPasswordBtn');
  if (forgotBtn) {
    forgotBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showToast('Password recovery: Please contact your Central Warehouse or Pharmacy Administrator.', 'info');
    });
  }
}

/* ==========================================================================
   2. System Portal Toggles (Central Warehouse vs Pharmacy Branch)
   ========================================================================== */
function setupPortalToggles() {
  // Sign In Portal Toggles
  const loginPortals = document.querySelectorAll('input[name="loginPortal"]');
  loginPortals.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const isWarehouse = e.target.value === 'warehouse';
      loginPortalWarehouseLabel.classList.toggle('active', isWarehouse);
      loginPortalPharmacyLabel.classList.toggle('active', !isWarehouse);
      
      if (isWarehouse) {
        loginPharmacyIdGroup.classList.add('hidden');
      } else {
        loginPharmacyIdGroup.classList.remove('hidden');
      }
    });
  });

  // Sign Up Portal Toggles
  const registerPortals = document.querySelectorAll('input[name="registerPortal"]');
  registerPortals.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const isWarehouse = e.target.value === 'warehouse';
      registerPortalWarehouseLabel.classList.toggle('active', isWarehouse);
      registerPortalPharmacyLabel.classList.toggle('active', !isWarehouse);
      
      updateRoleDropdown(e.target.value);
      
      if (isWarehouse) {
        regPharmacyIdGroup.classList.add('hidden');
      } else {
        regPharmacyIdGroup.classList.remove('hidden');
      }
    });
  });

  // Default dropdown setup
  updateRoleDropdown('warehouse');
}

function updateRoleDropdown(portalType) {
  if (!regRoleSelect) return;
  regRoleSelect.innerHTML = '';
  const roleList = ROLES[portalType] || ROLES.warehouse;
  
  roleList.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.value;
    opt.textContent = r.label;
    regRoleSelect.appendChild(opt);
  });
}

/* ==========================================================================
   3. Password Visibility Toggles
   ========================================================================== */
function setupPasswordToggles() {
  const toggleButtons = document.querySelectorAll('.pwd-toggle-btn');
  toggleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (!input) return;

      if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
      } else {
        input.type = 'password';
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
      }
    });
  });
}

/* ==========================================================================
   4. Quick Demo Accounts Auto-fill
   ========================================================================== */
function setupQuickDemoAccounts() {
  const demoButtons = document.querySelectorAll('.demo-tag');
  demoButtons.forEach(tag => {
    tag.addEventListener('click', () => {
      const system = tag.getAttribute('data-system');
      const user = tag.getAttribute('data-user');
      const pass = tag.getAttribute('data-pass');

      // Switch to sign in panel
      container.classList.remove('right-panel-active');

      // Set radio
      const radio = document.querySelector(`input[name="loginPortal"][value="${system}"]`);
      if (radio) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change'));
      }

      loginUsernameInput.value = user;
      loginPasswordInput.value = pass;

      showToast(`Loaded ${system.toUpperCase()} credentials: ${user}`, 'info');
    });
  });
}

/* ==========================================================================
   5. Backend API Health Check
   ========================================================================== */
async function checkApiHealth() {
  if (!apiStatusBadge) return;
  apiStatusBadge.className = 'api-badge checking';
  apiStatusText.textContent = 'Connecting...';

  try {
    const res = await fetch(`${API_BASE_URL}/health`, { method: 'GET' });
    if (res.ok) {
      const data = await res.json();
      apiStatusBadge.className = 'api-badge online';
      apiStatusText.textContent = 'Backend Online (Port 5000)';
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    apiStatusBadge.className = 'api-badge offline';
    apiStatusText.textContent = 'Backend Offline';
  }
}

if (testApiBtn) {
  testApiBtn.addEventListener('click', (e) => {
    e.preventDefault();
    checkApiHealth();
    showToast('Pinging backend health at http://localhost:5000/api/health...', 'info');
  });
}

/* ==========================================================================
   6. Authentication Submissions
   ========================================================================== */

// Handle Sign In (POST /api/warehouse/auth/login OR /api/pharmacy/auth/login)
if (signInForm) {
  signInForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = loginUsernameInput.value.trim();
    const password = loginPasswordInput.value;
    const selectedPortal = document.querySelector('input[name="loginPortal"]:checked').value;
    const pharmacyId = loginPharmacyIdInput ? loginPharmacyIdInput.value.trim() : 'pharmacy';

    if (!username || !password) {
      showToast('Please enter both username and password.', 'error');
      return;
    }

    setButtonLoading(btnSignInSubmit, true);

    try {
      const endpoint = selectedPortal === 'warehouse'
        ? `${API_BASE_URL}/warehouse/auth/login`
        : `${API_BASE_URL}/pharmacy/auth/login`;

      const headers = {
        'Content-Type': 'application/json'
      };

      if (selectedPortal === 'pharmacy') {
        headers['x-pharmacy-id'] = pharmacyId || 'pharmacy';
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ username, password })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Login failed. Please check your credentials.');
      }

      // Success
      const { user, token } = result.data;
      saveSession({
        user,
        token,
        systemType: selectedPortal.toUpperCase(),
        pharmacyId: selectedPortal === 'pharmacy' ? pharmacyId : null
      });

      showToast(`Welcome back, ${user.name}!`, 'success');
      displayAuthModal(user, token, selectedPortal.toUpperCase(), pharmacyId);

    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setButtonLoading(btnSignInSubmit, false);
    }
  });
}

// Handle Sign Up (POST /api/warehouse/auth/register OR /api/pharmacy/auth/register)
if (signUpForm) {
  signUpForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = regNameInput.value.trim();
    const email = regEmailInput.value.trim();
    const username = regUsernameInput.value.trim();
    const password = regPasswordInput.value;
    const role_name = regRoleSelect.value;
    const selectedPortal = document.querySelector('input[name="registerPortal"]:checked').value;
    const pharmacyId = regPharmacyIdInput ? regPharmacyIdInput.value.trim() : 'pharmacy';

    if (!name || !username || !password) {
      showToast('Name, username, and password are required.', 'error');
      return;
    }

    if (password.length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      return;
    }

    setButtonLoading(btnSignUpSubmit, true);

    try {
      const endpoint = selectedPortal === 'warehouse'
        ? `${API_BASE_URL}/warehouse/auth/register`
        : `${API_BASE_URL}/pharmacy/auth/register`;

      const headers = {
        'Content-Type': 'application/json'
      };

      if (selectedPortal === 'pharmacy') {
        headers['x-pharmacy-id'] = pharmacyId || 'pharmacy';
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name,
          email,
          username,
          password,
          role_name
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Registration failed.');
      }

      // Success
      const { user, token } = result.data;
      saveSession({
        user,
        token,
        systemType: selectedPortal.toUpperCase(),
        pharmacyId: selectedPortal === 'pharmacy' ? pharmacyId : null
      });

      showToast(`Account created successfully for ${user.name}!`, 'success');
      displayAuthModal(user, token, selectedPortal.toUpperCase(), pharmacyId);

      signUpForm.reset();

    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setButtonLoading(btnSignUpSubmit, false);
    }
  });
}

/* ==========================================================================
   7. Session & LocalStorage Helpers
   ========================================================================== */
function saveSession(data) {
  localStorage.setItem('pharma_auth_session', JSON.stringify(data));
}

function getStoredSession() {
  try {
    const raw = localStorage.getItem('pharma_auth_session');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem('pharma_auth_session');
}

function checkExistingSession() {
  const session = getStoredSession();
  if (session && session.user && session.token) {
    // Session exists in localStorage
    console.log('Active session detected for:', session.user.username);
  }
}

/* ==========================================================================
   8. Authenticated Session Modal
   ========================================================================== */
function displayAuthModal(user, token, systemType, pharmacyId) {
  if (!authSuccessModal) return;

  const roleName = user.role ? (user.role.role_name || user.role) : 'USER';
  
  document.getElementById('modalUserName').textContent = user.name || 'User';
  document.getElementById('modalUsername').textContent = user.username || '--';
  document.getElementById('modalUserId').textContent = user.user_id || user.id || '--';
  document.getElementById('modalUserEmail').textContent = user.email || 'Not provided';
  document.getElementById('modalUserRole').textContent = roleName;
  document.getElementById('modalSystemType').textContent = `${systemType} SYSTEM`;
  document.getElementById('modalPharmacyContext').textContent = systemType === 'PHARMACY' ? (pharmacyId || 'pharmacy') : 'Central Warehouse (Master)';
  document.getElementById('modalUserAvatar').textContent = (user.name || 'U').charAt(0).toUpperCase();
  document.getElementById('modalJwtToken').textContent = token || '--';

  // Dynamic capabilities based on problem statement
  const capList = document.getElementById('capabilitiesList');
  if (capList) {
    if (systemType === 'WAREHOUSE') {
      capList.innerHTML = `
        <li>FEFO medicine batch allocation &amp; expiration monitoring</li>
        <li>Central warehouse stock management &amp; adjustments</li>
        <li>Pharmacy supply request fulfillment &amp; stock dispatches</li>
        <li>Supplier purchase orders &amp; goods receipts</li>
      `;
    } else {
      capList.innerHTML = `
        <li>Pharmacy branch stock tracking &amp; inventory counts</li>
        <li>Point-of-sale customer billing &amp; medicine sales</li>
        <li>Near-expiry alerts &amp; real-time availability checks</li>
        <li>Supply requests to central warehouse &amp; stock receipts</li>
      `;
    }
  }

  authSuccessModal.classList.remove('hidden');
}

function setupModalEvents() {
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', () => {
      authSuccessModal.classList.add('hidden');
    });
  }

  if (modalContinueBtn) {
    modalContinueBtn.addEventListener('click', () => {
      authSuccessModal.classList.add('hidden');
      showToast('Logged in session active. You can now access inventory and sales modules.', 'success');
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearSession();
      authSuccessModal.classList.add('hidden');
      showToast('You have been logged out successfully.', 'info');
    });
  }

  if (copyTokenBtn) {
    copyTokenBtn.addEventListener('click', () => {
      const token = document.getElementById('modalJwtToken').textContent;
      navigator.clipboard.writeText(token).then(() => {
        copyTokenBtn.textContent = 'Copied!';
        setTimeout(() => copyTokenBtn.textContent = 'Copy', 2000);
      });
    });
  }
}

/* ==========================================================================
   9. Utilities (Toasts & Loading States)
   ========================================================================== */
function showToast(message, type = 'info') {
  if (!toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
  } else if (type === 'error') {
    iconSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#ef4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
  } else {
    iconSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#3b82f6" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
  }

  toast.innerHTML = `
    <span class="toast-icon">${iconSvg}</span>
    <span class="toast-msg">${message}</span>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function setButtonLoading(button, isLoading) {
  if (!button) return;
  button.disabled = isLoading;
  button.classList.toggle('loading', isLoading);
}
