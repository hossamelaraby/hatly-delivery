-- ========================================================
-- Hatly Delivery - Supabase Database Schema
-- Run this script in: Supabase Dashboard > SQL Editor > New query
-- ========================================================

-- 1. Create Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    order_id TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    order_type TEXT DEFAULT 'individual',
    address TEXT,
    addresses JSONB DEFAULT '[]'::jsonb,
    order_details TEXT NOT NULL,
    order_note TEXT,
    estimated_price_text TEXT,
    estimated_price_value JSONB,
    status TEXT DEFAULT 'new', -- 'new', 'processing', 'delivering', 'delivered', 'cancelled'
    driver_name TEXT DEFAULT '',
    admin_notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Settings Table
CREATE TABLE IF NOT EXISTS public.settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    company_name TEXT DEFAULT 'هاتلي | Hattly',
    slogan TEXT DEFAULT 'سرعة.. دقة.. توصيل 🛵',
    tagline TEXT DEFAULT 'هاتلي... البراند اللي بيقربلك كل اللي محتاجه! مشوار أسهل، وقت أوفر، وطلبك لحد بابك.',
    phone1 TEXT DEFAULT '01130944299',
    phone2 TEXT DEFAULT '01130944399',
    whatsapp_number TEXT DEFAULT '201130944299',
    whatsapp_number2 TEXT DEFAULT '201130944399',
    price_min NUMERIC DEFAULT 15,
    price_max NUMERIC DEFAULT 20,
    extra_address_fee NUMERIC DEFAULT 5,
    currency TEXT DEFAULT 'جنيه',
    work_hours_start TEXT DEFAULT '07:00',
    work_hours_end TEXT DEFAULT '04:00',
    work_hours_note TEXT DEFAULT 'من 7:00 صباحاً وحتى 4:00 بعد منتصف الليل',
    is_store_open_manual TEXT DEFAULT 'auto',
    closed_message TEXT DEFAULT 'نعتذر، المتجر مغلق مؤقتاً لاستقبال الطلبات حالياً',
    announcement_banner TEXT DEFAULT '',
    announcement_active BOOLEAN DEFAULT false,
    admin_password TEXT DEFAULT 'hatly2026',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Insert Default Settings Row
INSERT INTO public.settings (
    id, company_name, slogan, tagline, phone1, phone2,
    whatsapp_number, whatsapp_number2, price_min, price_max, extra_address_fee,
    currency, work_hours_start, work_hours_end, work_hours_note,
    is_store_open_manual, closed_message, announcement_banner, announcement_active, admin_password
) VALUES (
    'default', 'هاتلي | Hattly', 'سرعة.. دقة.. توصيل 🛵',
    'هاتلي... البراند اللي بيقربلك كل اللي محتاجه! مشوار أسهل، وقت أوفر، وطلبك لحد بابك.',
    '01130944299', '01130944399', '201130944299', '201130944399',
    15, 20, 5, 'جنيه', '07:00', '04:00', 'من 7:00 صباحاً وحتى 4:00 بعد منتصف الليل',
    'auto', 'نعتذر، المتجر مغلق مؤقتاً لاستقبال الطلبات حالياً', '', false, 'hatly2026'
) ON CONFLICT (id) DO NOTHING;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- 5. Policies for Service Role (Full Backend Access)
DROP POLICY IF EXISTS "Service role full access orders" ON public.orders;
CREATE POLICY "Service role full access orders" ON public.orders
FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access settings" ON public.settings;
CREATE POLICY "Service role full access settings" ON public.settings
FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6. Public Policies
DROP POLICY IF EXISTS "Public can create orders" ON public.orders;
CREATE POLICY "Public can create orders" ON public.orders
FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Public can read settings" ON public.settings;
CREATE POLICY "Public can read settings" ON public.settings
FOR SELECT TO anon, authenticated USING (true);
