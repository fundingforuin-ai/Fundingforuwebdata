const pool = require('./db');

async function alterDb() {
  try {
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT UNIQUE');
    console.log("Column phone added.");
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
alterDb();
