-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS giveaway_entries (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  country TEXT DEFAULT 'Unknown',
  draw_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_fake BOOLEAN DEFAULT FALSE,
  is_winner BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS giveaway_winners (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  full_name TEXT NOT NULL,
  country TEXT DEFAULT 'Unknown',
  account_size TEXT DEFAULT '$5,000',
  draw_date DATE NOT NULL,
  announced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent same user entering twice on the same day
CREATE UNIQUE INDEX IF NOT EXISTS uniq_giveaway_user_day
  ON giveaway_entries(user_id, draw_date)
  WHERE is_fake = FALSE;
