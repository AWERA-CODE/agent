# Database Setup Guide (PostgreSQL / Supabase)

> **Current Application Status:**
> The deployed version runs in **Demo Mode with In-Memory State**. It uses deterministic seed datasets and supports reset-on-demand via `/api/tools/reset`. State resets across serverless container cold starts on Vercel.
>
> Follow this guide to connect a persistent **Supabase** or **Neon** PostgreSQL database for production.

---

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free project.
2. Under **Project Settings** → **Database**, find your **Connection String** (`URI` mode).
3. Copy the string (format: `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`).

---

## 2. Execute the Database Schema (DDL)

Run the following SQL in the **Supabase SQL Editor**:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Customers Table
CREATE TABLE customers (
    customer_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50) NOT NULL,
    tier VARCHAR(20) NOT NULL CHECK (tier IN ('VIP', 'Premium', 'Standard')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    orders TEXT[] DEFAULT '{}'
);

-- 2. Inventory Table
CREATE TABLE inventory (
    sku VARCHAR(100) PRIMARY KEY,
    item_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    quantity_in_stock INT NOT NULL DEFAULT 0,
    restock_date TIMESTAMPTZ
);

-- 3. Orders Table
CREATE TABLE orders (
    order_id VARCHAR(50) PRIMARY KEY,
    customer_id VARCHAR(50) REFERENCES customers(customer_id),
    order_date TIMESTAMPTZ DEFAULT NOW(),
    delivery_date TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL CHECK (status IN ('PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED', 'REPLACED')),
    resolution_state VARCHAR(50) NOT NULL DEFAULT 'NONE',
    items JSONB NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    payment_method VARCHAR(255) NOT NULL,
    shipping_address TEXT NOT NULL,
    history JSONB DEFAULT '[]'::JSONB
);

-- 4. Cases Table
CREATE TABLE cases (
    case_id VARCHAR(50) PRIMARY KEY,
    customer_id VARCHAR(50) REFERENCES customers(customer_id),
    order_id VARCHAR(50) REFERENCES orders(order_id),
    issue_description TEXT NOT NULL,
    status VARCHAR(30) NOT NULL CHECK (status IN ('open', 'in_progress', 'resolved', 'escalated', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    resolution_summary TEXT,
    trace JSONB DEFAULT '[]'::JSONB
);

-- Indexes for high-frequency queries
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_cases_customer ON cases(customer_id);
CREATE INDEX idx_cases_order ON cases(order_id);
```

---

## 3. Seed the Deterministic Initial Data

```sql
-- Seed Customers
INSERT INTO customers (customer_id, name, email, phone, tier, created_at, orders) VALUES
('CUST-1001', 'Alice Smith', 'alice.smith@example.com', '+1-555-0192', 'VIP', '2024-01-15T08:30:00Z', ARRAY['ORD-5001', 'ORD-5004']),
('CUST-1002', 'Bob Jones', 'bob.jones@example.com', '+1-555-0143', 'Standard', '2024-03-22T10:15:00Z', ARRAY['ORD-5002']),
('CUST-1003', 'Charlie Brown', 'charlie.brown@example.com', '+1-555-0188', 'Standard', '2024-06-10T14:20:00Z', ARRAY['ORD-5003']),
('CUST-1004', 'Diana Prince', 'diana.prince@example.com', '+1-555-0177', 'VIP', '2024-08-01T11:00:00Z', ARRAY['ORD-5005']);

-- Seed Inventory (including mandatory out-of-stock item SKU-SMARTWATCH-PRO-SLV)
INSERT INTO inventory (sku, item_name, category, unit_price, quantity_in_stock, restock_date) VALUES
('SKU-WIRELESS-EARBUDS-BLK', 'Wireless Noise-Canceling Earbuds (Black)', 'Electronics', 89.99, 45, NULL),
('SKU-WIRELESS-EARBUDS-WHT', 'Wireless Noise-Canceling Earbuds (White)', 'Electronics', 89.99, 12, NULL),
('SKU-SMARTWATCH-PRO-SLV', 'SmartWatch Pro (Silver)', 'Electronics', 249.99, 0, '2026-10-15T00:00:00Z'),
('SKU-USB-C-CABLE-6FT', 'Ultra-Fast USB-C Cable (6ft)', 'Accessories', 19.99, 150, NULL),
('SKU-MECHANICAL-KEYBOARD-RGB', 'RGB Mechanical Gaming Keyboard', 'Electronics', 129.99, 8, NULL);

-- Seed Orders
INSERT INTO orders (order_id, customer_id, order_date, delivery_date, status, resolution_state, items, total_amount, payment_method, shipping_address, history) VALUES
(
    'ORD-5001',
    'CUST-1001',
    '2026-09-02T10:00:00Z',
    '2026-09-05T14:30:00Z',
    'DELIVERED',
    'NONE',
    '[{"sku": "SKU-WIRELESS-EARBUDS-BLK", "item_name": "Wireless Noise-Canceling Earbuds (Black)", "quantity": 1, "unit_price": 89.99}]'::JSONB,
    89.99,
    'Credit Card ending in 4242',
    '123 Main St, Tech City, CA 94016',
    '[{"timestamp": "2026-09-02T10:00:00Z", "action": "ORDER_PLACED", "details": "Order placed by customer"}, {"timestamp": "2026-09-05T14:30:00Z", "action": "ORDER_DELIVERED", "details": "Delivered by carrier"}]'::JSONB
),
(
    'ORD-5002',
    'CUST-1002',
    '2026-07-01T09:15:00Z',
    '2026-07-05T11:00:00Z',
    'DELIVERED',
    'NONE',
    '[{"sku": "SKU-USB-C-CABLE-6FT", "item_name": "Ultra-Fast USB-C Cable (6ft)", "quantity": 1, "unit_price": 19.99}]'::JSONB,
    19.99,
    'PayPal (bob.jones@example.com)',
    '456 Oak Ave, Springfield, IL 62701',
    '[{"timestamp": "2026-07-01T09:15:00Z", "action": "ORDER_PLACED", "details": "Order placed by customer"}, {"timestamp": "2026-07-05T11:00:00Z", "action": "ORDER_DELIVERED", "details": "Delivered by carrier"}]'::JSONB
),
(
    'ORD-5003',
    'CUST-1003',
    '2026-09-11T16:00:00Z',
    NULL,
    'PENDING',
    'NONE',
    '[{"sku": "SKU-MECHANICAL-KEYBOARD-RGB", "item_name": "RGB Mechanical Gaming Keyboard", "quantity": 1, "unit_price": 129.99}]'::JSONB,
    129.99,
    'Credit Card ending in 1099',
    '789 Pine Rd, Austin, TX 78701',
    '[{"timestamp": "2026-09-11T16:00:00Z", "action": "ORDER_PLACED", "details": "Order pending fulfillment"}]'::JSONB
),
(
    'ORD-5004',
    'CUST-1001',
    '2026-09-04T12:00:00Z',
    '2026-09-08T15:45:00Z',
    'DELIVERED',
    'NONE',
    '[{"sku": "SKU-SMARTWATCH-PRO-SLV", "item_name": "SmartWatch Pro (Silver)", "quantity": 1, "unit_price": 249.99}]'::JSONB,
    249.99,
    'Credit Card ending in 4242',
    '123 Main St, Tech City, CA 94016',
    '[{"timestamp": "2026-09-04T12:00:00Z", "action": "ORDER_PLACED", "details": "Order placed by customer"}, {"timestamp": "2026-09-08T15:45:00Z", "action": "ORDER_DELIVERED", "details": "Delivered by carrier - reported screen issue"}]'::JSONB
),
(
    'ORD-5005',
    'CUST-1004',
    '2026-09-10T08:00:00Z',
    NULL,
    'SHIPPED',
    'NONE',
    '[{"sku": "SKU-WIRELESS-EARBUDS-WHT", "item_name": "Wireless Noise-Canceling Earbuds (White)", "quantity": 1, "unit_price": 89.99}]'::JSONB,
    89.99,
    'Apple Pay',
    '321 Hero Way, Metropolis, NY 10001',
    '[{"timestamp": "2026-09-10T08:00:00Z", "action": "ORDER_PLACED", "details": "Order placed by customer"}, {"timestamp": "2026-09-11T10:00:00Z", "action": "ORDER_SHIPPED", "details": "In transit"}]'::JSONB
);
```

---

## 4. Connect to Vercel

1. In your **Vercel Project Dashboard** → **Settings** → **Environment Variables**:
   - `DATABASE_URL`: paste your Supabase connection string.
   - `DIRECT_URL`: paste your direct connection string (for migrations if needed).
2. Redeploy the application.
