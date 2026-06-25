const bcrypt = require('bcryptjs');
const db = require('./db');

async function seedLeaderboard() {
  const fakeAffiliates = [
    { name: 'Alex Thompson', email: 'alex@example.com', rev: 145200 },
    { name: 'Sarah Jenkins', email: 'sarah@example.com', rev: 89450 },
    { name: 'Michael Chen', email: 'mike@example.com', rev: 67200 },
    { name: 'David Rossi', email: 'david@example.com', rev: 45900 },
    { name: 'Emma Wilson', email: 'emma@example.com', rev: 32100 },
    { name: 'James Carter', email: 'james@example.com', rev: 28500 },
    { name: 'Olivia Martinez', email: 'olivia@example.com', rev: 15400 },
    { name: 'Liam Brooks', email: 'liam@example.com', rev: 9200 }
  ];

  const hash = bcrypt.hashSync('password123', 10);

  try {
    for (let i = 0; i < fakeAffiliates.length; i++) {
      const aff = fakeAffiliates[i];
      
      // Check if user exists
      let { rows } = await db.query('SELECT id FROM users WHERE email = $1', [aff.email]);
      let userId;
      
      if (rows.length === 0) {
        // Insert user
        const res = await db.query(
          'INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
          [aff.name, aff.email, hash, 'trader']
        );
        userId = res.rows[0].id;
      } else {
        userId = rows[0].id;
      }

      // Insert fake sale to bump revenue
      await db.query(
        'INSERT INTO affiliate_sales (referrer_id, referred_id, amount_usd, commission_earned) VALUES ($1, $2, $3, $4)',
        [userId, userId, aff.rev, aff.rev * 0.20] // referred_id = themselves just for dummy data
      );
    }
    
    console.log('✅ Successfully seeded leaderboard with fake affiliates!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
}

seedLeaderboard();
