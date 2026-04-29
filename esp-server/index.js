const mqtt = require('mqtt');
const { Pool } = require('pg');

// 1. Postgres Configuration
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'mydb',
  password: 'ashwil123',
  port: 5432,
});

// 2. MQTT Configuration
const mqttClient = mqtt.connect('mqtt://broker.hivemq.com');
const topic = 'vibillow/hardware/bpm';

mqttClient.on('connect', () => {
  console.log('--- Hardware Bridge Connected ---');
  console.log('Connected to MQTT Broker (HiveMQ)');
  mqttClient.subscribe(topic, (err) => {
    if (!err) {
      console.log(`Subscribed to topic: ${topic}`);
      console.log('Waiting for data from Wokwi...');
    }
  });
});

mqttClient.on('message', async (topic, message) => {
  const bpm = parseInt(message.toString());
  const device_id = 'ESP32-WOKWI-SIM';
  const status = (bpm < 40 || bpm > 130) ? 'Emergency' : 'Healthy';
  const time = new Date();

  console.log(`[${time.toLocaleTimeString()}] Received BPM: ${bpm} from ${device_id}`);

  try {
    const query = 'INSERT INTO vitals (time, device_id, bpm, status) VALUES ($1, $2, $3, $4)';
    const values = [time, device_id, bpm, status];
    await pool.query(query, values);
    console.log('Successfully saved to PostgreSQL');
  } catch (err) {
    console.error('Database Error:', err.message);
  }
});

// Error handling
mqttClient.on('error', (err) => {
  console.error('MQTT Error:', err.message);
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres Error:', err.message);
});
