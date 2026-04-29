const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');
const mqtt = require('mqtt');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.')); // Serve static files from root directory

// MQTT Configuration for HiveMQ Integration
const mqttClient = mqtt.connect('mqtt://broker.hivemq.com');
const mqttTopic = 'vibillow/hardware/bpm';

// MQTT Connection Handlers
mqttClient.on('connect', () => {
  console.log('✓ Connected to HiveMQ Broker');
});

mqttClient.on('error', (err) => {
  console.error('✗ MQTT Error:', err.message);
});

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
    // Validate BPM value
    const validBpm = parseInt(bpm);
    if (isNaN(validBpm)) {
      return res.status(400).json({ success: false, error: 'Invalid BPM value' });
    }

    // Save to database
    const query = 'INSERT INTO vitals (time, device_id, bpm, status) VALUES ($1, $2, $3, $4) RETURNING *';
    const values = [time, device_id || 'Vibillow-01', validBpm, status || 'Healthy'];
    
    const result = await pool.query(query, values);

    // Publish to HiveMQ
    if (mqttClient.connected) {
      mqttClient.publish(mqttTopic, String(validBpm), { qos: 1 }, (err) => {
        if (err) {
          console.error('Failed to publish to MQTT:', err.message);
        } else {
          console.log(`[${time.toLocaleTimeString()}] Published BPM: ${validBpm} to MQTT`);
        }
      });
    } else {
      console.warn('MQTT client not connected, skipping publish');
    }

    res.status(201).json({ 
      success: true, 
      data: result.rows[0],
      mqtt_published: mqttClient.connected 
    });
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    mqtt_connected: mqttClient.connected,
    mqtt_broker: 'broker.hivemq.com',
    mqtt_topic: mqttTopic
  });
});

app.listen(port, () => {
  console.log(`Vibillow Backend running at http://localhost:${port}`);
  console.log(`MQTT Broker: broker.hivemq.com`);
  console.log(`MQTT Topic: ${mqttTopic}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  mqttClient.end();
  pool.end();
  process.exit(0);
});
