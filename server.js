const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'f4u_super_secret_jwt_key_2024';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ── Auth Middleware ─────────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
}

// ── SIGNUP ──────────────────────────────────────────────────
app.post('/api/signup', async (req, res) => {
  let { full_name, email, phone, password, ref_code } = req.body;
  if (!full_name || !email || !password)
    return res.status(400).json({ error: 'All fields required' });
    
  email = email.toLowerCase().trim();
  
  // Parse ref code (e.g. F4U00001 -> id 1)
  let referrerId = null;
  if (ref_code) {
    const parsed = parseInt(ref_code.replace(/^F4U/i, ''), 10);
    if (!isNaN(parsed)) referrerId = parsed;
  }
  
  try {
    const { rows: existingEmail } = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingEmail.length > 0) return res.status(409).json({ error: 'Email already registered' });
    
    if (phone) {
      const { rows: existingPhone } = await db.query('SELECT id FROM users WHERE phone = $1', [phone]);
      if (existingPhone.length > 0) return res.status(409).json({ error: 'Phone number already registered' });
    }
    
    const hash = bcrypt.hashSync(password, 10);
    const role = email === 'admin@fundings4u.com' ? 'admin' : 'trader';
    
    const { rows } = await db.query(
      'INSERT INTO users (full_name, email, phone, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [full_name, email, phone || null, hash, role]
    );
    const userId = rows[0].id;
    
    // Save referral if exists
    if (referrerId) {
      try {
        await db.query(
          'INSERT INTO referrals (referrer_id, referred_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [referrerId, userId]
        );
      } catch (err) { console.error('Failed to save referral', err); }
    }
    
    const token = jwt.sign({ id: userId, email, role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: userId, full_name, email, role } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── LOGIN ───────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  let { email, password } = req.body;
  email = (email || '').toLowerCase().trim();
  try {
    const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];
    if (!user || !bcrypt.compareSync(password, user.password_hash))
      return res.status(401).json({ error: 'Invalid credentials' });
    
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── ME ──────────────────────────────────────────────────────
app.get('/api/me', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id, full_name, email, role, created_at FROM users WHERE id = $1', [req.user.id]);
    res.json(rows[0] || null);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── GET DASHBOARD DATA ─────────────────────────────────────
app.get('/api/dashboard', authMiddleware, async (req, res) => {
  try {
    const { rows: allAccounts } = await db.query('SELECT * FROM trading_accounts WHERE user_id = $1 ORDER BY assigned_at ASC', [req.user.id]);
    
    if (allAccounts.length === 0) return res.json({ account: null, allAccounts: [], metrics: null, trades: [], history: [] });

    let accountId = req.query.account_id;
    let account = allAccounts.find(a => a.id == accountId) || allAccounts[0];

    const { rows: metricsRows } = await db.query(
      'SELECT * FROM account_metrics WHERE trading_account_id = $1 ORDER BY recorded_at DESC LIMIT 1',
      [account.id]
    );

    const { rows: trades } = await db.query(
      'SELECT * FROM trades WHERE trading_account_id = $1 ORDER BY close_time DESC LIMIT 50',
      [account.id]
    );

    const { rows: historyData } = await db.query(
      'SELECT equity, balance, recorded_at FROM account_metrics WHERE trading_account_id = $1 ORDER BY recorded_at DESC LIMIT 30',
      [account.id]
    );
    const history = historyData.reverse();

    res.json({ account, allAccounts, metrics: metricsRows[0] || null, trades, history });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── ADMIN: GET ALL USERS ────────────────────────────────────
app.get('/api/admin/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { rows: users } = await db.query(`
      SELECT u.id, u.full_name, u.email, u.role, u.created_at,
             ta.id as account_id, ta.mt5_login, ta.mt5_server, ta.account_size, ta.challenge_type, ta.status
      FROM users u
      LEFT JOIN trading_accounts ta ON ta.user_id = u.id
      ORDER BY u.created_at DESC
    `);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── ADMIN: ASSIGN MT5 ACCOUNT ───────────────────────────────
app.post('/api/admin/assign-account', authMiddleware, adminOnly, async (req, res) => {
  const { user_id, mt5_login, mt5_password, mt5_server, account_size, challenge_type } = req.body;
  try {
    const { rows: existing } = await db.query('SELECT id FROM trading_accounts WHERE user_id = $1', [user_id]);
    if (existing.length > 0) {
      await db.query(
        'UPDATE trading_accounts SET mt5_login=$1, mt5_password=$2, mt5_server=$3, account_size=$4, challenge_type=$5, status=$6 WHERE user_id=$7',
        [mt5_login, mt5_password, mt5_server, account_size, challenge_type, 'active', user_id]
      );
    } else {
      await db.query(
        'INSERT INTO trading_accounts (user_id, mt5_login, mt5_password, mt5_server, account_size, challenge_type, status) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [user_id, mt5_login, mt5_password, mt5_server, account_size, challenge_type, 'active']
      );
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── BOT: GET ACTIVE ACCOUNTS ────────────────────────────────
app.get('/api/bot/accounts', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { rows: accounts } = await db.query(
      'SELECT id as trading_account_id, user_id, mt5_login, mt5_password, mt5_server FROM trading_accounts WHERE status = $1',
      ['active']
    );
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── ADMIN: MANUALLY PUSH METRICS (used by bot later) ───────
app.post('/api/metrics/push', async (req, res) => {
  const { trading_account_id, balance, equity, profit, drawdown, win_rate, total_trades, winning_trades, losing_trades } = req.body;
  try {
    // 1. Insert metrics
    await db.query(`
      INSERT INTO account_metrics (trading_account_id, balance, equity, profit, drawdown, win_rate, total_trades, winning_trades, losing_trades)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [trading_account_id, balance, equity, profit, drawdown, win_rate, total_trades, winning_trades, losing_trades]);

    // 2. Check for violations
    const { rows: accounts } = await db.query('SELECT user_id, account_size, challenge_type, status FROM trading_accounts WHERE id = $1', [trading_account_id]);
    if (accounts.length > 0) {
      const account = accounts[0];
      if (account.status === 'active') {
        let dailyPercent = 0.04;
        let maxPercent = 0.08;
        
        // Adjust for unlimited accounts
        if (account.challenge_type === 'unlimited') {
          dailyPercent = 0.05;
          maxPercent = 0.10;
        }

        const accSize = parseFloat(account.account_size);
        const dailyLimit = accSize * dailyPercent;
        const maxLimit = accSize * maxPercent;
        
        const runningBreach = parseFloat(profit) <= -dailyLimit;
        const equityBreach = parseFloat(equity) <= (accSize - maxLimit);

        if (runningBreach || equityBreach) {
          // Trigger violation
          await db.query('UPDATE trading_accounts SET status = $1 WHERE id = $2', ['breached', trading_account_id]);
          
          const reason = runningBreach 
            ? `Open trades exceeded the ${dailyPercent * 100}% daily active drawdown limit.` 
            : `Account equity dropped below the ${maxPercent * 100}% maximum drawdown limit.`;
            
          await db.query(
            'INSERT INTO alerts (user_id, trading_account_id, title, message) VALUES ($1, $2, $3, $4)',
            [account.user_id, trading_account_id, 'Rule Violation: Drawdown Limit Hit', reason]
          );
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── ADMIN: MANUALLY PUSH TRADES (used by bot later) ───────
app.post('/api/trades/push', async (req, res) => {
  const { trading_account_id, trades } = req.body;
  if (!trading_account_id || !Array.isArray(trades)) return res.status(400).json({error: 'Invalid data'});
  try {
    for (const t of trades) {
      // Prefix ticket to avoid global collision across different mt5 servers
      const globalTicket = `${trading_account_id}-${t.ticket}`;
      await db.query(`
        INSERT INTO trades (trading_account_id, ticket, symbol, type, volume, open_price, close_price, profit, open_time, close_time)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (ticket) DO UPDATE SET
          close_price = EXCLUDED.close_price,
          profit = EXCLUDED.profit,
          close_time = EXCLUDED.close_time
      `, [
        trading_account_id, globalTicket, t.symbol, t.type, t.volume, 
        t.open_price, t.close_price, t.profit, 
        t.open_time ? new Date(t.open_time * 1000) : null, 
        t.close_time ? new Date(t.close_time * 1000) : null
      ]);
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── GET ALERTS ──────────────────────────────────────────────
app.get('/api/alerts', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM alerts WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── ADMIN: PUSH TRADES ──────────────────────────────────────
app.post('/api/trades/push', async (req, res) => {
  const { trading_account_id, trades } = req.body;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    for (const t of trades) {
      await client.query(`
        INSERT INTO trades (trading_account_id, ticket, symbol, type, volume, open_price, close_price, profit, open_time, close_time)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (ticket) DO UPDATE SET 
          close_price=EXCLUDED.close_price, 
          profit=EXCLUDED.profit, 
          close_time=EXCLUDED.close_time
      `, [trading_account_id, t.ticket, t.symbol, t.type, t.volume, t.open_price, t.close_price, t.profit, t.open_time, t.close_time]);
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    client.release();
  }
});

// ── CHECKOUT: CREATE PAYMENT ────────────────────────────────
app.post('/api/checkout/create', authMiddleware, async (req, res) => {
  const { plan_type, account_size, price_usd } = req.body;
  if (!plan_type || !account_size || !price_usd)
    return res.status(400).json({ error: 'Missing plan details' });

  const NP_API_KEY = process.env.NOWPAYMENTS_API_KEY;

  try {
    // 1. Create order in DB
    const { rows } = await db.query(
      'INSERT INTO orders (user_id, plan_type, account_size, price_usd) VALUES ($1,$2,$3,$4) RETURNING id',
      [req.user.id, plan_type, account_size, price_usd]
    );
    const orderId = rows[0].id;

    // 2. If no API key yet, return a sandbox preview mode
    if (!NP_API_KEY || NP_API_KEY === 'YOUR_NOWPAYMENTS_API_KEY_HERE') {
      return res.json({
        sandbox: true,
        order_id: orderId,
        message: 'NOWPayments API key not configured. Add NOWPAYMENTS_API_KEY to .env to enable live payments.'
      });
    }

    // 3. Call NOWPayments API to create invoice
    const npRes = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: {
        'x-api-key': NP_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        price_amount: price_usd,
        price_currency: 'usd',
        pay_currency: 'usdt',
        ipn_callback_url: `${process.env.APP_URL || 'http://localhost:3000'}/api/checkout/webhook`,
        order_id: `F4U-${orderId}`,
        order_description: `Fundings4U ${plan_type} ${account_size} Account`,
        success_url: `${process.env.APP_URL || 'http://localhost:3000'}/checkout/success?order=${orderId}`,
        cancel_url: `${process.env.APP_URL || 'http://localhost:3000'}/checkout`
      })
    });

    const npData = await npRes.json();
    if (!npRes.ok) throw new Error(npData.message || 'NOWPayments error');

    // 4. Save NOWPayments ID to order
    await db.query(
      'UPDATE orders SET nowpayments_id=$1 WHERE id=$2',
      [npData.id, orderId]
    );

    res.json({ invoice_url: npData.invoice_url, order_id: orderId });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: error.message || 'Payment creation failed' });
  }
});

// ── CHECKOUT: NOWPAYMENTS WEBHOOK (IPN) ─────────────────────
app.post('/api/checkout/webhook', express.json(), async (req, res) => {
  const crypto = require('crypto');
  const IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET;
  
  try {
    // Verify signature if IPN secret is set
    if (IPN_SECRET && IPN_SECRET !== 'YOUR_IPN_SECRET_HERE') {
      const sig = req.headers['x-nowpayments-sig'];
      const sortedBody = JSON.stringify(req.body, Object.keys(req.body).sort());
      const hmac = crypto.createHmac('sha512', IPN_SECRET).update(sortedBody).digest('hex');
      if (hmac !== sig) return res.status(401).json({ error: 'Invalid signature' });
    }

    const { order_id: rawOrderId, payment_status, payment_id } = req.body;
    const orderId = String(rawOrderId).replace('F4U-', '');

    // Only handle confirmed/finished payments
    if (!['confirmed', 'finished'].includes(payment_status)) {
      await db.query('UPDATE orders SET nowpayments_status=$1 WHERE id=$2', [payment_status, orderId]);
      return res.json({ received: true });
    }

    // Mark order as paid
    const { rows: orderRows } = await db.query(
      'UPDATE orders SET status=$1, nowpayments_status=$2, paid_at=NOW() WHERE id=$3 RETURNING *',
      ['paid', payment_status, orderId]
    );
    const order = orderRows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Parse account size string like "$5K" -> 5000, "$100K" -> 100000
    const sizeStr = order.account_size.replace('$', '').replace('K', '000').replace('M', '000000');
    const sizeNum = parseFloat(sizeStr);

    // Create trading account (status: setup_pending — admin assigns MT5 next)
    const { rows: accountRows } = await db.query(
      'INSERT INTO trading_accounts (user_id, account_size, challenge_type, status) VALUES ($1,$2,$3,$4) RETURNING id',
      [order.user_id, sizeNum, order.plan_type, 'setup_pending']
    );

    // Create welcome alert for the trader
    await db.query(
      'INSERT INTO alerts (user_id, title, message) VALUES ($1,$2,$3)',
      [order.user_id,
       '🎉 Payment Confirmed! Account Setup In Progress',
       `Your ${order.account_size} ${order.plan_type} account has been purchased! Our team is setting up your MT5 credentials. You'll receive another notification as soon as your account is ready to trade.`]
    );

    // --- Affiliate Logic ---
    try {
      const { rows: refRows } = await db.query('SELECT referrer_id FROM referrals WHERE referred_id=$1', [order.user_id]);
      if (refRows.length > 0) {
        const referrerId = refRows[0].referrer_id;
        const { rows: revRows } = await db.query('SELECT SUM(amount_usd) as total FROM affiliate_sales WHERE referrer_id=$1', [referrerId]);
        const totalRev = parseFloat(revRows[0].total) || 0;
        
        let commRate = 0.10; // Scout
        if (totalRev >= 25000) commRate = 0.30; // Legend
        else if (totalRev >= 6000) commRate = 0.20; // Apex
        else if (totalRev >= 1500) commRate = 0.15; // Hunter
        
        const earned = parseFloat(order.price_usd) * commRate;
        await db.query(
          'INSERT INTO affiliate_sales (referrer_id, referred_id, order_id, amount_usd, commission_earned) VALUES ($1,$2,$3,$4,$5)',
          [referrerId, order.user_id, order.id, order.price_usd, earned]
        );
      }
    } catch(err) {
      console.error('Affiliate tracking error in webhook:', err);
    }
    // -----------------------

    console.log(`✅ Payment confirmed for order ${orderId}, user ${order.user_id}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ── CHECKOUT: GET ORDER STATUS ───────────────────────────────
app.get('/api/checkout/order/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, plan_type, account_size, price_usd, status, nowpayments_status, created_at, paid_at FROM orders WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Order not found' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── ADMIN: GET ALL ORDERS ────────────────────────────────────
app.get('/api/admin/orders', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT o.*, u.full_name, u.email
      FROM orders o
      JOIN users u ON u.id = o.user_id
      ORDER BY o.created_at DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── SERVE PAGES ─────────────────────────────────────────────

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'code.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, 'signup.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/help-center', (req, res) => res.sendFile(path.join(__dirname, 'help-center.html')));
app.get('/faq', (req, res) => res.sendFile(path.join(__dirname, 'faq.html')));
app.get('/trading-rules', (req, res) => res.sendFile(path.join(__dirname, 'trading-rules.html')));
app.get('/payout-guide', (req, res) => res.sendFile(path.join(__dirname, 'payout-guide.html')));
app.get('/partner', (req, res) => res.sendFile(path.join(__dirname, 'partner.html')));

app.get('/checkout', (req, res) => res.sendFile(path.join(__dirname, 'checkout.html')));
app.get('/checkout/success', (req, res) => res.sendFile(path.join(__dirname, 'checkout.html')));

// ── AFFILIATE ENDPOINTS ───────────────────────────────────────
app.get('/api/affiliate/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 1. Total Referrals Count
    const { rows: refCountRows } = await db.query('SELECT COUNT(*) as count FROM referrals WHERE referrer_id=$1', [userId]);
    const totalReferrals = parseInt(refCountRows[0].count) || 0;
    
    // 2. Total Revenue & Commissions
    const { rows: salesRows } = await db.query('SELECT SUM(amount_usd) as revenue, SUM(commission_earned) as earned FROM affiliate_sales WHERE referrer_id=$1', [userId]);
    const totalRevenue = parseFloat(salesRows[0].revenue) || 0;
    const totalEarned = parseFloat(salesRows[0].earned) || 0;
    
    // 3. Determine Tier
    let tier = 'Scout';
    let discount = 10;
    let commissionRate = 10;
    let nextTierReq = 1500;
    let accountsAllocation = 'None';
    let successShare = '0';
    
    if (totalRevenue >= 25000) {
      tier = 'Legend'; discount = 25; commissionRate = 30; nextTierReq = null;
      accountsAllocation = '2×$25K, 1×$50K'; successShare = 'First 50 Traders';
    } else if (totalRevenue >= 6000) {
      tier = 'Apex'; discount = 20; commissionRate = 20; nextTierReq = 25000;
      accountsAllocation = '2×$5K, 1×$25K'; successShare = 'First 20 Traders';
    } else if (totalRevenue >= 1500) {
      tier = 'Hunter'; discount = 15; commissionRate = 15; nextTierReq = 6000;
      accountsAllocation = '2×$5K'; successShare = 'First 5 Traders';
    }
    
    // 4. Funded Traders Count (for Success Share progress)
    // Find all users this person referred
    const { rows: referredRows } = await db.query('SELECT referred_id FROM referrals WHERE referrer_id=$1', [userId]);
    const referredIds = referredRows.map(r => r.referred_id);
    let fundedCount = 0;
    if (referredIds.length > 0) {
       const { rows: fundedRows } = await db.query('SELECT COUNT(DISTINCT user_id) as count FROM trading_accounts WHERE user_id = ANY($1) AND status = $2', [referredIds, 'active']);
       fundedCount = parseInt(fundedRows[0].count) || 0;
    }
    
    res.json({
      totalReferrals,
      totalRevenue,
      totalEarned,
      tier,
      discount,
      commissionRate,
      nextTierReq,
      accountsAllocation,
      successShare,
      fundedCount
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/affiliate/leaderboard', async (req, res) => {
  try {
    // Generate automated realistic dummy data that changes exactly once a week
    const now = new Date();
    // Milliseconds in a week
    const weekNumber = Math.floor(now.getTime() / (1000 * 60 * 60 * 24 * 7));
    
    // Deterministic pseudo-random number generator seeded by the current week
    let seed = weekNumber * 12345;
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const firstNames = ['Alex', 'Sarah', 'Michael', 'David', 'Emma', 'James', 'Olivia', 'Liam', 'Noah', 'Mia', 'Lucas', 'Harper', 'Ethan', 'Amelia', 'Oliver', 'Isabella', 'Elijah', 'Sophia', 'Logan', 'Ava', 'Charlotte', 'Mason', 'Evelyn', 'Benjamin'];
    const lastInitials = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    const leaderboard = [];
    
    // Top revenue between $80,000 and $180,000 for realistic monthly stats
    let currentMaxRev = 80000 + (random() * 100000); 
    
    for (let i = 0; i < 10; i++) {
      const name = firstNames[Math.floor(random() * firstNames.length)] + ' ' + lastInitials[Math.floor(random() * lastInitials.length)] + '.';
      
      leaderboard.push({
        name,
        revenue: Math.round(currentMaxRev)
      });
      
      // Drop the revenue for the next rank by 5% to 20%
      currentMaxRev = currentMaxRev * (1 - (0.05 + random() * 0.15));
    }
    
    res.json(leaderboard);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`\n✅ Fundings4U server running at http://localhost:${PORT}`);
    console.log(`   Landing page   → http://localhost:${PORT}/`);
    console.log(`   Login          → http://localhost:${PORT}/login`);
    console.log(`   Sign Up        → http://localhost:${PORT}/signup`);
    console.log(`   Dashboard      → http://localhost:${PORT}/dashboard`);
    console.log(`   Admin Panel    → http://localhost:${PORT}/admin`);
    console.log(`\n   Admin login: admin@fundings4u.com / Admin@123\n`);
  });
}

module.exports = app;
