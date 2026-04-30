const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const port = 3000;

// --- TELEGRAM CONFIGURATION ---
const TELEGRAM_TOKEN = '8055258536:AAHVJDXYXhHJLANaSTYFwO4mvdl-rHpKYgU'; 
const MY_CHAT_ID = '7683684333';      

const t_bot = new TelegramBot(TELEGRAM_TOKEN, {polling: true});

// --- STATE ---
let telegramAlertInterval = null;

// --- SHARED STOP LOGIC ---
const stopAllAlerts = () => {
  if (telegramAlertInterval) {
    clearInterval(telegramAlertInterval);
    telegramAlertInterval = null;
    console.log('🛑 Emergency silenced.');
  }
};

// --- TELEGRAM COMMANDS ---
// Listen for /stop command from your phone
t_bot.onText(/\/stop/, (msg) => {
  stopAllAlerts();
  t_bot.sendMessage(MY_CHAT_ID, '✅ Alarm silenced. System reset.');
});

// --- EMERGENCY LOGIC ---
const triggerTelegramAlert = (bpm) => {
  if (telegramAlertInterval) return; // Prevent overlapping ringtones

  const sendAlert = () => {
    t_bot.sendMessage(MY_CHAT_ID, `📞 **INCOMING EMERGENCY CALL**\n💓 Heart Rate: ${bpm} BPM\n\n⚠️ Type /stop to silence.`, {
      parse_mode: 'Markdown',
    }).catch(err => console.error('Telegram Error:', err.message));
  };

  console.log('📱 Starting 30-second Ringtone Loop...');
  sendAlert(); 
  
  // Set to 30 seconds (30000ms) to match your custom ringtone length
  telegramAlertInterval = setInterval(sendAlert, 30000); 
};

// --- DATABASE SETUP ---
const pool = new Pool({
  user: 'postgres', host: 'localhost', database: 'mydb', password: 'ashwil123', port: 5432,
});

const initDb = async () => {
  try {
    await pool.query('CREATE TABLE IF NOT EXISTS vitals (time TIMESTAMPTZ NOT NULL, device_id TEXT NOT NULL, bpm INTEGER NOT NULL, status TEXT NOT NULL);');
    console.log('✓ Database Ready');
  } catch (err) { console.error('DB Error:', err); }
};
initDb();

// --- API ENDPOINTS ---
app.use(cors());
app.use(bodyParser.json());

app.post('/api/vitals', async (req, res) => {
  const { device_id, bpm, status } = req.body;
  const validBpm = parseInt(bpm);
  
  if (isNaN(validBpm)) return res.status(400).send('Invalid BPM');

  try {
    // Save to Database
    await pool.query('INSERT INTO vitals (time, device_id, bpm, status) VALUES (NOW(), $1, $2, $3)', 
      [device_id || 'Vibillow-01', validBpm, status || 'Healthy']);

    // EMERGENCY CHECK: Trigger if BPM < 40
    if (validBpm < 40) {
      console.log(`⚠️ EMERGENCY: ${validBpm} BPM! Triggering Telegram "Call"...`);
      triggerTelegramAlert(validBpm);
    } else if (validBpm >= 60 && telegramAlertInterval) {
      // Auto-stop if heart rate recovers significantly
      stopAllAlerts();
      t_bot.sendMessage(MY_CHAT_ID, '✅ BPM normalized. Alarm stopped.');
    }

    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

app.listen(port, () => {
  console.log(`🚀 Vibillow Engine Online on Port ${port}`);
});
