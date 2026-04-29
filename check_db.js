const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'mydb',
  password: 'ashwil123',
  port: 5432,
});

async function checkData() {
  try {
    const res = await pool.query('SELECT * FROM vitals ORDER BY time DESC LIMIT 10');
    console.log('--- LATEST 10 ENTRIES IN TIMESCALEDB ---');
    console.table(res.rows);
    await pool.end();
  } catch (err) {
    console.error('Error querying database:', err.message);
    process.exit(1);
  }
}

checkData();
