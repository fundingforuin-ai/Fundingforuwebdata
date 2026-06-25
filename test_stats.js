const db = require('./db');

async function test() {
  try {
    // Just grab the first user
    const { rows } = await db.query('SELECT id FROM users LIMIT 1');
    if (rows.length === 0) return console.log('No users');
    const userId = rows[0].id;
    console.log('Testing for user', userId);

    console.log('1. Referrals count');
    const { rows: refCountRows } = await db.query('SELECT COUNT(*) as count FROM referrals WHERE referrer_id=$1', [userId]);
    console.log('Count:', refCountRows[0].count);

    console.log('2. Revenue');
    const { rows: salesRows } = await db.query('SELECT SUM(amount_usd) as revenue, SUM(commission_earned) as earned FROM affiliate_sales WHERE referrer_id=$1', [userId]);
    console.log('Sales:', salesRows[0]);

    console.log('3. Funded count');
    const { rows: referredRows } = await db.query('SELECT referred_id FROM referrals WHERE referrer_id=$1', [userId]);
    const referredIds = referredRows.map(r => r.referred_id);
    console.log('Referred IDs:', referredIds);

    if (referredIds.length > 0) {
       const { rows: fundedRows } = await db.query('SELECT COUNT(DISTINCT user_id) as count FROM trading_accounts WHERE user_id = ANY($1) AND status = $2', [referredIds, 'active']);
       console.log('Funded:', fundedRows[0].count);
    }
    
    console.log('Success!');
    process.exit(0);
  } catch(e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  }
}
test();
