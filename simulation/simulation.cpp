#include <WiFi.h>
#include <PubSubClient.h>

// --- Configuration ---
const char* ssid = "Wokwi-GUEST";
const char* password = "";
const char* mqtt_server = "broker.hivemq.com"; 

// --- Pin Map (Matching your final circuit) ---
const int PULSE_PIN = 34;    // Green: Potentiometer
const int PRESSURE_PIN = 13; // Black: Slide Switch
const int BUZZER_PIN = 18;   // Green: Buzzer
const int RELAY_VIB_PIN = 19; // Green: Relay (Vibrator)

WiFiClient espClient;
PubSubClient client(espClient);

void setup() {
  Serial.begin(115200);
  
  // Set Pin Modes
  pinMode(PRESSURE_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(RELAY_VIB_PIN, OUTPUT);
  
  setup_wifi();
  client.setServer(mqtt_server, 1883);
}

void setup_wifi() {
  delay(10);
  Serial.println("\nConnecting to WiFi...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected!");
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    // Use a unique ID for your project
    if (client.connect("Chirag_Smart_Pillow_Project")) {
      Serial.println("connected");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      delay(5000);
    }
  }
}

void loop() {
  if (!client.connected()) reconnect();
  client.loop();

  // 1. Check for pressure (head on pillow)
  int headDetected = (digitalRead(PRESSURE_PIN) == LOW); 
  int bpm = 0;

  if (headDetected) {
    // 2. Read pulse if head is detected
    int raw = analogRead(PULSE_PIN);
    bpm = map(raw, 0, 4095, 60, 120); 
  } else {
    bpm = 0; // No head = No heartbeat
  }

  // 3. Alarm Logic (Buzzer & Vibration)
  if (bpm > 110 || (bpm > 0 && bpm < 65)) {
    tone(BUZZER_PIN, 1000); 
    digitalWrite(RELAY_VIB_PIN, HIGH);
    Serial.println("!!! CRITICAL CONDITION !!!");
  } else {
    noTone(BUZZER_PIN);
    digitalWrite(RELAY_VIB_PIN, LOW);
  }

  // 4. Send Data to MQTT
  String payload = String(bpm);
  // Topic name: Use this in your MQTT viewer or App
  client.publish("chirag/smart_pillow/pulse", payload.c_str());

  // Debugging output
  Serial.print("Head on Pillow: ");
  Serial.print(headDetected ? "YES" : "NO ");
  Serial.print(" | Heart Rate: ");
  Serial.print(bpm);
  Serial.println(" BPM");
  
  delay(1000); // Update every second
}
