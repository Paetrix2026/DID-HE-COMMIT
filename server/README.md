# HiveMQ Live Data Webserver

A simple webserver that connects to HiveMQ MQTT broker and displays live data in real-time using Socket.IO.

## Features
✨ Real-time data streaming from HiveMQ using MQTT
- 🎨 Beautiful, responsive HTML interface
- 🔄 Live updates via Socket.IO
- 📊 Message history display
- 📤 Ability to publish messages to topics

## Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

```bash
cd server
npm install
```

### Running the Server

```bash
npm start
```

The server will start and listen on `http://localhost:3000`

### Troubleshooting MQTT Connection

If you're getting connection errors to HiveMQ, try these alternatives:

#### Option 1: Using Public MQTT Test Broker (Mosquitto)
Edit `server.js` and change the connection settings:

```javascript
const HIVEMQ_BROKER = 'test.mosquitto.org'; // Public Mosquitto broker
const MQTT_WS_PORT = 8081; // WebSocket port for Mosquitto
const MQTT_PROTOCOL = 'ws'; // WebSocket protocol
```

#### Option 2: Using Local HiveMQ via Docker
If you have Docker installed, you can run HiveMQ locally:

```bash
docker run -d --name hivemq -p 1883:1883 -p 8080:8080 -p 8000:8000 hivemq/hivemq4
```

Then update `server.js`:

```javascript
const HIVEMQ_BROKER = 'localhost'; // Local HiveMQ
const MQTT_WS_PORT = 8000; // Local WebSocket port
```

#### Option 3: Using Mosquitto
Install and run Mosquitto locally:

```bash
# Windows with Docker
docker run -it -p 1883:1883 -p 9001:9001 eclipse-mosquitto

# Or using Mosquitto directly
# Download from https://mosquitto.org/download/
```

Then update topics and connection settings in `server.js`.

## Configuration

### Modify Topics to Subscribe

Edit `server.js` and change the `MQTT_TOPICS` array:

```javascript
const MQTT_TOPICS = [
  'your/topic/1',
  'your/topic/2',
  'sensor/temperature',
  'sensor/humidity'
];
```

### Change Server Port

Edit `server.js`:

```javascript
const PORT = process.env.PORT || 3000; // Change to your desired port
```

Or set environment variable:

```bash
PORT=5000 npm start
```

## Publishing Messages

From the web interface:
1. Enter the MQTT topic in the Topic field
2. Enter your message in the Message field
3. Click "Publish"

Alternatively, use an MQTT client:

```bash
mosquitto_pub -h localhost -t "testtopic/1" -m "Hello from MQTT!"
```

## Development

For development with auto-reload:

```bash
npm run dev
```

This requires `nodemon` to be installed (already in devDependencies).

## Project Structure

```
server/
├── server.js           # Main Express + Socket.IO server
├── package.json        # Node dependencies
├── public/
│   └── index.html      # Web interface
└── README.md           # This file
```

## API Events

### Client → Server
- `publish` - Publish a message to an MQTT topic
  ```javascript
  socket.emit('publish', { topic: 'test/topic', message: 'Hello' });
  ```

### Server → Client
- `mqtt-message` - Receive MQTT message
  ```javascript
  socket.on('mqtt-message', (data) => {
    // data = { topic, payload, timestamp }
  });
  ```
- `error` - Connection or publish error
- `published` - Confirmation of published message

## Testing

Open your browser and navigate to `http://localhost:3000`. You should see:
- ✅ Connection status indicator
- 📨 Live message feed
- 📤 Message publish controls

## Tips

### Testing with Pre-populated Data
You can modify the HTML to include dummy data for testing before connecting to a real broker:

```javascript
const dummyMessages = [
  { topic: 'test/1', payload: 'Sample data 1', timestamp: new Date().toLocaleTimeString() },
  { topic: 'test/2', payload: 'Sample data 2', timestamp: new Date().toLocaleTimeString() }
];
messages.push(...dummyMessages);
```

### Performance
- The server stores last 100 messages in memory
- Adjust this limit in `server.js` line with `messages.pop()`
- For production, use a database to store historical data

## License

MIT

## Support

For issues or questions:
1. Check the browser console (F12) for client-side errors
2. Check terminal output for server-side errors
3. Verify MQTT broker is accessible and running
4. Check firewall settings for the MQTT ports
