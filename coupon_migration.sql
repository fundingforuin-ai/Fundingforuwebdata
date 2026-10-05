-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS coupon_codes (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  discount_percent INTEGER NOT NULL,
  description TEXT,
  max_uses INTEGER DEFAULT NULL,
  used_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert the 4 coupon codes
INSERT INTO coupon_codes (code, discount_percent, description, max_uses, is_active) VALUES
  ('F4U10', 10, '10% off any account', NULL, TRUE),
  ('F4U20', 20, '20% off any account', NULL, TRUE),
  ('F4U30', 30, '30% off any account', NULL, TRUE),
  ('F4U50', 50, '50% off any account', NULL, TRUE);
