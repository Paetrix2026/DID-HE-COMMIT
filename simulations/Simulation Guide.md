# Smart Health Pillow IoT Simulation (Wokwi)

### 📝 Project Overview
This repository contains the hardware simulation for an **IoT-Integrated Smart Health Pillow**. The system is designed to monitor a user's pulse rate during sleep and trigger multi-sensory alerts (audible and haptic) if abnormal heart rates are detected. 

The project bridges the gap between hardware and software by using the **MQTT protocol** to broadcast live sensor data from a virtual ESP32 to a cloud-based dashboard.

---

### 🚀 Simulation Features
* **Presence Awareness:** Integrated a slide switch to simulate a pressure mat; monitoring only activates when the user is "detected" on the pillow.
* **Real-time BPM Simulation:** A potentiometer mimics pulse rate variability ($60$–$120$ BPM).
* **Safety Critical Alarms:**
    * **Buzzer:** Audible alarm for Tachycardia ($>110$ BPM) or Bradycardia ($<65$ BPM).
    * **Relay (Vibration):** Haptic feedback simulation to wake/alert the user during medical emergencies.
* **Cloud Connectivity:** Real-time data publishing via **MQTT** for remote caregiver monitoring.

---

### 🛠️ Hardware Setup (Wokwi)
| Component | ESP32 Pin (GPIO) | Purpose |
| :--- | :--- | :--- |
| **Potentiometer** | `34` (Analog) | Pulse Signal Simulation |
| **Slide Switch** | `13` (Digital) | Pressure/Presence Input |
| **Buzzer** | `18` (Digital) | Audible Alarm Output |
| **Relay Module** | `19` (Digital) | Vibration Motor Control |



---

### 📂 How to Run the Simulation
1.  Here's the project [Did-he commit](https://wokwi.com/projects/462627090903541761)
2.  Open [Wokwi](https://wokwi.com) and create a new **ESP32** project.
3.  **Circuit Connection:** Follow the pin mapping table above or reference the provided circuit image.
4.  **Install Libraries:**
    * Open the **Library Manager** (cube icon) in Wokwi.
    * Search and install: `PubSubClient` by Nick O'Leary.
5.  **Run:** Click the **Play** button.
6.  **Verify Data:**
    * Flip the **Slide Switch** (Head on pillow).
    * Turn the **White Dial** (Adjust pulse).
    * Monitor the **Serial Monitor** to see connection status and live BPM.

---

### 📡 Testing the IoT Integration
To view the data "leaving" the simulation and entering the cloud:
1.  Open the [HiveMQ Web Client](http://www.hivemq.com/demos/websocket-client/).
2.  Click **Connect**.
3.  Click **Add New Topic Subscription**.
4.  Enter the topic: `chirag/smart_pillow/pulse` (or the custom topic from your code).
5.  Watch the live data stream update every second!

---

### 💡 Implementation Logic
The system follows a specific priority logic:
1.  **Check Pressure:** If `GPIO 13` is `HIGH` (Vacant), all outputs are forced to `0`.
2.  **Read Pulse:** If `GPIO 13` is `LOW` (Occupied), the system samples `GPIO 34`.
3.  **Evaluate:** If the mapped BPM falls outside the $65-110$ range, the system triggers `HIGH` on `GPIO 18` and `19`.
4.  **Transmit:** Data is formatted as a string and published to the MQTT broker.

---

