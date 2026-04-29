const express = require('express');
const mqtt = require('mqtt');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// --- DATABASE SETUP ---
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'mydb',
    password: 'ashwil123',
    port: 5432,
});

app.use(cors());
app.use(express.json());

// Use the HiveMQ WebSocket endpoint for browser-compatible MQTT connections
const mqttClient = mqtt.connect('wss://broker.hivemq.com:8884/mqtt', {
    clientId: `pillow-dashboard-${Date.now()}`,
    clean: true,
    reconnectPeriod: 2000,
    connectTimeout: 5000,
});

const topics = ['pillow/bpm', 'pillow/head'];

mqttClient.on('connect', () => {
    console.log('Connected to HiveMQ over WebSocket');
    topics.forEach((topic) => {
        mqttClient.subscribe(topic, { qos: 0 }, (err) => {
            if (err) {
                console.error(`Failed to subscribe to ${topic}:`, err.message);
            } else {
                console.log(`Subscribed to ${topic}`);
            }
        });
    });
});

mqttClient.on('message', async (topic, message) => {
    const payload = message.toString();
    console.log(`MQTT ${topic}: ${payload}`);
    
    // Emit to socket for real-time dashboard
    io.emit('mqttUpdate', { topic, payload });

    // Store in Database if it's BPM
    if (topic === 'pillow/bpm') {
        const bpm = parseInt(payload);
        if (!isNaN(bpm)) {
            try {
                await pool.query(
                    'INSERT INTO vitals (time, device_id, bpm, status) VALUES (NOW(), $1, $2, $3)',
                    ['Vibillow-MQTT', bpm, bpm < 40 || bpm > 130 ? 'Emergency' : 'Healthy']
                );
                console.log(`[DB] Stored BPM: ${bpm}`);
            } catch (err) {
                console.error('[DB] Error storing BPM:', err.message);
            }
        }
    }
});

app.get('/api/vitals/latest', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM vitals ORDER BY time DESC LIMIT 1');
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ error: 'No data found' });
        }
    } catch (err) {
        console.error('API Error:', err.message);
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

server.listen(PORT, () => console.log(`Web Dashboard at http://localhost:${PORT}`));

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Use a different port or stop the process using it.`);
        process.exit(1);
    }
    throw error;
});

