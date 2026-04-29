const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Postgres Connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'mydb',
  password: 'ashwil123',
  port: 5432,
});

// Initialize Database Table
const initDb = async () => {
  try {
    // Create table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vitals (
        time        TIMESTAMPTZ       NOT NULL,
        device_id   TEXT              NOT NULL,
        bpm         INTEGER           NOT NULL,
        status      TEXT              NOT NULL
      );
    `);

    // Convert to Hypertable (TimescaleDB specific)
    // We wrap this in a try-catch because it might already be a hypertable
    try {
      await pool.query("SELECT create_hypertable('vitals', 'time', if_not_exists => TRUE);");
      console.log('TimescaleDB Hypertable ready');
    } catch (e) {
      console.log('Hypertable already exists or error:', e.message);
    }
  } catch (err) {
    console.error('Error initializing DB:', err);
  }
};

initDb();

// API Endpoint to save vitals
app.post('/api/vitals', async (req, res) => {
  const { device_id, bpm, status } = req.body;
  const time = new Date();

  try {
    const query = 'INSERT INTO vitals (time, device_id, bpm, status) VALUES ($1, $2, $3, $4) RETURNING *';
    const values = [time, device_id || 'Vibillow-01', bpm, status || 'Healthy'];
    
    const result = await pool.query(query, values);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// API Endpoint to fetch history
app.get('/api/vitals/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const result = await pool.query(
      'SELECT * FROM vitals WHERE device_id = $1 ORDER BY time DESC LIMIT 20',
      [deviceId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Vibillow Backend running at http://localhost:${port}`);
});
