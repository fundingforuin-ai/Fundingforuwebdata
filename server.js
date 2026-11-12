const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./db');
const emailService = require('./email');

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

// ── Affiliate Helpers ────────────────────────────────────────
function formatAffCode(userId) {
  return 'F4U' + String(userId).padStart(5, '0');
}

function getAffiliateLink(userId) {
  return `https://fundings4u.com/signup?ref=${formatAffCode(userId)}`;
}

function getAffiliateTierInfo(totalRevenue) {
  const rev = parseFloat(totalRevenue) || 0;
  if (rev >= 25000) {
    return {
      tier: 'Legend', discount: 25, commissionRate: 30, nextTierReq: null,
      accountsAllocation: '2×$25K, 1×$50K', successShare: 'First 50 Traders', successShareRate: 5
    };
  } else if (rev >= 6000) {
    return {
      tier: 'Apex', discount: 20, commissionRate: 20, nextTierReq: 25000,
      accountsAllocation: '2×$5K, 1×$25K', successShare: 'First 20 Traders', successShareRate: 5
    };
  } else if (rev >= 1500) {
    return {
      tier: 'Hunter', discount: 15, commissionRate: 15, nextTierReq: 6000,
      accountsAllocation: '2×$5K', successShare: 'First 5 Traders', successShareRate: 5
    };
  }
  return {
    tier: 'Scout', discount: 10, commissionRate: 10, nextTierReq: 1500,
    accountsAllocation: 'None', successShare: 'Locked', successShareRate: 0
  };
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
    const cleaned = String(ref_code).trim();
    const parsed = parseInt(cleaned.replace(/^F4U/i, ''), 10);
    if (!isNaN(parsed) && parsed > 0) referrerId = parsed;
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
    
    // Save referral if exists (verify referrer exists & prevent self-referral)
    if (referrerId && referrerId !== userId) {
      try {
        const { data: referrerUser } = await _sb.from('users').select('id').eq('id', referrerId).maybeSingle();
        if (referrerUser) {
          const { data: existingRef } = await _sb.from('referrals').select('id').eq('referred_id', userId).maybeSingle();
          if (!existingRef) {
            const { error: refErr } = await _sb.from('referrals').insert({ referrer_id: referrerId, referred_id: userId });
            if (refErr) console.error('Failed to insert referral:', refErr.message);
          }
        }
      } catch (err) { console.error('Failed to save referral', err); }
    }
    
    // Send Welcome Email (Wait for it to finish so Vercel doesn't kill it)
    try {
      await emailService.sendWelcomeEmail(email, full_name);
    } catch(e) { console.error('Welcome email failed:', e); }
    
    const token = jwt.sign({ id: userId, email, role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: userId, full_name, email, role } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Internal Server Error', stack: error.stack });
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
    res.status(500).json({ error: error.message || 'Internal Server Error', stack: error.stack });
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

// ── ADMIN: GET ALL USERS (PAGINATED) ──────────────────────────
app.get('/api/admin/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(500, parseInt(req.query.limit) || 200));
    const search = (req.query.search || '').trim();

    // Query all registered users from DB
    const { rows: allUsers } = await db.query(`
      SELECT u.id, u.full_name, u.email, u.phone, u.role, u.created_at,
             ta.id as account_id, ta.mt5_login, ta.mt5_server, ta.account_size, ta.challenge_type, ta.status
      FROM users u
      LEFT JOIN trading_accounts ta ON ta.user_id = u.id
      ORDER BY u.created_at DESC
    `);

    // Filter out admin users from traders list
    let traders = (allUsers || []).filter(u => u.role !== 'admin');

    if (search) {
      const q = search.toLowerCase();
      traders = traders.filter(u =>
        (u.full_name && u.full_name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.phone && String(u.phone).includes(q)) ||
        (u.mt5_login && String(u.mt5_login).includes(q)) ||
        (u.id && String(u.id).includes(q))
      );
    }

    const total = traders.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;

    // If export=all or limit=all is requested, return all traders without slicing
    const isExport = req.query.export === 'csv' || req.query.limit === 'all';
    const paginatedUsers = isExport ? traders : traders.slice(startIndex, startIndex + limit);

    // Compute overview stats across all non-admin registered traders
    const activeCount = traders.filter(u => u.status === 'active').length;
    const pendingCount = traders.filter(u => u.status === 'pending' || u.status === 'setup_pending').length;
    const noneCount = traders.filter(u => !u.account_id).length;

    res.json({
      users: paginatedUsers,
      total,
      page,
      limit,
      totalPages,
      stats: {
        total,
        active: activeCount,
        pending: pendingCount,
        none: noneCount
      }
    });
  } catch (error) {
    console.error('Admin users error:', error);
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

    // Get user details for email
    const { rows: userRows } = await db.query('SELECT full_name, email FROM users WHERE id = $1', [user_id]);
    if (userRows.length > 0) {
      const u = userRows[0];
      // Send Account Provisioned Email (Await to prevent Vercel freeze)
      try {
        await emailService.sendAccountProvisionedEmail(u.email, u.full_name, challenge_type, '$' + account_size.toLocaleString(), mt5_login, mt5_password, mt5_server);
      } catch(e) { console.error('Provision email failed:', e); }
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── ADMIN: EDIT USER PROFILE ────────────────────────────────
app.post('/api/admin/edit-user', authMiddleware, adminOnly, async (req, res) => {
  const { user_id, full_name, email, phone, new_password } = req.body;
  try {
    if (new_password) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(new_password, salt);
      await db.query(
        'UPDATE users SET full_name = $1, email = $2, phone = $3, password_hash = $4 WHERE id = $5',
        [full_name, email, phone || null, hash, user_id]
      );
    } else {
      await db.query(
        'UPDATE users SET full_name = $1, email = $2, phone = $3 WHERE id = $4',
        [full_name, email, phone || null, user_id]
      );
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error editing user:', error);
    res.status(500).json({ error: 'Failed to update user profile.' });
  }
});

// ════════════════════════════════════════════════════════════
// ── GIVEAWAY SYSTEM (uses Supabase client directly) ─────────
// ════════════════════════════════════════════════════════════

const { createClient: createSbClient } = require('@supabase/supabase-js');
const _sb = createSbClient(
  process.env.SUPABASE_URL || 'https://wcvghufcsodvhckfwqke.supabase.co',
  process.env.SUPABASE_SECRET_KEY || '',
  { auth: { persistSession: false } }
);

// ── Global pools for realistic automated giveaway data ──────
const GIVEAWAY_FIRST_NAMES = [
  'Ahmed', 'Hamza', 'Carlos', 'Liam', 'Arjun', 'Sofia', 'David', 'Yusuf', 'Maria', 'Alex',
  'Tariq', 'Elena', 'James', 'Fatima', 'Lucas', 'Andrei', 'Mohammed', 'Sarah', 'Rahul', 'Viktor',
  'Amina', 'Daniel', 'Ivan', 'Priya', 'Omar', 'Anya', 'Samuel', 'Bilal', 'Julia', 'Kwame',
  'Nadia', 'Leo', 'Rania', 'Emmanuel', 'Aisha', 'Marco', 'Zara', 'Felix', 'Deepak', 'Noura',
  'Tunde', 'Carmen', 'Vikram', 'Layla', 'Kevin', 'Pita', 'Amara', 'Stefan', 'Riya', 'Musa',
  'Hassan', 'Tomás', 'Amira', 'Chukwuemeka', 'Yuki', 'Darius', 'Fatou', 'Muhammad', 'Anastasia', 'Kwabena',
  'Nasrin', 'Diego', 'Chiamaka', 'Petros', 'Zainab', 'Adebayo', 'Lena', 'Siddharth', 'Mariam', 'Olumide',
  'Wanjiku', 'Miroslav', 'Thanh', 'Rohan', 'Fatoumata', 'Aleksei', 'Ethan', 'Noah', 'Chloe', 'Oliver',
  'Mateo', 'Kenji', 'Ananya', 'Gabriel', 'Santiago', 'Mateo', 'Sebastián', 'Alejandro', 'Zayd', 'Adil',
  'Kareem', 'Sami', 'Leila', 'Noor', 'Farah', 'Mina', 'Kenzo', 'Hiroshi', 'Sora', 'Mei',
  'Ji-hoon', 'Min-jun', 'Seo-yeon', 'Elijah', 'Mason', 'Harper', 'Evelyn', 'Benjamin', 'Mia', 'Lucas'
];

const GIVEAWAY_LAST_NAMES = [
  'Al-Rashid', 'Khan', 'Mendez', "O'Brien", 'Sharma', 'Novak', 'Osei', 'Ibrahim', 'Santos', 'Kowalski',
  'Hussain', 'Popescu', 'Mwangi', 'Al-Zahra', 'Ferreira', 'Ionescu', 'Al-Farsi', "O'Connor", 'Patel', 'Kovalev',
  'Diallo', 'Okafor', 'Petrov', 'Nair', 'Abdullah', 'Koroleva', 'Asante', 'Malik', 'Martins', 'Asiedu',
  'Hassan', 'Müller', 'Khalil', 'Adjei', 'Mohammed', 'Ricci', 'Ahmed', 'Mensah', 'Verma', 'Al-Hamdan',
  'Adeyemi', 'López', 'Singh', 'Al-Amin', 'Otieno', 'Havili', 'Traoré', 'Nowak', 'Desai', 'Kone',
  'Al-Mutairi', 'Krishnan', 'García', 'Benali', 'Nwachukwu', 'Tanaka', 'Zubair', 'Petrova', 'Hosseini', 'Vargas',
  'Obi', 'Papadopoulos', 'Al-Rashidi', 'Ogundimu', 'Gupta', 'Al-Mansoori', 'Adeyinka', 'Kamau', 'Nguyen', 'Kapoor',
  'Volkov', 'Smith', 'Johnson', 'Williams', 'Davies', 'Dubois', 'Silva', 'Fernandez', 'Gomez', 'Morales',
  'Reyes', 'Takahashi', 'Suzuki', 'Sato', 'Watanabe', 'Kim', 'Park', 'Lee', 'Choi', 'Ali',
  'Mansour', 'Suleiman', 'Bakr', 'Nasser', 'Fayed', 'Darwish', 'Habib', 'Abadi', 'Jaber', 'Zaki'
];

const GIVEAWAY_COUNTRIES = [
  'United Arab Emirates', 'Pakistan', 'Mexico', 'Ireland', 'India', 'Poland', 'Ghana', 'Nigeria', 'Brazil',
  'Romania', 'Kenya', 'Morocco', 'Oman', 'Senegal', 'Saudi Arabia', 'Portugal', 'Egypt', 'Germany',
  'Jordan', 'Bangladesh', 'Italy', 'United Kingdom', 'Kuwait', 'Spain', 'Argentina', 'Japan', 'Colombia',
  'Greece', 'Czech Republic', 'Vietnam', 'United States', 'Canada', 'Australia', 'South Africa',
  'Singapore', 'Malaysia', 'France', 'Netherlands', 'Turkey', 'Philippines', 'Indonesia', 'Thailand',
  'Chile', 'Sweden', 'Switzerland', 'Austria', 'Norway', 'Qatar', 'Bahrain'
];

const GIVEAWAY_TIERS = [
  '$5,000 Unlimited',
  '$5,000',
  '$25,000',
  '$50,000',
  '$100,000',
  '$150,000'
];

const GIVEAWAY_EMAIL_DOMAINS = [
  'gmail.com',
  'gmail.com',
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'proton.me'
];

let _isGiveawaySyncing = false;
let _lastGiveawaySyncTs = 0;

// Autonomous state helper: seeds today if missing & resolves daily winners strictly from seed data
async function ensureDailyGiveawayState(force = false) {
  const nowMs = Date.now();
  if (_isGiveawaySyncing) return;
  if (!force && nowMs - _lastGiveawaySyncTs < 60000) {
    // Throttled to max once per minute
    return;
  }
  _isGiveawaySyncing = true;
  _lastGiveawaySyncTs = nowMs;

  try {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    // ── 1. HISTORICAL & DAILY WINNER SELECTION ─────────────────
    // Draw closes daily at 14:30 UTC (8:00 PM IST).
    // If today is past 14:30 UTC, today's winner can be selected.
    // If before 14:30 UTC, winners are required through yesterday.
    const isTodayClosed = (now.getUTCHours() > 14) || (now.getUTCHours() === 14 && now.getUTCMinutes() >= 30);

    const yesterdayDate = new Date();
    yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

    const targetEndDayStr = isTodayClosed ? today : yesterdayStr;

    // Check last 30 days to ensure continuous rolling winners board
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const { data: existingWinners } = await _sb
      .from('giveaway_winners')
      .select('draw_date')
      .gte('draw_date', thirtyDaysAgoStr);

    const existingWinnerDates = new Set((existingWinners || []).map(w => w.draw_date));

    let checkDate = new Date(thirtyDaysAgoStr + 'T00:00:00Z');
    const endDate = new Date(targetEndDayStr + 'T00:00:00Z');

    while (checkDate <= endDate) {
      const dStr = checkDate.toISOString().split('T')[0];

      if (!existingWinnerDates.has(dStr)) {
        // Winner missing for this day: pick STRICTLY from fake seed data (never real users!)
        const { data: fakeEntries } = await _sb
          .from('giveaway_entries')
          .select('id, full_name, country, prize_tier, draw_date')
          .eq('draw_date', dStr)
          .eq('is_fake', true);

        let chosen = null;
        if (fakeEntries && fakeEntries.length > 0) {
          chosen = fakeEntries[Math.floor(Math.random() * fakeEntries.length)];
          // Mark as winner in entries table
          await _sb.from('giveaway_entries').update({ is_winner: true }).eq('id', chosen.id);
        } else {
          // If no seeded entries exist for this past day, generate a realistic winner record
          const fn = GIVEAWAY_FIRST_NAMES[Math.floor(Math.random() * GIVEAWAY_FIRST_NAMES.length)];
          const ln = GIVEAWAY_LAST_NAMES[Math.floor(Math.random() * GIVEAWAY_LAST_NAMES.length)];
          chosen = {
            full_name: `${fn} ${ln}`,
            country: GIVEAWAY_COUNTRIES[Math.floor(Math.random() * GIVEAWAY_COUNTRIES.length)],
            prize_tier: GIVEAWAY_TIERS[Math.floor(Math.random() * GIVEAWAY_TIERS.length)],
            draw_date: dStr
          };
        }

        const winTier = chosen.prize_tier || '$5,000 Unlimited';
        await _sb.from('giveaway_winners').insert({
          user_id: null, // Always null: strictly seed winners, never real users
          full_name: chosen.full_name,
          country: chosen.country || 'United Arab Emirates',
          account_size: winTier,
          prize_tier: winTier,
          draw_date: dStr,
          announced_at: new Date(checkDate.getTime() + (14.5 * 3600 * 1000)).toISOString()
        });

        existingWinnerDates.add(dStr);
      }
      checkDate.setUTCDate(checkDate.getUTCDate() + 1);
    }

    // ── 2. SEED TODAY'S PARTICIPANTS (~250 entries) ───────────
    const { count: currentTodayCount } = await _sb
      .from('giveaway_entries')
      .select('id', { count: 'exact', head: true })
      .eq('draw_date', today);

    const neededToday = Math.max(0, 250 - (currentTodayCount || 0));
    if (neededToday > 0) {
      const dayStart = new Date(today + 'T00:00:00Z').getTime();
      const currentMs = Date.now();
      const toInsert = [];

      for (let i = 0; i < neededToday; i++) {
        const fn = GIVEAWAY_FIRST_NAMES[Math.floor(Math.random() * GIVEAWAY_FIRST_NAMES.length)];
        const ln = GIVEAWAY_LAST_NAMES[Math.floor(Math.random() * GIVEAWAY_LAST_NAMES.length)];
        const country = GIVEAWAY_COUNTRIES[Math.floor(Math.random() * GIVEAWAY_COUNTRIES.length)];
        const prize_tier = GIVEAWAY_TIERS[Math.floor(Math.random() * GIVEAWAY_TIERS.length)];
        const domain = GIVEAWAY_EMAIL_DOMAINS[Math.floor(Math.random() * GIVEAWAY_EMAIL_DOMAINS.length)];
        const cleanName = (fn + ln).toLowerCase().replace(/[^a-z]/g, '');
        const emailNum = Math.floor(Math.random() * 9000 + 1000);

        // Distribute timestamps naturally between 00:00 UTC and current time
        // Include recent timestamps so the live feed has fresh activity
        const randomTime = new Date(dayStart + Math.random() * Math.max(1000, currentMs - dayStart));

        toInsert.push({
          user_id: null,
          full_name: `${fn} ${ln}`,
          email: `${cleanName}${emailNum}@${domain}`,
          country,
          prize_tier,
          draw_date: today,
          is_fake: true,
          created_at: randomTime.toISOString()
        });
      }

      // Batch insert in chunks of 50
      for (let i = 0; i < toInsert.length; i += 50) {
        const batch = toInsert.slice(i, i + 50);
        const { error: batchErr } = await _sb.from('giveaway_entries').insert(batch);
        if (batchErr) console.error('Error inserting giveaway seed batch:', batchErr.message);
      }
    }
  } catch (err) {
    console.error('Error in ensureDailyGiveawayState:', err);
  } finally {
    _isGiveawaySyncing = false;
  }
}

// Public: get today's stats + recent winners (self-heals automatically)
app.get('/api/giveaway/today', async (req, res) => {
  try {
    // Automatically guarantee today is seeded and past winners are up-to-date
    await ensureDailyGiveawayState();

    const today = new Date().toISOString().split('T')[0];

    // Total slot count today
    const { count: slotCount } = await _sb
      .from('giveaway_entries')
      .select('id', { count: 'exact', head: true })
      .eq('draw_date', today);

    // Past winners (last 30 days)
    const { data: winners } = await _sb
      .from('giveaway_winners')
      .select('full_name, country, account_size, draw_date')
      .order('draw_date', { ascending: false })
      .limit(30);

    // Recent entries for live feed (last 50, no emails)
    const { data: feed } = await _sb
      .from('giveaway_entries')
      .select('full_name, country, created_at')
      .eq('draw_date', today)
      .order('created_at', { ascending: false })
      .limit(50);

    res.json({ slotCount: slotCount || 0, winners: winners || [], feed: feed || [] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Vercel Cron Endpoint: scheduled daily rollover / check
app.all('/api/cron/giveaway', async (req, res) => {
  try {
    await ensureDailyGiveawayState(true);
    res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (e) {
    console.error('Cron giveaway error:', e);
    res.status(500).json({ error: 'Cron error' });
  }
});

// Auth required: enter giveaway — one entry per day per user
app.post('/api/giveaway/enter', authMiddleware, async (req, res) => {
  const { country, device_fingerprint, prize_tier } = req.body;
  const userId = req.user.id;
  const today = new Date().toISOString().split('T')[0];

  // Extract real IP (Vercel sets x-forwarded-for)
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const userAgent = req.headers['user-agent'] || '';

  try {
    // Get user info
    const { data: userData } = await _sb.from('users').select('full_name, email').eq('id', userId).single();
    if (!userData) return res.status(404).json({ error: 'User not found' });
    const { full_name, email } = userData;

    // ── FRAUD CHECKS ──────────────────────────────────────────

    // 1. Already entered by this user account today
    const { data: existingUser } = await _sb
      .from('giveaway_entries')
      .select('id')
      .eq('user_id', userId)
      .eq('draw_date', today)
      .eq('is_fake', false)
      .maybeSingle();
    if (existingUser) return res.status(409).json({ error: 'Already entered today' });

    // 2. Same IP address already used today (one entry per IP)
    if (ip && ip !== '::1' && ip !== '127.0.0.1') {
      const { data: existingIp } = await _sb
        .from('giveaway_entries')
        .select('id, full_name')
        .eq('ip_address', ip)
        .eq('draw_date', today)
        .eq('is_fake', false)
        .maybeSingle();
      if (existingIp) return res.status(409).json({
        error: `This IP address has already been used to enter today's draw. One entry per location per day.`
      });
    }

    // 3. Same device fingerprint already used today
    if (device_fingerprint) {
      const { data: existingFp } = await _sb
        .from('giveaway_entries')
        .select('id')
        .eq('device_fingerprint', device_fingerprint)
        .eq('draw_date', today)
        .eq('is_fake', false)
        .maybeSingle();
      if (existingFp) return res.status(409).json({
        error: `This device has already been used to enter today's draw.`
      });
    }

    // ── Entry cap (optional) ──────────────────────────────────
    // Removing the 25 limit since we now want hundreds of entries per day and pick 25 winners from them.

    // ── Geo lookup from IP ────────────────────────────────────
    let geo_city = '', geo_region = '', geo_isp = '';
    try {
      if (ip && ip !== '::1' && ip !== '127.0.0.1') {
        const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          geo_city   = geoData.city || '';
          geo_region = geoData.region || '';
          geo_isp    = geoData.org || '';
        }
      }
    } catch(e) { /* geo lookup is best-effort */ }

    // ── Insert entry ──────────────────────────────────────────
    const { error: insertErr } = await _sb.from('giveaway_entries').insert({
      user_id: userId,
      full_name,
      email,
      country: country || geo_city || 'Unknown',
      draw_date: today,
      is_fake: false,
      ip_address: ip,
      device_fingerprint: device_fingerprint || null,
      user_agent: userAgent.substring(0, 300),
      geo_city,
      geo_region,
      geo_isp,
      prize_tier: prize_tier || '$5,000'
    });
    if (insertErr) throw new Error(insertErr.message);

    res.json({ success: true, message: 'Entered successfully!' });
  } catch (e) {
    console.error('Giveaway enter error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: get today's real entries
app.get('/api/admin/giveaway/entries', authMiddleware, adminOnly, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Ensure state is synced
    await ensureDailyGiveawayState();

    const { data: entries } = await _sb
      .from('giveaway_entries')
      .select('id, full_name, email, country, is_winner, created_at, ip_address, device_fingerprint, geo_city, geo_region, geo_isp, prize_tier, user_agent')
      .eq('draw_date', today)
      .eq('is_fake', false)
      .order('created_at', { ascending: false });

    const { count: totalSlots } = await _sb
      .from('giveaway_entries')
      .select('id', { count: 'exact', head: true })
      .eq('draw_date', today);

    // Fetch today's winner if already recorded
    const { data: todayWinner } = await _sb
      .from('giveaway_winners')
      .select('full_name, country, account_size, draw_date')
      .eq('draw_date', today)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    res.json({ entries: entries || [], totalSlots: totalSlots || 0, todayWinner: todayWinner || null });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: pick a winner manually (optional admin override)
app.post('/api/admin/giveaway/pick-winner', authMiddleware, adminOnly, async (req, res) => {
  const { entry_id } = req.body;
  try {
    const { data: entry } = await _sb.from('giveaway_entries').select('*').eq('id', entry_id).single();
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    await _sb.from('giveaway_entries').update({ is_winner: true }).eq('id', entry_id);

    await _sb.from('giveaway_winners').insert({
      user_id: entry.user_id,
      full_name: entry.full_name,
      country: entry.country,
      account_size: entry.prize_tier || '$5,000',
      draw_date: entry.draw_date
    });

    try {
      await emailService.sendGiveawayWinnerEmail(entry.email, entry.full_name, entry.prize_tier || '$5,000');
    } catch(e) { console.error('Winner email failed:', e); }

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: seed 250+ fake entries (manual trigger)
app.post('/api/admin/giveaway/seed-fakes', authMiddleware, adminOnly, async (req, res) => {
  try {
    await ensureDailyGiveawayState(true);
    const today = new Date().toISOString().split('T')[0];
    const { count: totalSlots } = await _sb
      .from('giveaway_entries')
      .select('id', { count: 'exact', head: true })
      .eq('draw_date', today);

    res.json({ success: true, totalSlots: totalSlots || 0, message: 'Giveaway entries and daily state refreshed successfully' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
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

          // Get user details for email
          const { rows: userRows } = await db.query('SELECT full_name, email FROM users WHERE id = $1', [account.user_id]);
          if (userRows.length > 0) {
            const u = userRows[0];
            // Send Violation Email (Await to prevent Vercel freeze)
            try {
              await emailService.sendViolationEmail(u.email, u.full_name, '$' + accSize.toLocaleString(), reason);
            } catch(e) { console.error('Violation email failed:', e); }
          }
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
        const tierInfo = getAffiliateTierInfo(totalRev);
        const commRate = tierInfo.commissionRate / 100;
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

// ════════════════════════════════════════════════════════════
// ── COUPON CODE SYSTEM ───────────────────────────────────────
// ════════════════════════════════════════════════════════════

// Public: validate a coupon code
app.post('/api/coupons/validate', async (req, res) => {
  const code = (req.body.code || '').toString().trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'No code provided' });

  try {
    const { data: coupon, error } = await _sb
      .from('coupon_codes')
      .select('id, code, discount_percent, description, max_uses, used_count, is_active, expires_at')
      .eq('code', code)
      .maybeSingle();

    if (error) throw error;
    if (!coupon) return res.status(404).json({ valid: false, error: 'Invalid coupon code' });
    if (!coupon.is_active) return res.status(410).json({ valid: false, error: 'This coupon has been deactivated' });
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date())
      return res.status(410).json({ valid: false, error: 'This coupon has expired' });
    if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses)
      return res.status(410).json({ valid: false, error: 'This coupon has reached its usage limit' });

    res.json({
      valid: true,
      code: coupon.code,
      discount_percent: coupon.discount_percent,
      description: coupon.description
    });
  } catch (e) {
    console.error('Coupon validate error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: list all coupons
app.get('/api/admin/coupons', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { data } = await _sb.from('coupon_codes').select('*').order('created_at', { ascending: false });
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

// Admin: toggle coupon active/inactive
app.post('/api/admin/coupons/toggle', authMiddleware, adminOnly, async (req, res) => {
  const { id, is_active } = req.body;
  try {
    await _sb.from('coupon_codes').update({ is_active }).eq('id', id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

// ════════════════════════════════════════════════════════════
// ── NOWPAYMENTS API ─────────────────────────────────────────
// ════════════════════════════════════════════════════════════

app.post('/api/payment/create-invoice', authMiddleware, async (req, res) => {
  const { plan_type, account_size, base_price, coupon_code, add_on } = req.body;
  const addOnCost = (add_on === 'daily_payout' && plan_type === 'instant') ? 18 : 0;
  const calculatedBase = Number(base_price) + addOnCost;
  let finalPrice = calculatedBase;
  
  try {
    // 1. Verify and apply coupon if provided
    if (coupon_code) {
      const { data: coupon } = await _sb
        .from('coupon_codes')
        .select('discount_percent, is_active, max_uses, used_count')
        .eq('code', coupon_code.toUpperCase())
        .maybeSingle();

      if (coupon && coupon.is_active && (coupon.max_uses === null || coupon.used_count < coupon.max_uses)) {
        const saving = Math.round(calculatedBase * coupon.discount_percent / 100);
        finalPrice = calculatedBase - saving;
      }
    }

    // 2. Call NOWPayments API via built-in https to avoid Node version issues
    const npApiKey = process.env.NOWPAYMENTS_API_KEY || '0F3CR9A-TDDM3EC-NQGR7W6-EMYSJ78';
    
    const https = require('https');
    const orderDesc = addOnCost > 0
      ? `${plan_type} - ${account_size} (+Daily Payout Add-on)`
      : `${plan_type} - ${account_size}`;

    const postData = JSON.stringify({
      price_amount: finalPrice,
      price_currency: 'usd',
      order_id: `ORD-${Date.now()}-${req.user.userId}`,
      order_description: orderDesc,
      success_url: 'https://fundings4u.com/checkout/success',
      cancel_url: 'https://fundings4u.com/checkout'
    });

    const options = {
      hostname: 'api.nowpayments.io',
      path: '/v1/invoice',
      method: 'POST',
      headers: {
        'x-api-key': npApiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const data = await new Promise((resolve, reject) => {
      const request = https.request(options, (response) => {
        let body = '';
        response.on('data', chunk => body += chunk);
        response.on('end', () => {
          try {
            resolve({ status: response.statusCode, data: JSON.parse(body) });
          } catch(e) {
            reject(e);
          }
        });
      });
      request.on('error', reject);
      request.write(postData);
      request.end();
    });

    if (data.status < 200 || data.status >= 300) {
      console.error('NOWPayments error:', data.data);
      return res.status(400).json({ error: data.data.message || 'Failed to create invoice' });
    }

    res.json({ invoice_url: data.data.invoice_url });
  } catch (error) {
    console.error('Payment API error:', error);
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
app.get('/giveaway', (req, res) => res.sendFile(path.join(__dirname, 'giveaway.html')));

app.get('/checkout', (req, res) => res.sendFile(path.join(__dirname, 'checkout.html')));
app.get('/checkout/success', (req, res) => res.sendFile(path.join(__dirname, 'checkout.html')));

// ── AFFILIATE ENDPOINTS ───────────────────────────────────────
async function fetchAllTableRows(table, selectCols, orderCol = 'created_at') {
  const all = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await _sb
      .from(table)
      .select(selectCols)
      .order(orderCol, { ascending: false })
      .range(from, from + step - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < step) break;
    from += step;
  }
  return all;
}

async function fetchUsersByIds(ids) {
  const map = {};
  const uniqueIds = [...new Set(ids.filter(id => id != null))];
  for (let i = 0; i < uniqueIds.length; i += 200) {
    const chunk = uniqueIds.slice(i, i + 200);
    const { data, error } = await _sb
      .from('users')
      .select('id, full_name, email, phone, role, created_at')
      .in('id', chunk);
    if (error) throw new Error(error.message);
    (data || []).forEach(u => { map[u.id] = u; });
  }
  return map;
}

app.get('/api/affiliate/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const affCode = formatAffCode(userId);
    const affLink = getAffiliateLink(userId);

    // 1. All referrals for this user
    const { data: refRows, error: refErr } = await _sb
      .from('referrals')
      .select('referred_id, created_at')
      .eq('referrer_id', userId)
      .order('created_at', { ascending: false });
    if (refErr) throw new Error(refErr.message);

    const referredIds = (refRows || []).map(r => r.referred_id);
    const totalReferrals = referredIds.length;

    // 2. All affiliate sales for this user
    const { data: salesRows, error: salesErr } = await _sb
      .from('affiliate_sales')
      .select('referred_id, amount_usd, commission_earned, created_at')
      .eq('referrer_id', userId);
    if (salesErr) throw new Error(salesErr.message);

    const totalRevenue = (salesRows || []).reduce((s, r) => s + parseFloat(r.amount_usd || 0), 0);
    const totalEarned = (salesRows || []).reduce((s, r) => s + parseFloat(r.commission_earned || 0), 0);

    // 3. Determine Tier
    const tierInfo = getAffiliateTierInfo(totalRevenue);

    // 4. Build referredTraders list & fundedCount
    let fundedCount = 0;
    let referredTraders = [];

    if (referredIds.length > 0) {
      const userMap = await fetchUsersByIds(referredIds);

      const { data: accounts } = await _sb
        .from('trading_accounts')
        .select('user_id, status, account_size')
        .in('user_id', referredIds);

      const activeUserSet = new Set();
      const anyAccountSet = new Set();
      (accounts || []).forEach(a => {
        anyAccountSet.add(a.user_id);
        if (a.status === 'active') activeUserSet.add(a.user_id);
      });
      fundedCount = activeUserSet.size;

      // Aggregate sales per referred user
      const salesByReferred = {};
      (salesRows || []).forEach(s => {
        if (!salesByReferred[s.referred_id]) salesByReferred[s.referred_id] = { purchased: 0, commission: 0 };
        salesByReferred[s.referred_id].purchased += parseFloat(s.amount_usd || 0);
        salesByReferred[s.referred_id].commission += parseFloat(s.commission_earned || 0);
      });

      referredTraders = (refRows || []).map(r => {
        const u = userMap[r.referred_id] || {};
        const s = salesByReferred[r.referred_id] || { purchased: 0, commission: 0 };
        let status = 'Registered';
        if (activeUserSet.has(r.referred_id)) status = 'Funded Active';
        else if (anyAccountSet.has(r.referred_id) || s.purchased > 0) status = 'Purchased';

        return {
          id: r.referred_id,
          full_name: u.full_name || `Trader #${r.referred_id}`,
          email: u.email || '—',
          joined_at: r.created_at || u.created_at,
          purchased_usd: s.purchased,
          commission_earned: s.commission,
          status
        };
      });
    }

    res.json({
      affCode,
      affLink,
      totalReferrals,
      totalRevenue,
      totalEarned,
      ...tierInfo,
      fundedCount,
      referredTraders
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: full Affiliation overview (per-person commission %, links, referrals)
app.get('/api/admin/affiliates', authMiddleware, adminOnly, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(200, parseInt(req.query.limit, 10) || 100));
    const search = (req.query.search || '').trim();
    const filter = req.query.filter || 'all'; // 'all' | 'active'

    const [allReferrals, allSales, tradersCountRes] = await Promise.all([
      fetchAllTableRows('referrals', 'id, referrer_id, referred_id, created_at'),
      fetchAllTableRows('affiliate_sales', 'id, referrer_id, referred_id, order_id, amount_usd, commission_earned, sale_type, created_at'),
      _sb.from('users').select('id', { count: 'exact', head: true }).neq('role', 'admin')
    ]);

    const totalTraders = tradersCountRes.count || 0;

    // Group referrals and sales by referrer_id
    const refByPartner = {};
    allReferrals.forEach(r => {
      if (!refByPartner[r.referrer_id]) refByPartner[r.referrer_id] = [];
      refByPartner[r.referrer_id].push(r);
    });

    const salesByPartner = {};
    const salesByPair = {};
    let totalRevenue = 0;
    let totalCommissions = 0;

    allSales.forEach(s => {
      const amt = parseFloat(s.amount_usd || 0);
      const comm = parseFloat(s.commission_earned || 0);
      totalRevenue += amt;
      totalCommissions += comm;

      if (!salesByPartner[s.referrer_id]) salesByPartner[s.referrer_id] = { revenue: 0, earned: 0 };
      salesByPartner[s.referrer_id].revenue += amt;
      salesByPartner[s.referrer_id].earned += comm;

      const pairKey = `${s.referrer_id}:${s.referred_id}`;
      if (!salesByPair[pairKey]) salesByPair[pairKey] = { revenue: 0, earned: 0 };
      salesByPair[pairKey].revenue += amt;
      salesByPair[pairKey].earned += comm;
    });

    // Active partner IDs sorted by commission + referral count descending
    const activePartnerIdSet = new Set([
      ...Object.keys(refByPartner).map(Number),
      ...Object.keys(salesByPartner).map(Number)
    ]);
    const activePartnerIds = [...activePartnerIdSet].sort((a, b) => {
      const revDiff = (salesByPartner[b]?.revenue || 0) - (salesByPartner[a]?.revenue || 0);
      if (revDiff !== 0) return revDiff;
      return (refByPartner[b]?.length || 0) - (refByPartner[a]?.length || 0);
    });

    // Fetch all users referenced in referrals & sales so we have complete attribution data
    const involvedIds = [
      ...activePartnerIds,
      ...allReferrals.map(r => r.referred_id)
    ];
    const involvedUsersMap = await fetchUsersByIds(involvedIds);

    const formatPersonRow = (u) => {
      const refs = refByPartner[u.id] || [];
      const sales = salesByPartner[u.id] || { revenue: 0, earned: 0 };
      const tierInfo = getAffiliateTierInfo(sales.revenue);
      const referredTraders = refs.map(r => {
        const ru = involvedUsersMap[r.referred_id] || {};
        const pairSales = salesByPair[`${u.id}:${r.referred_id}`] || { revenue: 0, earned: 0 };
        return {
          id: r.referred_id,
          full_name: ru.full_name || `Trader #${r.referred_id}`,
          email: ru.email || '—',
          joined_at: r.created_at || ru.created_at,
          purchased_usd: pairSales.revenue,
          commission_earned: pairSales.earned
        };
      });

      return {
        id: u.id,
        full_name: u.full_name || `Trader #${u.id}`,
        email: u.email || '—',
        created_at: u.created_at,
        affCode: formatAffCode(u.id),
        affLink: getAffiliateLink(u.id),
        ...tierInfo,
        totalReferrals: refs.length,
        totalRevenue: sales.revenue,
        totalEarned: sales.earned,
        referredTraders
      };
    };

    let partners = [];
    let totalItems = 0;

    if (search) {
      const safeQ = search.replace(/[,()]/g, ' ').trim();
      const parsedCodeId = parseInt(safeQ.replace(/^F4U/i, ''), 10);
      let queryBuilder = _sb
        .from('users')
        .select('id, full_name, email, role, created_at', { count: 'exact' })
        .neq('role', 'admin');

      if (!isNaN(parsedCodeId) && String(parsedCodeId) === safeQ.replace(/^F4U0*/i, '') && safeQ.length > 0) {
        queryBuilder = queryBuilder.or(`id.eq.${parsedCodeId},full_name.ilike.%${safeQ}%,email.ilike.%${safeQ}%`);
      } else {
        queryBuilder = queryBuilder.or(`full_name.ilike.%${safeQ}%,email.ilike.%${safeQ}%`);
      }

      const from = (page - 1) * limit;
      const { data: matchedUsers, count: matchCount, error: matchErr } = await queryBuilder
        .order('created_at', { ascending: false })
        .range(from, from + limit - 1);
      if (matchErr) throw new Error(matchErr.message);

      let mapped = (matchedUsers || []).map(formatPersonRow);
      if (filter === 'active') {
        mapped = mapped.filter(p => p.totalReferrals > 0 || p.totalRevenue > 0);
        totalItems = mapped.length;
      } else {
        totalItems = matchCount || mapped.length;
      }
      partners = mapped;
    } else if (filter === 'active') {
      totalItems = activePartnerIds.length;
      const from = (page - 1) * limit;
      const pageIds = activePartnerIds.slice(from, from + limit);
      partners = pageIds.map(id => involvedUsersMap[id]).filter(Boolean).map(formatPersonRow);
    } else {
      // 'all' with active partners prioritized at the top
      totalItems = totalTraders;
      const offset = (page - 1) * limit;
      const activeCount = activePartnerIds.filter(id => involvedUsersMap[id] && involvedUsersMap[id].role !== 'admin').length;

      if (offset < activeCount) {
        const activeSliceIds = activePartnerIds
          .filter(id => involvedUsersMap[id] && involvedUsersMap[id].role !== 'admin')
          .slice(offset, offset + limit);
        const activeRows = activeSliceIds.map(id => formatPersonRow(involvedUsersMap[id]));
        const remaining = limit - activeRows.length;

        let fillerRows = [];
        if (remaining > 0) {
          let q = _sb.from('users').select('id, full_name, email, role, created_at').neq('role', 'admin').order('created_at', { ascending: false }).range(0, remaining + activePartnerIds.length);
          const { data: extraUsers } = await q;
          fillerRows = (extraUsers || [])
            .filter(u => !activePartnerIdSet.has(u.id))
            .slice(0, remaining)
            .map(formatPersonRow);
        }
        partners = [...activeRows, ...fillerRows];
      } else {
        const nonActiveOffset = offset - activeCount;
        const { data: pageUsers } = await _sb
          .from('users')
          .select('id, full_name, email, role, created_at')
          .neq('role', 'admin')
          .order('created_at', { ascending: false })
          .range(nonActiveOffset, nonActiveOffset + limit + activePartnerIds.length);
        partners = (pageUsers || [])
          .filter(u => !activePartnerIdSet.has(u.id))
          .slice(0, limit)
          .map(formatPersonRow);
      }
    }

    // Build recent referred trader registrations log
    const recentReferrals = allReferrals.slice(0, 100).map(r => {
      const refUser = involvedUsersMap[r.referred_id] || {};
      const partnerUser = involvedUsersMap[r.referrer_id] || {};
      const partnerSales = salesByPartner[r.referrer_id] || { revenue: 0, earned: 0 };
      const partnerTier = getAffiliateTierInfo(partnerSales.revenue);
      const pairSales = salesByPair[`${r.referrer_id}:${r.referred_id}`] || { revenue: 0, earned: 0 };

      return {
        referred_id: r.referred_id,
        full_name: refUser.full_name || `Trader #${r.referred_id}`,
        email: refUser.email || '—',
        joined_at: r.created_at || refUser.created_at,
        referrer_id: r.referrer_id,
        referrer_name: partnerUser.full_name || `Trader #${r.referrer_id}`,
        referrer_email: partnerUser.email || '—',
        referrer_code: formatAffCode(r.referrer_id),
        commissionRate: partnerTier.commissionRate,
        tier: partnerTier.tier,
        purchased_usd: pairSales.revenue,
        commission_earned: pairSales.earned
      };
    });

    res.json({
      summary: {
        totalTraders,
        activePartnersCount: activePartnerIds.length,
        totalReferrals: allReferrals.length,
        totalRevenue,
        totalCommissions
      },
      partners,
      recentReferrals,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / limit))
      }
    });
  } catch (err) {
    console.error('Admin affiliates error:', err);
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
