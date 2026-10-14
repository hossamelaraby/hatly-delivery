const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let supabase = null;
try {
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });
  }
} catch (e) {
  console.error('[DB] Failed to initialize Supabase client:', e);
}

// Local File Paths
const DATA_DIR = path.join(process.cwd(), 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

// Ensure local data directory
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {}

const defaultSettings = {
  companyName: "هاتلي | Hattly",
  slogan: "سرعة.. دقة.. توصيل 🛵",
  tagline: "هاتلي... البراند اللي بيقربلك كل اللي محتاجه! مشوار أسهل، وقت أوفر، وطلبك لحد بابك.",
  phone1: "01130944299",
  phone2: "01130944399",
  whatsappNumber: "201130944299",
  whatsappNumber2: "201130944399",
  priceMin: 15,
  priceMax: 20,
  extraAddressFee: 5,
  currency: "جنيه",
  workHoursStart: "07:00",
  workHoursEnd: "04:00",
  workHoursNote: "من 7:00 صباحاً وحتى 4:00 بعد منتصف الليل",
  isStoreOpenManual: "auto", // 'auto' | 'open' | 'closed'
  closedMessage: "نعتذر، المتجر مغلق مؤقتاً لاستقبال الطلبات حالياً",
  announcementBanner: "",
  announcementActive: false,
  adminPassword: "hatly2026"
};

// Safe JSON reading
function readLocalJson(filePath, fallback = {}) {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error(`[DB] Error reading ${filePath}:`, err.message);
  }
  return fallback;
}

// Safe JSON writing
function writeLocalJson(filePath, data) {
  try {
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    console.error(`[DB] Error writing ${filePath}:`, err.message);
  }
}

// In-memory cache for serverless environments (where fs is ephemeral)
let memoryOrders = null;
let memorySettings = null;

// Track if Supabase tables exist
let supabaseTablesAvailable = {
  settings: null,
  orders: null
};

// Helper to convert snake_case to camelCase
function rowToOrder(row) {
  if (!row) return null;
  return {
    id: row.id,
    orderId: row.order_id || row.orderId,
    customerName: row.customer_name || row.customerName,
    phone: row.phone,
    orderType: row.order_type || row.orderType || 'individual',
    address: row.address || '',
    addresses: row.addresses || [],
    orderDetails: row.order_details || row.orderDetails,
    orderNote: row.order_note || row.orderNote || '',
    estimatedPriceText: row.estimated_price_text || row.estimatedPriceText || 'من 15 إلى 20 جنيه',
    estimatedPriceValue: row.estimated_price_value || row.estimatedPriceValue || { min: 15, max: 20 },
    status: row.status || 'new',
    driverName: row.driver_name || row.driverName || '',
    adminNotes: row.admin_notes || row.adminNotes || '',
    createdAt: row.created_at || row.createdAt,
    createdAtFormatted: row.created_at_formatted || row.createdAtFormatted || ''
  };
}

function orderToRow(order) {
  return {
    id: String(order.id),
    order_id: String(order.orderId),
    customer_name: order.customerName,
    phone: order.phone,
    order_type: order.orderType || 'individual',
    address: order.address || '',
    addresses: order.addresses || [],
    order_details: order.orderDetails,
    order_note: order.orderNote || '',
    estimated_price_text: order.estimatedPriceText || '',
    estimated_price_value: order.estimatedPriceValue || {},
    status: order.status || 'new',
    driver_name: order.driverName || '',
    admin_notes: order.adminNotes || '',
    created_at: order.createdAt || new Date().toISOString()
  };
}

function rowToSettings(row) {
  if (!row) return defaultSettings;
  return {
    ...defaultSettings,
    companyName: row.company_name || row.companyName || defaultSettings.companyName,
    slogan: row.slogan || defaultSettings.slogan,
    tagline: row.tagline || defaultSettings.tagline,
    phone1: row.phone1 || defaultSettings.phone1,
    phone2: row.phone2 || defaultSettings.phone2,
    whatsappNumber: row.whatsapp_number || row.whatsappNumber || defaultSettings.whatsappNumber,
    whatsappNumber2: row.whatsapp_number2 || row.whatsappNumber2 || defaultSettings.whatsappNumber2,
    priceMin: Number(row.price_min ?? row.priceMin ?? defaultSettings.priceMin),
    priceMax: Number(row.price_max ?? row.priceMax ?? defaultSettings.priceMax),
    extraAddressFee: Number(row.extra_address_fee ?? row.extraAddressFee ?? defaultSettings.extraAddressFee),
    currency: row.currency || defaultSettings.currency,
    workHoursStart: row.work_hours_start || row.workHoursStart || defaultSettings.workHoursStart,
    workHoursEnd: row.work_hours_end || row.workHoursEnd || defaultSettings.workHoursEnd,
    workHoursNote: row.work_hours_note || row.workHoursNote || defaultSettings.workHoursNote,
    isStoreOpenManual: row.is_store_open_manual || row.isStoreOpenManual || defaultSettings.isStoreOpenManual,
    closedMessage: row.closed_message || row.closedMessage || defaultSettings.closedMessage,
    announcementBanner: row.announcement_banner || row.announcementBanner || defaultSettings.announcementBanner,
    announcementActive: Boolean(row.announcement_active ?? row.announcementActive ?? defaultSettings.announcementActive),
    adminPassword: row.admin_password || row.adminPassword || defaultSettings.adminPassword
  };
}

function settingsToRow(s) {
  return {
    id: 'default',
    company_name: s.companyName,
    slogan: s.slogan,
    tagline: s.tagline,
    phone1: s.phone1,
    phone2: s.phone2,
    whatsapp_number: s.whatsappNumber,
    whatsapp_number2: s.whatsappNumber2,
    price_min: s.priceMin,
    price_max: s.priceMax,
    extra_address_fee: s.extraAddressFee,
    currency: s.currency,
    work_hours_start: s.workHoursStart,
    work_hours_end: s.workHoursEnd,
    work_hours_note: s.workHoursNote,
    is_store_open_manual: s.isStoreOpenManual,
    closed_message: s.closedMessage,
    announcement_banner: s.announcementBanner,
    announcement_active: s.announcementActive,
    admin_password: s.adminPassword,
    updated_at: new Date().toISOString()
  };
}

// Generate human-readable sequential Order IDs: HT-YYMMDD-001
function generateOrderId(existingOrders) {
  const date = new Date();
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const todayStr = date.toDateString();

  const countToday = (existingOrders || []).filter(o => {
    if (!o || !o.createdAt) return false;
    return new Date(o.createdAt).toDateString() === todayStr;
  }).length + 1;

  const seq = String(countToday).padStart(3, '0');
  return `HT-${year}${month}${day}-${seq}`;
}

// ----------------- DB API EXPORTS -----------------

// 1. Get Settings
async function getSettings() {
  if (supabase) {
    try {
      const { data, error } = await supabase.from('settings').select('*').limit(1).maybeSingle();
      if (!error && data) {
        return rowToSettings(data);
      }
    } catch (err) {
      console.warn('[DB] Supabase getSettings error, falling back:', err.message);
    }
  }

  // Fallback to local / memory
  if (!memorySettings) {
    memorySettings = readLocalJson(SETTINGS_FILE, defaultSettings);
  }
  return { ...defaultSettings, ...memorySettings };
}

// 2. Update Settings
async function updateSettings(newSettings) {
  const current = await getSettings();
  const merged = { ...current, ...newSettings };

  // Write to Supabase if available
  if (supabase) {
    try {
      const row = settingsToRow(merged);
      await supabase.from('settings').upsert(row, { onConflict: 'id' });
    } catch (err) {
      console.warn('[DB] Supabase updateSettings error:', err.message);
    }
  }

  // Always keep local/memory in sync
  memorySettings = merged;
  writeLocalJson(SETTINGS_FILE, merged);

  return merged;
}

// 3. Get Orders
async function getOrders({ status, search } = {}) {
  let orders = null;

  if (supabase) {
    try {
      let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }
      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        orders = data.map(rowToOrder);
      }
    } catch (err) {
      console.warn('[DB] Supabase getOrders error, falling back:', err.message);
    }
  }

  // Fallback to local / memory if Supabase returned an error or is unconfigured
  if (orders === null) {
    if (!memoryOrders) {
      memoryOrders = readLocalJson(ORDERS_FILE, []);
    }
    orders = [...memoryOrders];

    if (status && status !== 'all') {
      orders = orders.filter(o => o.status === status);
    }
  }

  if (search) {
    const q = search.trim().toLowerCase();
    orders = orders.filter(o =>
      (o.orderId && o.orderId.toLowerCase().includes(q)) ||
      (o.customerName && o.customerName.toLowerCase().includes(q)) ||
      (o.phone && o.phone.includes(q)) ||
      (o.orderDetails && o.orderDetails.toLowerCase().includes(q))
    );
  }

  // Sort newest first
  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return orders;
}

// 4. Create Order
async function createOrder(orderPayload) {
  const existingOrders = await getOrders();
  const newOrderId = generateOrderId(existingOrders);
  const now = new Date();

  const newOrder = {
    id: Date.now().toString(),
    orderId: newOrderId,
    customerName: (orderPayload.customerName || '').trim(),
    phone: (orderPayload.phone || '').trim(),
    orderType: orderPayload.orderType || 'individual',
    address: (orderPayload.address || '').trim(),
    addresses: Array.isArray(orderPayload.addresses) ? orderPayload.addresses.filter(a => a && a.trim()) : [],
    orderDetails: (orderPayload.orderDetails || '').trim(),
    orderNote: (orderPayload.orderNote || '').trim(),
    estimatedPriceText: orderPayload.estimatedPriceText || 'من 15 إلى 20 جنيه',
    estimatedPriceValue: orderPayload.estimatedPriceValue || { min: 15, max: 20 },
    status: 'new',
    driverName: '',
    adminNotes: '',
    createdAt: now.toISOString(),
    createdAtFormatted: now.toLocaleString('ar-EG', {
      calendar: 'gregory',
      dateStyle: 'medium',
      timeStyle: 'short'
    })
  };

  // Save to Supabase if available
  if (supabase) {
    try {
      const row = orderToRow(newOrder);
      await supabase.from('orders').insert([row]);
    } catch (err) {
      console.warn('[DB] Supabase createOrder error:', err.message);
    }
  }

  // Save to local / memory
  if (!memoryOrders) {
    memoryOrders = readLocalJson(ORDERS_FILE, []);
  }
  memoryOrders.unshift(newOrder);
  writeLocalJson(ORDERS_FILE, memoryOrders);

  return newOrder;
}

// 5. Update Order Status
async function updateOrderStatus(id, { status, driverName, notes }) {
  const existing = await getOrders();
  const order = existing.find(o => o.id === id || o.orderId === id);
  if (!order) return null;

  if (status) order.status = status;
  if (driverName !== undefined) order.driverName = driverName;
  if (notes !== undefined) order.adminNotes = notes;
  order.updatedAt = new Date().toISOString();

  if (supabase) {
    try {
      const updates = {};
      if (status) updates.status = status;
      if (driverName !== undefined) updates.driver_name = driverName;
      if (notes !== undefined) updates.admin_notes = notes;
      updates.updated_at = order.updatedAt;

      await supabase.from('orders').update(updates).or(`id.eq.${id},order_id.eq.${id}`);
    } catch (err) {
      console.warn('[DB] Supabase updateOrderStatus error:', err.message);
    }
  }

  if (memoryOrders) {
    const idx = memoryOrders.findIndex(o => o.id === id || o.orderId === id);
    if (idx !== -1) memoryOrders[idx] = { ...memoryOrders[idx], ...order };
    writeLocalJson(ORDERS_FILE, memoryOrders);
  }

  return order;
}

// 6. Delete Order
async function deleteOrder(id) {
  if (supabase) {
    try {
      await supabase.from('orders').delete().or(`id.eq.${id},order_id.eq.${id}`);
    } catch (err) {
      console.warn('[DB] Supabase deleteOrder error:', err.message);
    }
  }

  if (memoryOrders) {
    memoryOrders = memoryOrders.filter(o => o.id !== id && o.orderId !== id);
    writeLocalJson(ORDERS_FILE, memoryOrders);
  }

  return true;
}

// 7. Get Stats
async function getStats() {
  const orders = await getOrders();
  const todayStr = new Date().toDateString();

  const todayOrders = orders.filter(o => new Date(o.createdAt).toDateString() === todayStr);
  const newCount = orders.filter(o => o.status === 'new').length;
  const processingCount = orders.filter(o => o.status === 'processing').length;
  const deliveringCount = orders.filter(o => o.status === 'delivering').length;
  const deliveredCount = orders.filter(o => o.status === 'delivered').length;
  const cancelledCount = orders.filter(o => o.status === 'cancelled').length;

  return {
    totalOrders: orders.length,
    todayOrders: todayOrders.length,
    newCount,
    processingCount,
    deliveringCount,
    deliveredCount,
    cancelledCount,
    supabaseConnected: Boolean(supabase),
    supabaseTablesReady: Boolean(supabaseTablesAvailable.orders && supabaseTablesAvailable.settings)
  };
}

module.exports = {
  getSettings,
  updateSettings,
  getOrders,
  createOrder,
  updateOrderStatus,
  deleteOrder,
  getStats,
  defaultSettings,
  supabase
};
