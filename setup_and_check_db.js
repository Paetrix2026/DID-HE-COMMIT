const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'mydb',
  password: 'ashwil123',
  port: 5432,
});

async function setupAndCheck() {
  try {
    console.log('Connecting to database...');
    
    // Create table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vitals (
        time        TIMESTAMPTZ       NOT NULL,
        device_id   TEXT              NOT NULL,
        bpm         INTEGER           NOT NULL,
        status      TEXT              NOT NULL
      );
    `);
    console.log('Table "vitals" checked/created.');

    // Convert to Hypertable
    try {
      await pool.query("SELECT create_hypertable('vitals', 'time', if_not_exists => TRUE);");
      console.log('Hypertable created/verified.');
    } catch (e) {
      console.log('Note:', e.message);
    }

    // Insert mock data if empty
    const countRes = await pool.query('SELECT count(*) FROM vitals');
    if (parseInt(countRes.rows[0].count) === 0) {
      console.log('Inserting initial test data...');
      await pool.query(`
        INSERT INTO vitals (time, device_id, bpm, status) 
        VALUES 
          (NOW(), 'Vibillow-ESP32-01', 72, 'Healthy'),
          (NOW() - INTERVAL '1 minute', 'Vibillow-ESP32-01', 68, 'Healthy'),
          (NOW() - INTERVAL '2 minutes', 'Vibillow-ESP32-01', 145, 'Emergency')
      `);
    }

    // Fetch latest
    const res = await pool.query('SELECT * FROM vitals ORDER BY time DESC LIMIT 10');
    console.log('\n--- LATEST DATA IN TIMESCALEDB ---');
    console.table(res.rows);
    
    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

setupAndCheck();
