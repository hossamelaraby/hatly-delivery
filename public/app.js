// Hatly Delivery - Customer Frontend Logic

let currentOrderType = 'individual'; // 'individual' or 'combined'
let appSettings = {
  phone1: "01130944299",
  phone2: "01130944399",
  whatsappNumber: "201130944299",
  whatsappNumber2: "201130944399",
  priceMin: 15,
  priceMax: 20,
  extraAddressFee: 5,
  workHoursStart: 7, // 7 AM
  workHoursEnd: 4    // 4 AM (next day)
};

let deferredPwaPrompt = null;

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('SW registration error:', err);
    });
  });
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPwaPrompt = e;
  const btn = document.getElementById('btnInstallApp');
  if (btn) btn.style.display = 'inline-flex';
});

function handleDirectAppDownload(event) {
  // Let the browser naturally trigger the download of /download/hatly.apk
  showToast('بدأ تحميل تطبيق هاتلي (Hatly.apk) فوراً على جهازك! 📲');
  setTimeout(() => {
    const modal = document.getElementById('installAppModal');
    if (modal) modal.classList.remove('hidden');
  }, 1000);
}

function triggerAppInstall() {
  const modal = document.getElementById('installAppModal');
  if (modal) modal.classList.remove('hidden');
}

function executePwaInstall() {
  if (deferredPwaPrompt) {
    deferredPwaPrompt.prompt();
    deferredPwaPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        showToast('جاري تثبيت تطبيق هاتلي على جهازك بنجاح! 📲');
        closeInstallModal();
      }
      deferredPwaPrompt = null;
    });
  } else {
    showToast('📱 يمكنك أيضاً الضغط على قائمة المتصفح (⋮) ثم اختيار "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية"');
  }
}

function trackApkDownload() {
  showToast('بدأ تحميل ملف التطبيق Hatly.apk لجهازك الآن بنجاح! 📥');
}

function closeInstallModal() {
  const modal = document.getElementById('installAppModal');
  if (modal) modal.classList.add('hidden');
}

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  fetchSettings();
  checkWorkingHours();
  updatePriceDisplay();
  setupFormValidation();
  setupAutoCapitalizeAndPhone();

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('install') === 'app') {
    triggerAppInstall();
  }
});

// Fetch current dynamic settings from server
async function fetchSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (data.success && data.settings) {
      appSettings = { ...appSettings, ...data.settings };
      applyDynamicSettings();
    }
  } catch (e) {
    console.log('Using default client settings');
  }
}

// Apply settings to UI elements
function applyDynamicSettings() {
  updatePriceDisplay();
  checkWorkingHours();

  // Update Brand texts if elements exist
  const brandTitles = document.querySelectorAll('.brand-title, .mobile-brand-title, .app-brand-name');
  brandTitles.forEach(el => {
    if (appSettings.companyName) el.innerHTML = `${escapeHtml(appSettings.companyName)} <span style="color:#eab308;">💛</span>`;
  });

  const brandHighlights = document.querySelectorAll('.brand-highlight, .mobile-brand-desc');
  brandHighlights.forEach(el => {
    if (appSettings.slogan) el.innerText = appSettings.slogan;
  });

  const brandSubtexts = document.querySelectorAll('.brand-subtext');
  brandSubtexts.forEach(el => {
    if (appSettings.tagline) el.innerText = appSettings.tagline;
  });

  // Update Phone buttons & links
  if (appSettings.phone1) {
    document.querySelectorAll('a[href^="tel:"]').forEach((link, idx) => {
      const p = (idx % 2 === 0) ? appSettings.phone1 : (appSettings.phone2 || appSettings.phone1);
      link.href = `tel:${p}`;
      const span = link.querySelector('span');
      if (span && !span.innerText.includes('اتصال')) {
        span.innerText = p;
      }
    });
  }

  // Update WhatsApp links
  if (appSettings.whatsappNumber) {
    document.querySelectorAll('a[href*="wa.me"]').forEach(link => {
      const cleanWa = appSettings.whatsappNumber.replace(/\D/g, '');
      const originalText = link.href.split('text=')[1] || encodeURIComponent('مرحباً هاتلي، أريد طلب توصيل');
      link.href = `https://wa.me/${cleanWa}?text=${originalText}`;
    });
  }

  // Announcement Bar
  renderAnnouncementBar();
}

function renderAnnouncementBar() {
  let bar = document.getElementById('topAnnouncementBar');
  if (appSettings.announcementActive && appSettings.announcementBanner) {
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'topAnnouncementBar';
      bar.style.cssText = 'background: linear-gradient(90deg, #f59e0b, #d97706); color: #ffffff; text-align: center; padding: 7px 14px; font-size: 13px; font-weight: 800; position: relative; z-index: 100; box-shadow: 0 2px 6px rgba(0,0,0,0.1);';
      document.body.insertBefore(bar, document.body.firstChild);
    }
    bar.innerHTML = `<i class="fas fa-bullhorn" style="margin-left:6px;"></i> ${escapeHtml(appSettings.announcementBanner)}`;
    bar.style.display = 'block';
  } else if (bar) {
    bar.style.display = 'none';
  }
}

// Live Working Hours check
function checkWorkingHours() {
  const dot = document.querySelector('.status-indicator-dot');
  const text = document.getElementById('workStatusText');
  if (!dot || !text) return;

  const mode = appSettings.isStoreOpenManual || 'auto';

  if (mode === 'open') {
    dot.className = 'status-indicator-dot online';
    text.innerText = appSettings.workHoursNote ? `نستقبل طلباتكم الآن (${appSettings.workHoursNote})` : 'نستقبل طلباتكم الآن 🛵';
    return;
  }

  if (mode === 'closed') {
    dot.className = 'status-indicator-dot offline';
    text.innerText = appSettings.closedMessage || 'المتجر مغلق مؤقتاً حالياً';
    return;
  }

  // Auto mode
  const now = new Date();
  const hour = now.getHours();
  const startHour = appSettings.workHoursStart ? parseInt(appSettings.workHoursStart) : 7;
  const endHour = appSettings.workHoursEnd ? parseInt(appSettings.workHoursEnd) : 4;

  const isOpen = (startHour > endHour) 
    ? (hour >= startHour || hour < endHour)
    : (hour >= startHour && hour < endHour);

  if (isOpen) {
    dot.className = 'status-indicator-dot online';
    text.innerText = appSettings.workHoursNote ? `نستقبل طلباتكم الآن (${appSettings.workHoursNote})` : 'نستقبل طلباتكم الآن (من 7:00 ص حتى 4:00 فجراً)';
  } else {
    dot.className = 'status-indicator-dot offline';
    text.innerText = appSettings.workHoursNote ? `خارج أوقات العمل الرسمية حالياً (${appSettings.workHoursNote})` : 'خارج أوقات العمل الرسمية حالياً';
  }
}

// Toggle delivery type (Individual vs Combined)
function setOrderType(type) {
  currentOrderType = type;
  const btnInd = document.getElementById('btnIndividual');
  const btnComb = document.getElementById('btnCombined');
  const singleSection = document.getElementById('singleAddressSection');
  const multiSection = document.getElementById('multiAddressSection');
  const singleAddressInput = document.getElementById('address');

  if (type === 'individual') {
    btnInd.classList.add('active');
    btnComb.classList.remove('active');
    singleSection.classList.remove('hidden');
    multiSection.classList.add('hidden');
    singleAddressInput.required = true;
  } else {
    btnComb.classList.add('active');
    btnInd.classList.remove('active');
    singleSection.classList.add('hidden');
    multiSection.classList.remove('hidden');
    singleAddressInput.required = false;
  }

  updatePriceDisplay();
}

// Calculate and render estimated delivery price
function calculateDeliveryPrice() {
  const baseMin = Number(appSettings.priceMin) || 15;
  const baseMax = Number(appSettings.priceMax) || 20;
  const extraFeePerStop = Number(appSettings.extraAddressFee) || 5;

  if (currentOrderType === 'individual') {
    return {
      min: baseMin,
      max: baseMax,
      extraStops: 0,
      extraFee: 0,
      text: `من ${baseMin} إلى ${baseMax} جنيه`
    };
  } else {
    // Combined order: count address rows
    const rows = document.querySelectorAll('.address-row');
    const totalLocations = Math.max(rows.length, 2);
    const extraStops = totalLocations - 1; // 1st is base, each additional adds 5 EGP
    const extraFee = extraStops * extraFeePerStop;

    const min = baseMin + extraFee;
    const max = baseMax + extraFee;

    return {
      min,
      max,
      extraStops,
      extraFee,
      text: `من ${min} إلى ${max} جنيه`
    };
  }
}

function updatePriceDisplay() {
  const calc = calculateDeliveryPrice();
  const pricePill = document.getElementById('estimatedPricePill');
  const priceSubtext = document.getElementById('priceSubtext');
  const extraBadge = document.getElementById('extraFeeBadge');

  if (pricePill) {
    pricePill.innerText = calc.text;
  }

  if (currentOrderType === 'individual') {
    if (priceSubtext) {
      priceSubtext.innerText = `التوصيل الفردي من ${calc.min} لـ ${calc.max} جنيه — والطلب المجمع يزيد ${appSettings.extraAddressFee} جنيه لكل مكان إضافي.`;
    }
  } else {
    if (extraBadge) {
      extraBadge.innerText = `+${calc.extraFee} جنيه إضافي (${calc.extraStops} مكان إضافي)`;
    }
    if (priceSubtext) {
      priceSubtext.innerText = `طلب مجمع: يشمل ${calc.extraStops + 1} أماكن/عناوين (+${calc.extraFee} جنيه زيادة عن السعر الأساسي).`;
    }
  }
}

// Add new address row for Combined Orders
function addAddressRow() {
  const container = document.getElementById('addressInputsList');
  const currentCount = container.querySelectorAll('.address-row').length;
  const newIndex = currentCount + 1;

  const row = document.createElement('div');
  row.className = 'address-row';
  row.setAttribute('data-index', currentCount);
  row.innerHTML = `
    <span class="address-tag extra-tag">المكان ${newIndex} (+5 ج)</span>
    <input 
      type="text" 
      class="form-input multi-address-field" 
      placeholder="المكان ${newIndex}: الشارع، المحل، أو العنوان بالتفصيل..." 
      required
    >
    <button type="button" class="btn-remove-row" onclick="removeAddressRow(this)" title="حذف">
      <i class="fas fa-trash-alt"></i>
    </button>
  `;

  container.appendChild(row);
  updatePriceDisplay();
}

// Remove address row
function removeAddressRow(btn) {
  const container = document.getElementById('addressInputsList');
  const rows = container.querySelectorAll('.address-row');
  if (rows.length <= 2) {
    showToast('يجب إدخال عنوانين على الأقل في الطلب المجمع');
    return;
  }

  const row = btn.closest('.address-row');
  row.remove();

  // Re-index remaining rows
  const remaining = container.querySelectorAll('.address-row');
  remaining.forEach((r, idx) => {
    const tag = r.querySelector('.address-tag');
    if (idx === 0) {
      tag.className = 'address-tag base-tag';
      tag.innerText = 'المكان 1 (الأساسي)';
    } else {
      tag.className = 'address-tag extra-tag';
      tag.innerText = `المكان ${idx + 1} (+5 ج)`;
    }
  });

  updatePriceDisplay();
}

// Location detection
function detectLocation() {
  if (!navigator.geolocation) {
    showToast('خاصية تحديد الموقع غير مدعومة في متصفحك');
    return;
  }

  showToast('جاري تحديد موقعك الحالي...');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude.toFixed(5);
      const lng = pos.coords.longitude.toFixed(5);
      const addressInput = document.getElementById('address');
      addressInput.value = `موقعي الجغرافي (GPS: ${lat}, ${lng}) - `;
      addressInput.focus();
      showToast('تم تحديد الموقع! يمكنك استكمال اسم الشارع والعمارة');
    },
    (err) => {
      showToast('تعذر الوصول إلى الموقع تلقائياً. برجاء كتابة العنوان يدوياً');
    },
    { timeout: 10000 }
  );
}

// Phone input formatting & validation
function setupAutoCapitalizeAndPhone() {
  const phoneInput = document.getElementById('phone');
  if (phoneInput) {
    phoneInput.addEventListener('input', (e) => {
      // Keep only numbers
      e.target.value = e.target.value.replace(/[^0-9]/g, '');
    });
  }
}

// Form validation setup
function setupFormValidation() {
  const form = document.getElementById('orderForm');
  form.addEventListener('submit', handleFormSubmit);
}

// Handle Form Submission
async function handleFormSubmit(e) {
  e.preventDefault();

  const customerNameInput = document.getElementById('customerName');
  const phoneInput = document.getElementById('phone');
  const orderDetailsInput = document.getElementById('orderDetails');
  const orderNoteInput = document.getElementById('orderNote');
  const singleAddressInput = document.getElementById('address');

  let isValid = true;

  // Clear previous errors
  document.querySelectorAll('.form-group').forEach(el => el.classList.remove('has-error'));

  // Validate Name
  const customerName = customerNameInput.value.trim();
  if (!customerName || customerName.length < 2) {
    customerNameInput.closest('.form-group').classList.add('has-error');
    isValid = false;
  }

  // Validate Phone
  const phone = phoneInput.value.trim();
  const egyptianPhoneRegex = /^01[0125][0-9]{8}$/;
  if (!phone || !egyptianPhoneRegex.test(phone)) {
    phoneInput.closest('.form-group').classList.add('has-error');
    isValid = false;
  }

  // Validate Addresses
  let address = '';
  let addresses = [];

  if (currentOrderType === 'individual') {
    address = singleAddressInput.value.trim();
    if (!address || address.length < 3) {
      singleAddressInput.closest('.form-group').classList.add('has-error');
      isValid = false;
    }
  } else {
    const multiInputs = document.querySelectorAll('.multi-address-field');
    multiInputs.forEach(input => {
      const val = input.value.trim();
      if (val) {
        addresses.push(val);
      }
    });

    if (addresses.length < 2) {
      showToast('برجاء كتابة عنوانين على الأقل للطلب المجمع');
      isValid = false;
    }
  }

  // Validate Order Details
  const orderDetails = orderDetailsInput.value.trim();
  if (!orderDetails || orderDetails.length < 2) {
    orderDetailsInput.closest('.form-group').classList.add('has-error');
    isValid = false;
  }

  const orderNote = orderNoteInput.value.trim();

  if (!isValid) {
    showToast('برجاء مراجعة الحقول المطلوبة والمميزة باللون الأحمر');
    return;
  }

  // Submit process
  const submitBtn = document.getElementById('submitBtn');
  const originalBtnHtml = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span>جاري تسجيل الطلب...</span>`;

  const calcPrice = calculateDeliveryPrice();

  const payload = {
    customerName,
    phone,
    orderType: currentOrderType,
    address,
    addresses,
    orderDetails,
    orderNote,
    estimatedPriceText: calcPrice.text,
    estimatedPriceValue: { min: calcPrice.min, max: calcPrice.max }
  };

  let savedOrder = null;

  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (result.success && result.order) {
      savedOrder = result.order;
    }
  } catch (err) {
    console.warn('Network error saving to server, saving locally:', err);
  }

  // Fallback if offline or local server error
  if (!savedOrder) {
    const fallbackId = `HT-${Date.now().toString().slice(-6)}`;
    savedOrder = {
      ...payload,
      orderId: fallbackId,
      createdAtFormatted: new Date().toLocaleString('ar-EG')
    };

    // Save in localStorage for resilience
    try {
      const localOrders = JSON.parse(localStorage.getItem('hatly_orders') || '[]');
      localOrders.unshift(savedOrder);
      localStorage.setItem('hatly_orders', JSON.stringify(localOrders));
    } catch (e) {}
  }

  submitBtn.disabled = false;
  submitBtn.innerHTML = originalBtnHtml;

  // Build WhatsApp text message with order code & full order summary
  const whatsappMessage = buildWhatsAppMessage(savedOrder);
  window.currentWhatsAppMessageText = whatsappMessage;
  
  const targetWhatsapp = appSettings.whatsappNumber || "201130944299";
  const whatsappUrl = `https://wa.me/${targetWhatsapp}?text=${encodeURIComponent(whatsappMessage)}`;

  // Show Success Modal on screen
  showSuccessModal(savedOrder, whatsappUrl);

  // Directly redirect to WhatsApp (using window.location so mobile browsers never block it)
  setTimeout(() => {
    try {
      window.location.href = whatsappUrl;
    } catch (e) {
      window.open(whatsappUrl, '_blank');
    }
  }, 600);
}

// Build neatly formatted WhatsApp text message with complete order details
function buildWhatsAppMessage(order) {
  const isCombined = order.orderType === 'combined';
  let addressText = '';

  if (isCombined && order.addresses && order.addresses.length > 0) {
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
    addressText = order.addresses.map((a, i) => {
      const numEmoji = emojis[i] || `📍 ${i + 1}`;
      const stopLabel = i === 0 ? 'المكان الأول (الأساسي)' : `المكان ${i + 1} (+${appSettings.extraAddressFee || 5} ج)`;
      return `${numEmoji} *${stopLabel}:*\n   ${a}`;
    }).join('\n\n');
  } else {
    addressText = `📍 *العنوان بالتفصيل:*\n   ${order.address || 'لم يحدد'}`;
  }

  // Format order note if available
  let noteSection = '';
  if (order.orderNote && order.orderNote.trim()) {
    noteSection = `\n📝 *ملاحظات الطلب:*\n${order.orderNote.trim()}\n`;
  }

  const deliveryTypeTitle = isCombined 
    ? `طلب مجمع (${(order.addresses || []).length} أماكن)` 
    : 'طلب فردي (عنوان واحد)';

  return `🛵 *طلب توصيل جديد - شركة هاتلي (Hattly)*
━━━━━━━━━━━━━━━━━━━━
📋 *رقم الأوردر:* #${order.orderId}
⏰ *توقيت الطلب:* ${order.createdAtFormatted || new Date().toLocaleString('ar-EG')}
━━━━━━━━━━━━━━━━━━━━
👤 *بيانات العميل:*
• *الاسم:* ${order.customerName}
• *رقم الموبايل:* ${order.phone}
• *نوع التوصيل:* ${deliveryTypeTitle}

${addressText}

🛒 *تفاصيل ومحتويات الطلب:*
------------------------------------
${order.orderDetails.trim()}
------------------------------------${noteSection}
💰 *قيمة التوصيل المتوقعة:* ${order.estimatedPriceText}
━━━━━━━━━━━━━━━━━━━━
يرجى تأكيد استلام الطلب وتعيين الكابتن للتنفيذ فوراً 🛵💛`;
}

// Show success modal
function showSuccessModal(order, whatsappUrl) {
  const modal = document.getElementById('successModal');
  document.getElementById('modalOrderId').innerText = `#${order.orderId}`;
  document.getElementById('modalCustomerName').innerText = order.customerName;
  document.getElementById('modalPhone').innerText = order.phone;
  document.getElementById('modalOrderType').innerText = order.orderType === 'combined' ? 'طلب مجمع (أكثر من عنوان)' : 'طلب فردي (عنوان واحد)';
  document.getElementById('modalEstimatedPrice').innerText = order.estimatedPriceText;

  const detBox = document.getElementById('modalOrderDetails');
  if (detBox) {
    let text = order.orderDetails;
    if (order.orderNote && order.orderNote.trim()) {
      text += `\n(ملاحظة: ${order.orderNote.trim()})`;
    }
    detBox.innerText = text;
  }

  const waLink = document.getElementById('modalWhatsappLink');
  waLink.href = whatsappUrl;

  modal.classList.remove('hidden');
}

// Close success modal & reset form
function closeSuccessModal() {
  const modal = document.getElementById('successModal');
  modal.classList.add('hidden');
  document.getElementById('orderForm').reset();
  setOrderType('individual');
}

// Copy full WhatsApp order message to clipboard
function copyOrderWhatsAppMessage() {
  if (!window.currentWhatsAppMessageText) return;
  navigator.clipboard.writeText(window.currentWhatsAppMessageText).then(() => {
    showToast('تم نسخ نص رسالة الطلب بالكامل!');
  }).catch(() => {
    showToast('تم تحديد نص الرسالة للنسخ');
  });
}

// Toast notification helper
function showToast(message) {
  const toast = document.getElementById('toastMessage');
  if (!toast) return;
  toast.innerText = message;
  toast.classList.remove('hidden');
  clearTimeout(window._toastTimeout);
  window._toastTimeout = setTimeout(() => {
    toast.classList.add('hidden');
  }, 3500);
}
