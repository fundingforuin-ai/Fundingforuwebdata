require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  // Required for Supabase connections:
  ssl: { rejectUnauthorized: false }
});

const initDb = async () => {
  try {
    // 1. users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        full_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'trader',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. trading_accounts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trading_accounts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        mt5_login TEXT,
        mt5_password TEXT,
        mt5_server TEXT,
        account_size NUMERIC DEFAULT 0,
        challenge_type TEXT DEFAULT '2step',
        status TEXT DEFAULT 'pending',
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id)
      );
    `);

    // 3. account_metrics table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS account_metrics (
        id SERIAL PRIMARY KEY,
        trading_account_id INTEGER NOT NULL REFERENCES trading_accounts(id),
        balance NUMERIC DEFAULT 0,
        equity NUMERIC DEFAULT 0,
        profit NUMERIC DEFAULT 0,
        drawdown NUMERIC DEFAULT 0,
        win_rate NUMERIC DEFAULT 0,
        total_trades INTEGER DEFAULT 0,
        winning_trades INTEGER DEFAULT 0,
        losing_trades INTEGER DEFAULT 0,
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. trades table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trades (
        id SERIAL PRIMARY KEY,
        trading_account_id INTEGER NOT NULL REFERENCES trading_accounts(id),
        ticket TEXT UNIQUE NOT NULL,
        symbol TEXT NOT NULL,
        type TEXT NOT NULL,
        volume NUMERIC NOT NULL,
        open_price NUMERIC,
        close_price NUMERIC,
        profit NUMERIC NOT NULL,
        open_time TIMESTAMP,
        close_time TIMESTAMP,
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. alerts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        trading_account_id INTEGER REFERENCES trading_accounts(id),
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 6. orders table (checkout / payments)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        plan_type TEXT NOT NULL,
        account_size TEXT NOT NULL,
        price_usd NUMERIC NOT NULL,
        nowpayments_id TEXT,
        nowpayments_status TEXT DEFAULT 'waiting',
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        paid_at TIMESTAMP
      );
    `);

    // 7. referrals table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id SERIAL PRIMARY KEY,
        referrer_id INTEGER NOT NULL REFERENCES users(id),
        referred_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 8. affiliate_sales table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS affiliate_sales (
        id SERIAL PRIMARY KEY,
        referrer_id INTEGER NOT NULL REFERENCES users(id),
        referred_id INTEGER NOT NULL REFERENCES users(id),
        order_id INTEGER REFERENCES orders(id),
        amount_usd NUMERIC NOT NULL,
        commission_earned NUMERIC NOT NULL,
        sale_type TEXT DEFAULT 'challenge_purchase',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);


    console.log("PostgreSQL Database schema initialized successfully.");
  } catch (error) {
    console.error("Failed to initialize database schema:", error);
  }
};

initDb();

module.exports = pool;
