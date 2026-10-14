const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('./lib/db');

const app = express();
const DEFAULT_PORT = process.env.PORT ? parseInt(process.env.PORT) : 3005;

// Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Simple in-memory rate limiter to protect against spam and brute force
const rateLimitMap = new Map();
function rateLimiter(maxRequests = 60, windowMs = 60000) {
  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();
    const record = rateLimitMap.get(ip) || { count: 0, resetTime: now + windowMs };

    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
    } else {
      record.count += 1;
    }
    rateLimitMap.set(ip, record);

    if (record.count > maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'تم تجاوز الحد المسموح من المحاولات، يرجى الانتظار دقيقة والمحاولة مجدداً.'
      });
    }
    next();
  };
}

// Stateless HMAC Admin Authentication (Resilient on Vercel Serverless & Local)
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'hatly-secure-secret-token-key-2026';

function generateAdminToken() {
  const timestamp = Date.now();
  const payload = `admin:${timestamp}`;
  const hmac = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${hmac}`).toString('base64url');
}

function verifyAdminToken(token) {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length !== 3 || parts[0] !== 'admin') return false;
    const timestamp = parseInt(parts[1], 10);
    const receivedHmac = parts[2];

    // Token expires in 14 days
    if (Date.now() - timestamp > 14 * 24 * 60 * 60 * 1000) return false;

    const expectedHmac = crypto.createHmac('sha256', JWT_SECRET).update(`admin:${timestamp}`).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(receivedHmac), Buffer.from(expectedHmac));
  } catch (e) {
    return false;
  }
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'غير مصرح، يرجى تسجيل الدخول أولاً' });
  }
  const token = authHeader.split(' ')[1];
  if (!verifyAdminToken(token)) {
    return res.status(401).json({ success: false, message: 'الجلسة منتهية أو غير صالحة' });
  }
  next();
}

// ----------------- Authentication Routes -----------------

// Admin Login
app.post('/api/auth/login', rateLimiter(15, 60000), async (req, res) => {
  try {
    const { password } = req.body;
    const settings = await db.getSettings();
    const correctPassword = settings.adminPassword || 'hatly2026';

    if (!password || String(password).trim() !== String(correctPassword).trim()) {
      return res.status(401).json({ success: false, message: 'كلمة المرور غير صحيحة!' });
    }

    const token = generateAdminToken();
    res.json({ success: true, token, message: 'تم تسجيل الدخول بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ أثناء تسجيل الدخول' });
  }
});

// Admin Session Verification
app.get('/api/auth/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (verifyAdminToken(token)) {
      return res.json({ success: true, authenticated: true });
    }
  }
  res.status(401).json({ success: false, authenticated: false });
});

// Admin Logout
app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });
});

// ----------------- Public & Protected Settings -----------------

// Get settings (public, password always redacted)
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await db.getSettings();
    const safe = { ...settings };
    delete safe.adminPassword;
    res.json({ success: true, settings: safe });
  } catch (err) {
    res.status(500).json({ success: false, message: 'فشل جلب الإعدادات' });
  }
});

// Update settings (protected - admin only)
app.put('/api/settings', authMiddleware, async (req, res) => {
  try {
    const body = { ...req.body };
    if (!body.adminPassword || !body.adminPassword.trim()) {
      delete body.adminPassword;
    } else {
      body.adminPassword = body.adminPassword.trim();
    }

    const updated = await db.updateSettings(body);
    const safe = { ...updated };
    delete safe.adminPassword;
    res.json({ success: true, settings: safe, message: 'تم حفظ كافة الإعدادات بنجاح!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'فشل حفظ الإعدادات' });
  }
});

// ----------------- Orders API -----------------

// Get orders (protected - admin only)
app.get('/api/orders', authMiddleware, async (req, res) => {
  try {
    const { status, search } = req.query;
    const orders = await db.getOrders({ status, search });
    res.json({ success: true, orders, count: orders.length });
  } catch (err) {
    res.status(500).json({ success: false, message: 'فشل جلب الطلبات' });
  }
});

// Create new order (public, rate limited to prevent bot flooding)
app.post('/api/orders', rateLimiter(20, 60000), async (req, res) => {
  try {
    const { customerName, phone, orderDetails } = req.body;

    if (!customerName || !phone || !orderDetails) {
      return res.status(400).json({
        success: false,
        message: 'برجاء ملء جميع الحقول المطلوبة (الاسم، الهاتف، الطلب)'
      });
    }

    // Phone validation
    const cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'برجاء إدخال رقم هاتف صحيح'
      });
    }

    const newOrder = await db.createOrder(req.body);
    res.status(201).json({
      success: true,
      order: newOrder,
      message: 'تم تسجيل الطلب بنجاح'
    });
  } catch (err) {
    console.error('[API] Create order error:', err);
    res.status(500).json({ success: false, message: 'حدث خطأ أثناء حفظ الطلب' });
  }
});

// Update order status (protected - admin only)
app.patch('/api/orders/:id/status', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, driverName, notes } = req.body;

    const validStatuses = ['new', 'processing', 'delivering', 'delivered', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'حالة غير صالحة' });
    }

    const updatedOrder = await db.updateOrderStatus(id, { status, driverName, notes });
    if (!updatedOrder) {
      return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    }

    res.json({
      success: true,
      order: updatedOrder,
      message: 'تم تحديث حالة الطلب بنجاح'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'فشل تحديث الطلب' });
  }
});

// Delete order (protected - admin only)
app.delete('/api/orders/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await db.deleteOrder(id);
    res.json({ success: true, message: 'تم حذف الطلب بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'فشل حذف الطلب' });
  }
});

// Dashboard Statistics (protected - admin only)
app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    const stats = await db.getStats();
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: 'فشل جلب الإحصائيات' });
  }
});

// ----------------- Static & App Routes -----------------

// Direct APK Download Routes
app.get(['/download/hatly.apk', '/download/app', '/downloads/hatly.apk'], (req, res) => {
  const apkPath = path.join(process.cwd(), 'public', 'downloads', 'hatly.apk');
  if (fs.existsSync(apkPath)) {
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="hatly.apk"');
    return res.sendFile(apkPath);
  }
  const zipPath = path.join(process.cwd(), 'public', 'downloads', 'hatly-android-app.zip');
  if (fs.existsSync(zipPath)) {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="hatly-android-app.zip"');
    return res.sendFile(zipPath);
  }
  res.redirect('/?install=app');
});

// Serve frontend static assets
app.use(express.static(path.join(process.cwd(), 'public')));

// Admin route alias
app.get(['/admin', '/dashboard'], (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'admin.html'));
});

// Mobile App Route (Exact replica with Smartphone dimensions)
app.get(['/app', '/mobile', '/app.html'], (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'app.html'));
});

// Fallback to home page
app.get('*', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

// Only start the local server if running outside of Vercel serverless
function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`===============================================`);
    console.log(`🚀 Hattly Delivery System is running!`);
    console.log(`🌐 Website (Customer Order Page): http://localhost:${port}`);
    console.log(`📱 Mobile App (Phone Dimensions): http://localhost:${port}/app`);
    console.log(`📊 Dashboard (Admin Panel):       http://localhost:${port}/admin`);
    console.log(`===============================================`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is in use, trying ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

if (!process.env.VERCEL) {
  startServer(DEFAULT_PORT);
}

module.exports = app;
