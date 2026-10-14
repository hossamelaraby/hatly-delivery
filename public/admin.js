// Hatly Admin Dashboard Logic

let allOrders = [];
let currentFilter = 'all';
let currentSearch = '';
let soundAlertEnabled = true;
let previousOrderCount = null;
let currentViewingOrder = null;
let pollInterval = null;

// Audio Chime Generator using Web Audio API
function playNotificationChime() {
  if (!soundAlertEnabled) return;
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Tone 1
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    gain1.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start();
    osc1.stop(audioCtx.currentTime + 0.3);

    // Tone 2 (higher note)
    setTimeout(() => {
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      gain2.gain.setValueAtTime(0.35, audioCtx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start();
      osc2.stop(audioCtx.currentTime + 0.4);
    }, 150);
  } catch (e) {
    console.log('Audio notification error:', e);
  }
}

// Toggle sound alert
function toggleSoundAlert() {
  soundAlertEnabled = !soundAlertEnabled;
  const btn = document.getElementById('soundToggleBtn');
  const icon = document.getElementById('soundIcon');
  const text = document.getElementById('soundText');

  if (soundAlertEnabled) {
    btn.classList.add('sound-active');
    icon.className = 'fas fa-volume-up';
    text.innerText = 'صوت التنبيه: مفعّل';
    playNotificationChime();
    showToast('تم تفعيل التنبيه الصوتي');
  } else {
    btn.classList.remove('sound-active');
    icon.className = 'fas fa-volume-mute';
    text.innerText = 'صوت التنبيه: معطّل';
    showToast('تم كتم التنبيه الصوتي');
  }
}

// Authentication Token Storage
function getAuthToken() {
  return localStorage.getItem('hatly_admin_token') || sessionStorage.getItem('hatly_admin_token') || '';
}

function setAuthToken(token) {
  localStorage.setItem('hatly_admin_token', token);
}

function clearAuthToken() {
  localStorage.removeItem('hatly_admin_token');
  sessionStorage.removeItem('hatly_admin_token');
}

function getAuthHeaders() {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function showLoginScreen(errorText = '') {
  const loginScreen = document.getElementById('adminLoginScreen');
  const mainApp = document.getElementById('adminMainApp');
  if (loginScreen) loginScreen.classList.remove('hidden');
  if (mainApp) mainApp.classList.add('hidden');
  
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  
  const errBox = document.getElementById('loginErrorMsg');
  const errTextEl = document.getElementById('loginErrorText');
  if (errorText && errBox && errTextEl) {
    errTextEl.innerText = errorText;
    errBox.classList.remove('hidden');
  } else if (errBox) {
    errBox.classList.add('hidden');
  }
  
  const passInput = document.getElementById('adminPasswordInput');
  if (passInput) {
    passInput.value = '';
    setTimeout(() => passInput.focus(), 100);
  }
}

function showDashboard() {
  const loginScreen = document.getElementById('adminLoginScreen');
  const mainApp = document.getElementById('adminMainApp');
  if (loginScreen) loginScreen.classList.add('hidden');
  if (mainApp) mainApp.classList.remove('hidden');
  
  loadOrders(false);
  loadStats();
  
  if (!pollInterval) {
    pollInterval = setInterval(() => {
      loadOrders(false);
      loadStats();
    }, 8000);
  }
}

function togglePasswordVisibility() {
  const passInput = document.getElementById('adminPasswordInput');
  const eyeIcon = document.getElementById('eyeIcon');
  if (!passInput) return;
  if (passInput.type === 'password') {
    passInput.type = 'text';
    if (eyeIcon) eyeIcon.className = 'far fa-eye-slash';
  } else {
    passInput.type = 'password';
    if (eyeIcon) eyeIcon.className = 'far fa-eye';
  }
}

async function handleAdminLogin(event) {
  if (event) event.preventDefault();
  const passInput = document.getElementById('adminPasswordInput');
  const errBox = document.getElementById('loginErrorMsg');
  const errTextEl = document.getElementById('loginErrorText');
  const submitBtn = document.getElementById('btnLoginSubmit');
  
  if (!passInput) return;
  const password = passInput.value.trim();
  
  if (!password) {
    if (errBox && errTextEl) {
      errTextEl.innerText = 'يرجى كتابة كلمة المرور للدخول!';
      errBox.classList.remove('hidden');
    }
    passInput.focus();
    return;
  }
  
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>جاري التحقق...</span>';
  }
  
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    
    const data = await res.json();
    if (res.ok && data.success && data.token) {
      setAuthToken(data.token);
      if (errBox) errBox.classList.add('hidden');
      showDashboard();
      showToast('مرحباً بك! تم تسجيل الدخول بنجاح');
    } else {
      if (errBox && errTextEl) {
        errTextEl.innerText = data.message || 'كلمة المرور غير صحيحة، يرجى المحاولة مرة أخرى!';
        errBox.classList.remove('hidden');
      }
      passInput.select();
      passInput.focus();
    }
  } catch (err) {
    if (errBox && errTextEl) {
      errTextEl.innerText = 'تعذر الاتصال بالخادم، يرجى التحقق من تشغيل السيرفر';
      errBox.classList.remove('hidden');
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> <span>دخول إلى لوحة التحكم</span>';
    }
  }
}

async function handleAdminLogout() {
  const token = getAuthToken();
  if (token) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: getAuthHeaders()
      });
    } catch (e) {}
  }
  clearAuthToken();
  showLoginScreen('تم تسجيل الخروج بنجاح');
  showToast('تم تسجيل الخروج من لوحة التحكم');
}

async function checkAuthOnLoad() {
  const token = getAuthToken();
  if (!token) {
    showLoginScreen();
    return;
  }
  
  try {
    const res = await fetch('/api/auth/verify', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (res.ok && data.success && data.authenticated) {
      showDashboard();
    } else {
      clearAuthToken();
      showLoginScreen();
    }
  } catch (err) {
    showLoginScreen();
  }
}

// Initialize on Load
document.addEventListener('DOMContentLoaded', () => {
  checkAuthOnLoad();
});

// Load orders from API
async function loadOrders(manual = false) {
  const refreshIcon = document.getElementById('refreshIcon');
  if (refreshIcon && manual) refreshIcon.classList.add('fa-spin');

  try {
    const res = await fetch('/api/orders', {
      headers: getAuthHeaders()
    });

    if (res.status === 401) {
      clearAuthToken();
      showLoginScreen('جلسة العمل منتهية، يرجى إدخال كلمة المرور مجدداً');
      return;
    }

    const data = await res.json();

    if (data.success && Array.isArray(data.orders)) {
      const newOrders = data.orders;

      // Check if new orders arrived (count increased)
      if (previousOrderCount !== null && newOrders.length > previousOrderCount) {
        const diff = newOrders.length - previousOrderCount;
        playNotificationChime();
        showToast(`🔔 تنبيه: وصل ${diff} طلب جديد الآن!`);
      }

      previousOrderCount = newOrders.length;
      allOrders = newOrders;
      
      updateCountsAndBadges();
      renderOrdersGrid();
    }
  } catch (err) {
    console.error('Failed to load orders:', err);
    // If backend unreachable, try localStorage
    try {
      const local = JSON.parse(localStorage.getItem('hatly_orders') || '[]');
      if (local.length > 0) {
        allOrders = local;
        updateCountsAndBadges();
        renderOrdersGrid();
      }
    } catch (e) {}
  } finally {
    if (refreshIcon && manual) {
      setTimeout(() => refreshIcon.classList.remove('fa-spin'), 600);
      showToast('تم تحديث قائمة الطلبات');
    }
  }
}

// Load statistics
async function loadStats() {
  try {
    const res = await fetch('/api/stats', {
      headers: getAuthHeaders()
    });
    if (res.status === 401) return;
    const data = await res.json();
    if (data.success && data.stats) {
      const s = data.stats;
      document.getElementById('kpiTotalOrders').innerText = s.totalOrders || 0;
      document.getElementById('kpiTodayOrders').innerText = s.todayOrders || 0;
      document.getElementById('kpiNewOrders').innerText = s.newCount || 0;
      document.getElementById('kpiActiveOrders').innerText = (s.processingCount + s.deliveringCount) || 0;
      document.getElementById('kpiDoneOrders').innerText = s.deliveredCount || 0;
    }
  } catch (e) {}
}

// Update filter counts
function updateCountsAndBadges() {
  const countAll = allOrders.length;
  const countNew = allOrders.filter(o => o.status === 'new').length;
  const countProc = allOrders.filter(o => o.status === 'processing').length;
  const countDeliv = allOrders.filter(o => o.status === 'delivering').length;
  const countDone = allOrders.filter(o => o.status === 'delivered').length;
  const countCanc = allOrders.filter(o => o.status === 'cancelled').length;

  document.getElementById('countAll').innerText = countAll;
  document.getElementById('countNew').innerText = countNew;
  document.getElementById('countProcessing').innerText = countProc;
  document.getElementById('countDelivering').innerText = countDeliv;
  document.getElementById('countDelivered').innerText = countDone;
  document.getElementById('countCancelled').innerText = countCanc;

  // Also update KPI cards
  const todayStr = new Date().toDateString();
  const todayOrders = allOrders.filter(o => o.createdAt && new Date(o.createdAt).toDateString() === todayStr);

  document.getElementById('kpiTotalOrders').innerText = countAll;
  document.getElementById('kpiTodayOrders').innerText = todayOrders.length;
  document.getElementById('kpiNewOrders').innerText = countNew;
  document.getElementById('kpiActiveOrders').innerText = countProc + countDeliv;
  document.getElementById('kpiDoneOrders').innerText = countDone;
}

// Render Orders Grid
function renderOrdersGrid() {
  const container = document.getElementById('ordersContainer');
  let filtered = [...allOrders];

  // Apply Status Filter
  if (currentFilter !== 'all') {
    filtered = filtered.filter(o => o.status === currentFilter);
  }

  // Apply Search
  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    filtered = filtered.filter(o => 
      (o.orderId && o.orderId.toLowerCase().includes(q)) ||
      (o.customerName && o.customerName.toLowerCase().includes(q)) ||
      (o.phone && o.phone.includes(q)) ||
      (o.orderDetails && o.orderDetails.toLowerCase().includes(q)) ||
      (o.address && o.address.toLowerCase().includes(q)) ||
      (Array.isArray(o.addresses) && o.addresses.some(a => a.toLowerCase().includes(q)))
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-inbox"></i>
        <h3>لا توجد طلبات مطابقة</h3>
        <p>لم يتم العثور على طلبات وفقاً للتصفية أو البحث الحالي.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(order => createOrderCardHtml(order)).join('');
}

// HTML generator for single order card
function createOrderCardHtml(order) {
  const isCombined = order.orderType === 'combined';
  const statusMap = {
    new: { text: 'طلب جديد', class: 'new', border: 'status-border-new' },
    processing: { text: 'قيد التجهيز', class: 'processing', border: 'status-border-processing' },
    delivering: { text: 'جاري التوصيل', class: 'delivering', border: 'status-border-delivering' },
    delivered: { text: 'تم التسليم', class: 'delivered', border: 'status-border-delivered' },
    cancelled: { text: 'ملغي', class: 'cancelled', border: 'status-border-cancelled' }
  };

  const statusInfo = statusMap[order.status] || statusMap.new;

  // Format customer phone for direct WhatsApp
  const cleanPhone = order.phone.replace(/[^0-9]/g, '');
  const waCustomerNumber = cleanPhone.startsWith('0') ? `2${cleanPhone}` : `20${cleanPhone}`;

  // Addresses markup
  let addressHtml = '';
  if (isCombined && Array.isArray(order.addresses) && order.addresses.length > 0) {
    addressHtml = order.addresses.map((a, i) => `
      <div class="address-item">
        <i class="fas fa-map-marker-alt address-icon"></i>
        <span><strong>مكان ${i + 1}:</strong> ${escapeHtml(a)}</span>
      </div>
    `).join('');
  } else {
    addressHtml = `
      <div class="address-item">
        <i class="fas fa-map-marker-alt address-icon"></i>
        <span>${escapeHtml(order.address || 'لم يتم تحديد عنوان')}</span>
      </div>
    `;
  }

  const noteHtml = order.orderNote ? `
    <div class="order-note-alert">
      <i class="fas fa-sticky-note"></i> <strong>ملاحظة:</strong> ${escapeHtml(order.orderNote)}
    </div>
  ` : '';

  return `
    <div class="order-card ${statusInfo.border}" id="card-${order.id || order.orderId}">
      <!-- Header -->
      <div class="order-card-header">
        <div class="order-id-group">
          <span class="order-id-badge" onclick="copyToClipboard('${order.orderId}')" title="انقر للنسخ">
            #${order.orderId}
            <i class="far fa-copy text-xs"></i>
          </span>
          <span class="order-time">${order.createdAtFormatted || 'الآن'}</span>
        </div>
        <span class="badge-status ${statusInfo.class}">${statusInfo.text}</span>
      </div>

      <!-- Customer details -->
      <div class="order-customer-box">
        <div class="customer-name-row">
          <span class="customer-name">${escapeHtml(order.customerName)}</span>
          <span class="delivery-badge-pill ${order.orderType}">
            ${isCombined ? `طلب مجمع (${(order.addresses || []).length} أماكن)` : 'طلب فردي'}
          </span>
        </div>
        <div class="customer-phone-row">
          <span class="phone-val">${order.phone}</span>
          <a href="tel:${order.phone}" class="quick-btn-phone" title="اتصال">
            <i class="fas fa-phone"></i> اتصال
          </a>
          <a href="https://wa.me/${waCustomerNumber}?text=مرحباً%20${encodeURIComponent(order.customerName)}،%20بخصوص%20طلبك%20رقم%20%23${order.orderId}%20من%20هاتلي" target="_blank" class="quick-btn-wa" title="واتساب">
            <i class="fab fa-whatsapp"></i> واتساب
          </a>
        </div>
      </div>

      <!-- Addresses -->
      <div class="order-address-box">
        ${addressHtml}
      </div>

      <!-- Items Details -->
      <div class="order-items-box">
        <div class="items-header"><i class="fas fa-shopping-bag"></i> المطلوب:</div>
        <div class="items-text">${escapeHtml(order.orderDetails)}</div>
        ${noteHtml}
      </div>

      <!-- Footer & Action Buttons -->
      <div class="order-card-footer">
        <div class="price-row">
          <span class="price-title">سعر التوصيل التقديري:</span>
          <span class="price-badge-est">${order.estimatedPriceText || '15 - 20 جنيه'}</span>
        </div>

        <div class="actions-row">
          <select class="status-select" onchange="changeOrderStatus('${order.id || order.orderId}', this.value)">
            <option value="new" ${order.status === 'new' ? 'selected' : ''}>🔵 جديد</option>
            <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>🟠 قيد التجهيز</option>
            <option value="delivering" ${order.status === 'delivering' ? 'selected' : ''}>🟣 جاري التوصيل</option>
            <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>🟢 تم التسليم</option>
            <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>⚪ ملغي</option>
          </select>

          <button class="btn-card-action" onclick="openDetailsModal('${order.orderId}')" title="عرض التفاصيل">
            <i class="fas fa-eye"></i>
          </button>
          
          <button class="btn-card-action" onclick="printOrderSlip('${order.orderId}')" title="طباعة بون">
            <i class="fas fa-print"></i>
          </button>

          <button class="btn-card-action btn-del" onclick="deleteOrder('${order.id || order.orderId}')" title="حذف الطلب">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </div>
    </div>
  `;
}

// Change Order Status
async function changeOrderStatus(id, newStatus) {
  try {
    const res = await fetch(`/api/orders/${id}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status: newStatus })
    });
    if (res.status === 401) {
      clearAuthToken();
      showLoginScreen('جلسة العمل منتهية، يرجى إدخال كلمة المرور مجدداً');
      return;
    }
    const data = await res.json();
    if (data.success) {
      showToast('تم تحديث حالة الطلب بنجاح');
      loadOrders();
    } else {
      showToast('فشل تحديث الحالة');
    }
  } catch (e) {
    // Local fallback
    const target = allOrders.find(o => o.id === id || o.orderId === id);
    if (target) {
      target.status = newStatus;
      renderOrdersGrid();
      updateCountsAndBadges();
      showToast('تم التحديث محلياً');
    }
  }
}

// Delete Order
async function deleteOrder(id) {
  if (!confirm('هل أنت متأكد من حذف هذا الطلب نهائياً؟')) return;

  try {
    const res = await fetch(`/api/orders/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (res.status === 401) {
      clearAuthToken();
      showLoginScreen('جلسة العمل منتهية، يرجى إدخال كلمة المرور مجدداً');
      return;
    }
    const data = await res.json();
    if (data.success) {
      showToast('تم حذف الطلب');
      loadOrders();
    }
  } catch (e) {
    allOrders = allOrders.filter(o => o.id !== id && o.orderId !== id);
    renderOrdersGrid();
    updateCountsAndBadges();
    showToast('تم الحذف');
  }
}

// Filter Tabs
function filterByStatus(status) {
  currentFilter = status;
  document.querySelectorAll('.filter-tab').forEach(t => {
    t.classList.toggle('active', t.getAttribute('data-status') === status);
  });
  renderOrdersGrid();
}

// Search Handler
function handleSearchInput() {
  const input = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearSearchBtn');
  currentSearch = input.value.trim();
  clearBtn.classList.toggle('hidden', currentSearch.length === 0);
  renderOrdersGrid();
}

function clearSearch() {
  const input = document.getElementById('searchInput');
  input.value = '';
  currentSearch = '';
  document.getElementById('clearSearchBtn').classList.add('hidden');
  renderOrdersGrid();
}

// Details Modal
function openDetailsModal(orderId) {
  const order = allOrders.find(o => o.orderId === orderId);
  if (!order) return;
  currentViewingOrder = order;

  document.getElementById('detOrderIdTitle').innerText = `طلب #${order.orderId}`;
  const badge = document.getElementById('detStatusBadge');
  badge.className = `badge-status ${order.status}`;
  badge.innerText = order.status === 'new' ? 'جديد' : (order.status === 'processing' ? 'قيد التجهيز' : (order.status === 'delivering' ? 'جاري التوصيل' : (order.status === 'delivered' ? 'تم التسليم' : 'ملغي')));

  const content = document.getElementById('detModalContent');
  const isCombined = order.orderType === 'combined';

  let addressesList = '';
  if (isCombined && order.addresses && order.addresses.length > 0) {
    addressesList = order.addresses.map((a, i) => `<li><strong>مكان ${i+1}:</strong> ${escapeHtml(a)}</li>`).join('');
  } else {
    addressesList = `<li>${escapeHtml(order.address || 'لم يحدد')}</li>`;
  }

  content.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:14px; font-size:14px;">
      <div><strong>العميل:</strong> ${escapeHtml(order.customerName)}</div>
      <div><strong>رقم الموبايل:</strong> <a href="tel:${order.phone}">${order.phone}</a></div>
      <div><strong>نوع التوصيل:</strong> ${isCombined ? `طلب مجمع (${(order.addresses || []).length} أماكن)` : 'طلب فردي (عنوان واحد)'}</div>
      <div>
        <strong>العنوان / العناوين:</strong>
        <ul style="padding-right:20px; margin-top:6px;">${addressesList}</ul>
      </div>
      <div>
        <strong>تفاصيل الطلب:</strong>
        <div style="background:#f8fafc; padding:10px; border-radius:8px; border:1px solid #e2e8f0; margin-top:6px; white-space:pre-line;">
          ${escapeHtml(order.orderDetails)}
        </div>
      </div>
      ${order.orderNote ? `
        <div style="background:#fffbeb; padding:10px; border-radius:8px; border:1px solid #fde68a;">
          <strong>ملاحظات:</strong> ${escapeHtml(order.orderNote)}
        </div>
      ` : ''}
      <div><strong>التوصيل التقديري:</strong> <span style="color:#b45309; font-weight:800;">${order.estimatedPriceText}</span></div>
      <div><strong>توقيت التسجيل:</strong> ${order.createdAtFormatted || order.createdAt}</div>
    </div>
  `;

  document.getElementById('orderDetailsModal').classList.remove('hidden');
}

function closeDetailsModal() {
  document.getElementById('orderDetailsModal').classList.add('hidden');
  currentViewingOrder = null;
}

function printCurrentOrder() {
  if (currentViewingOrder) {
    printOrderSlip(currentViewingOrder.orderId);
  }
}

// Print Delivery Slip (Thermal Receipt Format)
function printOrderSlip(orderId) {
  const order = allOrders.find(o => o.orderId === orderId);
  if (!order) return;

  const slipContainer = document.getElementById('printableSlip');
  const isCombined = order.orderType === 'combined';

  let addressesPrint = '';
  if (isCombined && order.addresses && order.addresses.length > 0) {
    addressesPrint = order.addresses.map((a, i) => `<div>• مكان ${i+1}: ${escapeHtml(a)}</div>`).join('');
  } else {
    addressesPrint = `<div>${escapeHtml(order.address || '-')}</div>`;
  }

  slipContainer.innerHTML = `
    <div class="slip-header">
      <h2>شركة هاتلي HATTLY</h2>
      <div>سرعة.. دقة.. توصيل 🛵</div>
      <div>01130944299 - 01130944399</div>
    </div>

    <div class="slip-row">
      <span><strong>رقم الطلب:</strong></span>
      <span>#${order.orderId}</span>
    </div>
    <div class="slip-row">
      <span><strong>التاريخ والوقت:</strong></span>
      <span>${order.createdAtFormatted || new Date().toLocaleString('ar-EG')}</span>
    </div>

    <div class="slip-divider"></div>

    <div class="slip-row">
      <span><strong>العميل:</strong></span>
      <span>${escapeHtml(order.customerName)}</span>
    </div>
    <div class="slip-row">
      <span><strong>الموبايل:</strong></span>
      <span style="direction:ltr;">${order.phone}</span>
    </div>
    <div class="slip-row">
      <span><strong>النوع:</strong></span>
      <span>${isCombined ? 'طلب مجمع' : 'طلب فردي'}</span>
    </div>

    <div style="margin: 6px 0;">
      <strong>العنوان:</strong>
      ${addressesPrint}
    </div>

    <div class="slip-divider"></div>

    <div><strong>الطلب:</strong></div>
    <div class="slip-items">${escapeHtml(order.orderDetails)}</div>

    ${order.orderNote ? `
      <div style="margin: 4px 0;">
        <strong>ملاحظة العميل:</strong> ${escapeHtml(order.orderNote)}
      </div>
    ` : ''}

    <div class="slip-divider"></div>

    <div class="slip-row" style="font-size:14px; font-weight:bold;">
      <span>سعر التوصيل:</span>
      <span>${order.estimatedPriceText}</span>
    </div>

    <div class="slip-footer">
      <div>شكراً لاختياركم هاتلي! نتمنى لكم يوماً سعيداً 🛵</div>
    </div>
  `;

  window.print();
}

// Settings Modal
async function openSettingsModal() {
  try {
    const res = await fetch('/api/settings', {
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (data.success && data.settings) {
      const s = data.settings;
      if (document.getElementById('setCompanyName')) document.getElementById('setCompanyName').value = s.companyName || '';
      if (document.getElementById('setSlogan')) document.getElementById('setSlogan').value = s.slogan || '';
      if (document.getElementById('setTagline')) document.getElementById('setTagline').value = s.tagline || '';

      if (document.getElementById('setPhone1')) document.getElementById('setPhone1').value = s.phone1 || '';
      if (document.getElementById('setPhone2')) document.getElementById('setPhone2').value = s.phone2 || '';
      if (document.getElementById('setWhatsapp')) document.getElementById('setWhatsapp').value = s.whatsappNumber || '';
      if (document.getElementById('setWhatsapp2')) document.getElementById('setWhatsapp2').value = s.whatsappNumber2 || '';

      if (document.getElementById('setPriceMin')) document.getElementById('setPriceMin').value = s.priceMin ?? 15;
      if (document.getElementById('setPriceMax')) document.getElementById('setPriceMax').value = s.priceMax ?? 20;
      if (document.getElementById('setExtraFee')) document.getElementById('setExtraFee').value = s.extraAddressFee ?? 5;
      if (document.getElementById('setCurrency')) document.getElementById('setCurrency').value = s.currency || 'جنيه';

      if (document.getElementById('setWorkHoursStart')) document.getElementById('setWorkHoursStart').value = s.workHoursStart || '07:00';
      if (document.getElementById('setWorkHoursEnd')) document.getElementById('setWorkHoursEnd').value = s.workHoursEnd || '04:00';
      if (document.getElementById('setWorkHoursNote')) document.getElementById('setWorkHoursNote').value = s.workHoursNote || '';
      if (document.getElementById('setIsStoreOpenManual')) document.getElementById('setIsStoreOpenManual').value = s.isStoreOpenManual || 'auto';
      if (document.getElementById('setClosedMessage')) document.getElementById('setClosedMessage').value = s.closedMessage || '';

      if (document.getElementById('setAnnouncementActive')) document.getElementById('setAnnouncementActive').checked = Boolean(s.announcementActive);
      if (document.getElementById('setAnnouncementBanner')) document.getElementById('setAnnouncementBanner').value = s.announcementBanner || '';
    }
  } catch (e) {}

  const passField = document.getElementById('setAdminPassword');
  if (passField) passField.value = '';

  document.getElementById('settingsModal').classList.remove('hidden');
}

function closeSettingsModal() {
  document.getElementById('settingsModal').classList.add('hidden');
}

async function saveSettings(e) {
  e.preventDefault();
  const payload = {
    companyName: document.getElementById('setCompanyName')?.value?.trim() || 'هاتلي | Hattly',
    slogan: document.getElementById('setSlogan')?.value?.trim() || 'سرعة.. دقة.. توصيل 🛵',
    tagline: document.getElementById('setTagline')?.value?.trim() || '',
    phone1: document.getElementById('setPhone1')?.value?.trim() || '',
    phone2: document.getElementById('setPhone2')?.value?.trim() || '',
    whatsappNumber: document.getElementById('setWhatsapp')?.value?.trim() || '',
    whatsappNumber2: document.getElementById('setWhatsapp2')?.value?.trim() || '',
    priceMin: Number(document.getElementById('setPriceMin')?.value || 15),
    priceMax: Number(document.getElementById('setPriceMax')?.value || 20),
    extraAddressFee: Number(document.getElementById('setExtraFee')?.value || 5),
    currency: document.getElementById('setCurrency')?.value?.trim() || 'جنيه',
    workHoursStart: document.getElementById('setWorkHoursStart')?.value?.trim() || '07:00',
    workHoursEnd: document.getElementById('setWorkHoursEnd')?.value?.trim() || '04:00',
    workHoursNote: document.getElementById('setWorkHoursNote')?.value?.trim() || '',
    isStoreOpenManual: document.getElementById('setIsStoreOpenManual')?.value || 'auto',
    closedMessage: document.getElementById('setClosedMessage')?.value?.trim() || '',
    announcementActive: Boolean(document.getElementById('setAnnouncementActive')?.checked),
    announcementBanner: document.getElementById('setAnnouncementBanner')?.value?.trim() || ''
  };

  const newPass = document.getElementById('setAdminPassword')?.value?.trim();
  if (newPass) {
    payload.adminPassword = newPass;
  }

  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    if (res.status === 401) {
      clearAuthToken();
      showLoginScreen('جلسة العمل منتهية، يرجى إدخال كلمة المرور مجدداً');
      return;
    }
    const data = await res.json();
    if (data.success) {
      showToast(newPass ? 'تم حفظ كافة الإعدادات وتحديث كلمة المرور بنجاح!' : 'تم حفظ كافة التعديلات بنجاح!');
      closeSettingsModal();
    }
  } catch (err) {
    showToast('فشل حفظ الإعدادات');
  }
}

// Utilities
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(`تم نسخ رقم الطلب #${text}`);
  }).catch(() => {
    showToast(`رقم الطلب #${text}`);
  });
}

function showToast(msg) {
  const toast = document.getElementById('adminToast');
  if (!toast) return;
  toast.innerText = msg;
  toast.classList.remove('hidden');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 3500);
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
