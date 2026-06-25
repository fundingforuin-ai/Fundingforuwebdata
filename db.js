require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wcvghufcsodvhckfwqke.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || '';

global.WebSocket = WebSocket;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

// ── Schema Init (runs on startup) ───────────────────────────
// Tables are created via Supabase dashboard SQL editor.
// On first deploy, run the SQL in schema.sql in your Supabase dashboard.
const initDb = async () => {
  try {
    const { error } = await supabase.from('users').select('id').limit(1);
    if (error && error.code === '42P01') {
      console.error('⚠️  Tables not found. Please run schema.sql in your Supabase SQL Editor.');
    } else {
      console.log('PostgreSQL Database schema initialized successfully.');
    }
  } catch (e) {
    console.error('DB check failed:', e.message);
  }
};

initDb();

// ── Compatibility query() wrapper ────────────────────────────
// Translates pg-style pool.query(sql, params) calls to Supabase REST API calls.
// This keeps all existing server.js code working without rewrites.
const query = async (sql, params = []) => {
  const s = sql.replace(/\s+/g, ' ').trim();

  // ── INSERT INTO users ──────────────────────────────────────
  if (/^INSERT INTO users/i.test(s)) {
    if (/RETURNING id/i.test(s)) {
      const [full_name, email, phone, password_hash, role] = params;
      const { data, error } = await supabase.from('users').insert({ full_name, email, phone: phone || null, password_hash, role }).select('id').single();
      if (error) throw new Error(error.message);
      return { rows: [data] };
    }
    return { rows: [] };
  }

  // ── SELECT FROM users ──────────────────────────────────────
  if (/^SELECT id FROM users WHERE email/i.test(s)) {
    const { data, error } = await supabase.from('users').select('id').eq('email', params[0]);
    if (error) throw new Error(error.message);
    return { rows: data || [] };
  }
  if (/^SELECT id FROM users WHERE phone/i.test(s)) {
    const { data, error } = await supabase.from('users').select('id').eq('phone', params[0]);
    if (error) throw new Error(error.message);
    return { rows: data || [] };
  }
  if (/^SELECT \* FROM users WHERE email/i.test(s)) {
    const { data, error } = await supabase.from('users').select('*').eq('email', params[0]).maybeSingle();
    if (error) throw new Error(error.message);
    return { rows: data ? [data] : [] };
  }
  if (/^SELECT id, full_name, email, role, created_at FROM users WHERE id/i.test(s)) {
    const { data, error } = await supabase.from('users').select('id, full_name, email, role, created_at').eq('id', params[0]).maybeSingle();
    if (error) throw new Error(error.message);
    return { rows: data ? [data] : [] };
  }

  // ── JOIN: admin users list ─────────────────────────────────
  if (/FROM users u.*LEFT JOIN trading_accounts/is.test(s)) {
    const { data: users, error } = await supabase.from('users').select('id, full_name, email, role, created_at').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    const { data: accounts } = await supabase.from('trading_accounts').select('id, user_id, mt5_login, mt5_server, account_size, challenge_type, status');
    const accMap = {};
    (accounts || []).forEach(a => { accMap[a.user_id] = a; });
    const rows = (users || []).map(u => {
      const ta = accMap[u.id] || {};
      return { ...u, account_id: ta.id || null, mt5_login: ta.mt5_login || null, mt5_server: ta.mt5_server || null, account_size: ta.account_size || null, challenge_type: ta.challenge_type || null, status: ta.status || null };
    });
    return { rows };
  }

  // ── trading_accounts ───────────────────────────────────────
  if (/^SELECT \* FROM trading_accounts WHERE user_id/i.test(s)) {
    const { data, error } = await supabase.from('trading_accounts').select('*').eq('user_id', params[0]).order('assigned_at', { ascending: true });
    if (error) throw new Error(error.message);
    return { rows: data || [] };
  }
  if (/^SELECT id FROM trading_accounts WHERE user_id/i.test(s)) {
    const { data, error } = await supabase.from('trading_accounts').select('id').eq('user_id', params[0]);
    if (error) throw new Error(error.message);
    return { rows: data || [] };
  }
  if (/^UPDATE trading_accounts SET mt5_login/i.test(s)) {
    const [mt5_login, mt5_password, mt5_server, account_size, challenge_type, status, user_id] = params;
    const { error } = await supabase.from('trading_accounts').update({ mt5_login, mt5_password, mt5_server, account_size, challenge_type, status }).eq('user_id', user_id);
    if (error) throw new Error(error.message);
    return { rows: [] };
  }
  if (/^INSERT INTO trading_accounts.*mt5_login/i.test(s)) {
    const [user_id, mt5_login, mt5_password, mt5_server, account_size, challenge_type, status] = params;
    const { error } = await supabase.from('trading_accounts').insert({ user_id, mt5_login, mt5_password, mt5_server, account_size, challenge_type, status });
    if (error) throw new Error(error.message);
    return { rows: [] };
  }
  if (/^SELECT id as trading_account_id.*FROM trading_accounts WHERE status/i.test(s)) {
    const { data, error } = await supabase.from('trading_accounts').select('id, user_id, mt5_login, mt5_password, mt5_server').eq('status', params[0]);
    if (error) throw new Error(error.message);
    return { rows: (data || []).map(r => ({ trading_account_id: r.id, user_id: r.user_id, mt5_login: r.mt5_login, mt5_password: r.mt5_password, mt5_server: r.mt5_server })) };
  }
  if (/^SELECT user_id, account_size, challenge_type, status FROM trading_accounts WHERE id/i.test(s)) {
    const { data, error } = await supabase.from('trading_accounts').select('user_id, account_size, challenge_type, status').eq('id', params[0]);
    if (error) throw new Error(error.message);
    return { rows: data || [] };
  }
  if (/^UPDATE trading_accounts SET status/i.test(s)) {
    const { error } = await supabase.from('trading_accounts').update({ status: params[0] }).eq('id', params[1]);
    if (error) throw new Error(error.message);
    return { rows: [] };
  }
  if (/^INSERT INTO trading_accounts.*account_size.*challenge_type.*status/i.test(s) && !/mt5_login/i.test(s)) {
    const [user_id, account_size, challenge_type, status] = params;
    const { data, error } = await supabase.from('trading_accounts').insert({ user_id, account_size, challenge_type, status }).select('id').single();
    if (error) throw new Error(error.message);
    return { rows: [data] };
  }

  // ── account_metrics ────────────────────────────────────────
  if (/^SELECT \* FROM account_metrics WHERE trading_account_id/i.test(s)) {
    const { data, error } = await supabase.from('account_metrics').select('*').eq('trading_account_id', params[0]).order('recorded_at', { ascending: false }).limit(1);
    if (error) throw new Error(error.message);
    return { rows: data || [] };
  }
  if (/^SELECT equity, balance, recorded_at FROM account_metrics/i.test(s)) {
    const { data, error } = await supabase.from('account_metrics').select('equity, balance, recorded_at').eq('trading_account_id', params[0]).order('recorded_at', { ascending: false }).limit(30);
    if (error) throw new Error(error.message);
    return { rows: (data || []).reverse() };
  }
  if (/^INSERT INTO account_metrics/i.test(s)) {
    const [trading_account_id, balance, equity, profit, drawdown, win_rate, total_trades, winning_trades, losing_trades] = params;
    const { error } = await supabase.from('account_metrics').insert({ trading_account_id, balance, equity, profit, drawdown, win_rate, total_trades, winning_trades, losing_trades });
    if (error) throw new Error(error.message);
    return { rows: [] };
  }

  // ── trades ─────────────────────────────────────────────────
  if (/^SELECT \* FROM trades WHERE trading_account_id/i.test(s)) {
    const { data, error } = await supabase.from('trades').select('*').eq('trading_account_id', params[0]).order('close_time', { ascending: false }).limit(50);
    if (error) throw new Error(error.message);
    return { rows: data || [] };
  }
  if (/^INSERT INTO trades.*ON CONFLICT.*ticket.*DO UPDATE/is.test(s)) {
    const [trading_account_id, ticket, symbol, type, volume, open_price, close_price, profit, open_time, close_time] = params;
    const { error } = await supabase.from('trades').upsert(
      { trading_account_id, ticket, symbol, type, volume, open_price, close_price, profit, open_time, close_time },
      { onConflict: 'ticket' }
    );
    if (error) throw new Error(error.message);
    return { rows: [] };
  }

  // ── alerts ─────────────────────────────────────────────────
  if (/^SELECT \* FROM alerts WHERE user_id/i.test(s)) {
    const { data, error } = await supabase.from('alerts').select('*').eq('user_id', params[0]).order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return { rows: data || [] };
  }
  if (/^INSERT INTO alerts.*trading_account_id/i.test(s)) {
    const [user_id, trading_account_id, title, message] = params;
    const { error } = await supabase.from('alerts').insert({ user_id, trading_account_id, title, message });
    if (error) throw new Error(error.message);
    return { rows: [] };
  }
  if (/^INSERT INTO alerts.*VALUES \(\$1,\$2,\$3\)/i.test(s)) {
    const [user_id, title, message] = params;
    const { error } = await supabase.from('alerts').insert({ user_id, title, message });
    if (error) throw new Error(error.message);
    return { rows: [] };
  }

  // ── orders ─────────────────────────────────────────────────
  if (/^INSERT INTO orders.*RETURNING id/i.test(s)) {
    const [user_id, plan_type, account_size, price_usd] = params;
    const { data, error } = await supabase.from('orders').insert({ user_id, plan_type, account_size, price_usd }).select('id').single();
    if (error) throw new Error(error.message);
    return { rows: [data] };
  }
  if (/^UPDATE orders SET nowpayments_id/i.test(s)) {
    const { error } = await supabase.from('orders').update({ nowpayments_id: params[0] }).eq('id', params[1]);
    if (error) throw new Error(error.message);
    return { rows: [] };
  }
  if (/^UPDATE orders SET nowpayments_status=\$1 WHERE id/i.test(s)) {
    const { error } = await supabase.from('orders').update({ nowpayments_status: params[0] }).eq('id', params[1]);
    if (error) throw new Error(error.message);
    return { rows: [] };
  }
  if (/^UPDATE orders SET status.*paid_at=NOW\(\).*RETURNING/i.test(s)) {
    const { data, error } = await supabase.from('orders').update({ status: params[0], nowpayments_status: params[1], paid_at: new Date().toISOString() }).eq('id', params[2]).select('*').single();
    if (error) throw new Error(error.message);
    return { rows: data ? [data] : [] };
  }
  if (/^SELECT id, plan_type, account_size.*FROM orders WHERE id=\$1 AND user_id/i.test(s)) {
    const { data, error } = await supabase.from('orders').select('id, plan_type, account_size, price_usd, status, nowpayments_status, created_at, paid_at').eq('id', params[0]).eq('user_id', params[1]).maybeSingle();
    if (error) throw new Error(error.message);
    return { rows: data ? [data] : [] };
  }

  // ── admin orders JOIN ──────────────────────────────────────
  if (/FROM orders o.*JOIN users u/is.test(s)) {
    const { data: orders, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    const { data: users } = await supabase.from('users').select('id, full_name, email');
    const userMap = {};
    (users || []).forEach(u => { userMap[u.id] = u; });
    const rows = (orders || []).map(o => ({ ...o, full_name: userMap[o.user_id]?.full_name, email: userMap[o.user_id]?.email }));
    return { rows };
  }

  // ── referrals ──────────────────────────────────────────────
  if (/^INSERT INTO referrals/i.test(s)) {
    const [referrer_id, referred_id] = params;
    const { error } = await supabase.from('referrals').upsert({ referrer_id, referred_id }, { onConflict: 'referred_id', ignoreDuplicates: true });
    if (error && error.code !== '23505') throw new Error(error.message);
    return { rows: [] };
  }
  if (/^SELECT COUNT\(\*\) as count FROM referrals WHERE referrer_id/i.test(s)) {
    const { count, error } = await supabase.from('referrals').select('*', { count: 'exact', head: true }).eq('referrer_id', params[0]);
    if (error) throw new Error(error.message);
    return { rows: [{ count: count || 0 }] };
  }
  if (/^SELECT referrer_id FROM referrals WHERE referred_id/i.test(s)) {
    const { data, error } = await supabase.from('referrals').select('referrer_id').eq('referred_id', params[0]);
    if (error) throw new Error(error.message);
    return { rows: data || [] };
  }
  if (/^SELECT referred_id FROM referrals WHERE referrer_id/i.test(s)) {
    const { data, error } = await supabase.from('referrals').select('referred_id').eq('referrer_id', params[0]);
    if (error) throw new Error(error.message);
    return { rows: data || [] };
  }

  // ── affiliate_sales ────────────────────────────────────────
  if (/^SELECT SUM\(amount_usd\).*SUM\(commission_earned\)/i.test(s)) {
    const { data, error } = await supabase.from('affiliate_sales').select('amount_usd, commission_earned').eq('referrer_id', params[0]);
    if (error) throw new Error(error.message);
    const revenue = (data || []).reduce((s, r) => s + parseFloat(r.amount_usd || 0), 0);
    const earned = (data || []).reduce((s, r) => s + parseFloat(r.commission_earned || 0), 0);
    return { rows: [{ revenue, earned }] };
  }
  if (/^SELECT SUM\(amount_usd\) as total FROM affiliate_sales/i.test(s)) {
    const { data, error } = await supabase.from('affiliate_sales').select('amount_usd').eq('referrer_id', params[0]);
    if (error) throw new Error(error.message);
    const total = (data || []).reduce((s, r) => s + parseFloat(r.amount_usd || 0), 0);
    return { rows: [{ total }] };
  }
  if (/^INSERT INTO affiliate_sales/i.test(s)) {
    const [referrer_id, referred_id, order_id, amount_usd, commission_earned] = params;
    const { error } = await supabase.from('affiliate_sales').insert({ referrer_id, referred_id, order_id, amount_usd, commission_earned });
    if (error) throw new Error(error.message);
    return { rows: [] };
  }

  // ── funded traders count (ANY array) ──────────────────────
  if (/SELECT COUNT\(DISTINCT user_id\) as count FROM trading_accounts WHERE user_id = ANY/i.test(s)) {
    const referredIds = params[0];
    const status = params[1];
    if (!referredIds || referredIds.length === 0) return { rows: [{ count: 0 }] };
    const { data, error } = await supabase.from('trading_accounts').select('user_id').in('user_id', referredIds).eq('status', status);
    if (error) throw new Error(error.message);
    const unique = new Set((data || []).map(r => r.user_id));
    return { rows: [{ count: unique.size }] };
  }

  // ── Fallback: log & return empty ──────────────────────────
  console.warn('⚠️  Unmatched SQL query (returned empty):', s.substring(0, 120));
  return { rows: [] };
};

// Stub for connect() used in old trades push (now replaced)
const connect = async () => ({
  query: async (sql, params) => query(sql, params),
  release: () => {},
});

module.exports = { query, connect };
