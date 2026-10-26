-- 数字商品商城建表（PostgreSQL）
-- 幂等：可重复执行

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(32),
  password_hash VARCHAR(255),
  nickname VARCHAR(100),
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- categories
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  sort INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- products
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  slug VARCHAR(150) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  includes_text TEXT NOT NULL DEFAULT '',
  usage_text TEXT NOT NULL DEFAULT '',
  after_sales_text TEXT NOT NULL DEFAULT '',
  price_cents INT NOT NULL CHECK (price_cents >= 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'CNY',
  stock_type VARCHAR(20) NOT NULL DEFAULT 'code', -- code=卡密库自动发货, manual=人工交付
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- inventory_codes：卡密库
CREATE TABLE IF NOT EXISTS inventory_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  code_text TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'available', -- available / sold / refunded
  sold_order_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sold_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_inventory_product_status ON inventory_codes(product_id, status);

-- orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no VARCHAR(64) UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(32),
  total_cents INT NOT NULL CHECK (total_cents >= 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'CNY',
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending / paid / delivered / refunded / cancelled
  pay_channel VARCHAR(20), -- alipay / wechat / mock
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_orders_order_no ON orders(order_no);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- order_items
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(200) NOT NULL,
  unit_price_cents INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  delivery_payload TEXT, -- 发货内容（卡密），仅在订单查询/后台可见，不要写日志
  inventory_code_id UUID REFERENCES inventory_codes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- payments：支付记录，去重按 trade_no / out_trade_no
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  channel VARCHAR(20) NOT NULL, -- alipay / wechat / mock
  out_trade_no VARCHAR(128) UNIQUE NOT NULL,
  trade_no VARCHAR(128),
  amount_cents INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending / success / failed
  raw_notify JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_out_trade_no ON payments(out_trade_no);

-- updated_at 自动更新（可选）
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_users_updated ON users;
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_products_updated ON products;
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_payments_updated ON payments;
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
