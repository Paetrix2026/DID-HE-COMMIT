import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { Audio } from 'expo-av';

const { width } = Dimensions.get('window');

// --- THEME ---
const COLORS = {
  background: '#121212',
  card: '#1E1E1E',
  text: '#FFFFFF',
  textSecondary: '#A0A0A0',
  primary: '#00D1FF', // Medical Cyan
  accent: '#FF3B30',  // Pulse Red
  success: '#34C759', // Online Green
  warning: '#FFCC00',
};

export default function DashboardScreen() {
  // --- STATE ---
  const [bpm, setBpm] = useState(72);
  const [status, setStatus] = useState('Online');
  const [hapticIntensity, setHapticIntensity] = useState(0.5);
  const [volume, setVolume] = useState(0.7);
  const [isAlertOn, setIsAlertOn] = useState(false);
  const [bluetoothDevice, setBluetoothDevice] = useState<string | null>(null);
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [emergencyBpm, setEmergencyBpm] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [bpmHistory, setBpmHistory] = useState([65, 68, 72, 70, 75, 72, 74]);
  
  // --- ANIMATION ---
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Pulse animation logic
    const pulse = () => {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start(() => pulse());
    };
    pulse();
  }, []);

  // --- MQTT BOILERPLATE (Commented out for mock) ---
  useEffect(() => {
    /* 
    import mqtt from 'mqtt';
    const client = mqtt.connect('mqtt://broker.hivemq.com:1883');
    
    client.on('connect', () => {
      console.log('Connected to MQTT');
      client.subscribe('vibillow/bpm');
    });

    client.on('message', (topic, message) => {
      if (topic === 'vibillow/bpm') {
        const value = parseInt(message.toString());
        setBpm(value);
        setBpmHistory(prev => [...prev.slice(1), value]);
      }
    });

    return () => client.end();
    */
    
    // Mocking a specific sequence for testing: 60 -> 70 -> 35 (Emergency)
    let step = 0;
    const testSequence = [60, 70, 75, 80 , 81, 82, 35, 72, 68]; // 35 will trigger the call and alarm
    
    const interval = setInterval(() => {
      setBpm(prev => {
        const value = testSequence[step % testSequence.length];
        step++;
        
        setBpmHistory(h => [...h.slice(1), value]);
        
        // --- SAVE TO TIMESCALEDB ---
        sendVitalsToDb(value);

        return value;
      });
    }, 3000); 

    return () => clearInterval(interval);
  }, []);

  // --- EMERGENCY TRIGGER ---
  useEffect(() => {
    if ((bpm < 40 || bpm > 130) && !emergencyActive) {
      setEmergencyActive(true);
      setEmergencyBpm(bpm);
      setCountdown(3);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [bpm]);

  // --- COUNTDOWN LOGIC ---
  useEffect(() => {
    let timer: any;
    if (emergencyActive && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (emergencyActive && countdown === 0) {
      if (countdown === 0) {
        console.log("Countdown finished! Playing alarm...");
        playSound();
      }
    }
    return () => clearTimeout(timer);
  }, [emergencyActive, countdown]);

  const playSound = async () => {
    try {
      console.log("Loading sound...");
      const { sound: newSound } = await Audio.Sound.createAsync(
        require('@/assets/sounds/android_ring.mp3'),
        { shouldPlay: true, volume: 1.0 }
      );
      setSound(newSound);
      console.log("Sound playing!");
    } catch (error) {
      console.error("Audio Error:", error);
    }
  };

  const stopAlert = async () => {
    if (sound) {
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
        setSound(null);
      } catch (error) {
        console.error("Error stopping sound:", error);
      }
    }
    setEmergencyActive(false);
    setEmergencyBpm(null);
    setCountdown(3); // Reset countdown for next time
  };

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  // --- HAPTIC HANDLERS ---
  const triggerHaptic = (type: string) => {
    switch (type) {
      case 'Calm':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'Alert':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'Pulse':
        Haptics.selectionAsync();
        break;
      default:
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  // --- DATABASE SYNC ---
  const sendVitalsToDb = async (currentBpm: number) => {
    try {
      // Updated to your local IP so physical devices can connect
      const response = await fetch('http://172.25.3.103:3000/api/vitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: 'Vibillow-ESP32-01',
          bpm: currentBpm,
          status: currentBpm < 40 || currentBpm > 130 ? 'Emergency' : 'Healthy',
        }),
      });
      const data = await response.json();
      console.log('Saved to TimescaleDB:', data.success);
    } catch (err: any) {
      console.warn('DB Sync Error (Is server.js running?):', err.message);
    }
  };

  // --- BLUETOOTH HANDLER ---
  const handleBluetoothConnect = () => {
    if (bluetoothDevice) {
      setBluetoothDevice(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      // Mock scanning/connecting process
      setStatus('Connecting Bluetooth...');
      setTimeout(() => {
        setBluetoothDevice('Vibillow-Speaker-X1');
        setStatus('Online');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 1500);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Vibillow IoT</Text>
            <Text style={styles.subtitle}>Health Monitoring System</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status === 'Online' ? COLORS.success + '20' : COLORS.accent + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: status === 'Online' ? COLORS.success : COLORS.accent }]} />
            <Text style={[styles.statusText, { color: status === 'Online' ? COLORS.success : COLORS.accent }]}>
              {status}
            </Text>
          </View>
        </View>

        {/* BPM SECTION */}
        <View style={styles.card}>
          <View style={styles.bpmHeader}>
            <Text style={styles.cardTitle}>Current Heart Rate</Text>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <MaterialCommunityIcons name="heart" size={24} color={COLORS.accent} />
            </Animated.View>
          </View>
          <View style={styles.bpmValueContainer}>
            <Text style={styles.bpmValue}>{bpm}</Text>
            <Text style={styles.bpmUnit}>BPM</Text>
          </View>
          
          {/* VISUALIZATION */}
          <View style={styles.chartContainer}>
            <LineChart
              data={{
                labels: ["10s", "8s", "6s", "4s", "2s", "Now"],
                datasets: [{ data: bpmHistory }]
              }}
              width={width - 64}
              height={180}
              chartConfig={{
                backgroundColor: COLORS.card,
                backgroundGradientFrom: COLORS.card,
                backgroundGradientTo: COLORS.card,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(0, 209, 255, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(160, 160, 160, ${opacity})`,
                style: { borderRadius: 16 },
                propsForDots: {
                  r: "4",
                  strokeWidth: "2",
                  stroke: COLORS.primary
                }
              }}
              bezier
              style={styles.chart}
            />
          </View>
        </View>

        {/* HAPTIC CONTROLS */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Haptic Feedback</Text>
          <View style={styles.sliderContainer}>
            <View style={styles.sliderLabelRow}>
              <Text style={styles.label}>Intensity</Text>
              <Text style={styles.valueText}>{Math.round(hapticIntensity * 100)}%</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={1}
              value={hapticIntensity}
              onValueChange={setHapticIntensity}
              minimumTrackTintColor={COLORS.primary}
              maximumTrackTintColor="#333"
              thumbTintColor={COLORS.primary}
            />
          </View>
          <View style={styles.buttonRow}>
            {['Calm', 'Alert', 'Pulse'].map((pattern) => (
              <TouchableOpacity
                key={pattern}
                style={styles.actionButton}
                onPress={() => triggerHaptic(pattern)}
              >
                <Text style={styles.buttonText}>{pattern}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* SPEAKER SECTION */}
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.cardTitle}>Speaker System</Text>
            <View style={styles.bluetoothBadge}>
              <Ionicons name="bluetooth" size={14} color={COLORS.primary} />
              <Text style={styles.bluetoothText}>{bluetoothDevice || 'Not Connected'}</Text>
            </View>
          </View>
          
          <View style={styles.bluetoothActionRow}>
            <TouchableOpacity 
              onPress={() => setIsAlertOn(!isAlertOn)}
              style={[styles.toggleButton, { backgroundColor: isAlertOn ? COLORS.accent : '#333', flex: 0.45 }]}
            >
              <Ionicons name={isAlertOn ? "volume-high" : "volume-mute"} size={20} color="#FFF" />
              <Text style={styles.toggleText}>{isAlertOn ? 'Alert On' : 'Alert Off'}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={handleBluetoothConnect}
              style={[styles.bluetoothButton, { backgroundColor: bluetoothDevice ? COLORS.primary + '20' : '#333', flex: 0.5 }]}
            >
              <MaterialCommunityIcons 
                name={bluetoothDevice ? "bluetooth-connect" : "bluetooth-audio"} 
                size={20} 
                color={bluetoothDevice ? COLORS.primary : "#FFF"} 
              />
              <Text style={[styles.bluetoothBtnText, { color: bluetoothDevice ? COLORS.primary : "#FFF" }]}>
                {bluetoothDevice ? 'Connected' : 'Pair Speaker'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sliderContainer}>
            <View style={styles.sliderLabelRow}>
              <Text style={styles.label}>Volume</Text>
              <Text style={styles.valueText}>{Math.round(volume * 100)}%</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={1}
              value={volume}
              onValueChange={setVolume}
              minimumTrackTintColor={COLORS.primary}
              maximumTrackTintColor="#333"
              thumbTintColor={COLORS.primary}
            />
          </View>
        </View>

        {/* AI ANALYSIS SECTION */}
        <View style={[styles.card, { borderColor: COLORS.primary + '40', borderWidth: 1, marginBottom: 40 }]}>
          <View style={styles.row}>
            <View style={styles.aiHeader}>
              <MaterialCommunityIcons name="brain" size={24} color={COLORS.primary} />
              <Text style={[styles.cardTitle, { marginLeft: 8 }]}>AI Analysis</Text>
            </View>
            <View style={styles.confidenceBadge}>
              <Text style={styles.confidenceText}>94% Confidence</Text>
            </View>
          </View>
          <View style={styles.aiResult}>
            <Text style={styles.aiStatusLabel}>Status:</Text>
            <Text style={styles.aiStatusValue}>Relaxed</Text>
          </View>
          <Text style={styles.aiDescription}>
            Vitals are stable. Pattern suggests a deep state of relaxation.
          </Text>
        </View>

      </ScrollView>

      {/* EMERGENCY OVERLAY */}
      {emergencyActive && (
        <View style={styles.emergencyOverlay}>
          <MaterialCommunityIcons name="alert-octagon" size={80} color="#FF3B30" />
          <Text style={styles.emergencyTitle}>CRITICAL BPM DETECTED</Text>
          <Text style={styles.emergencyValue}>{emergencyBpm} BPM</Text>
          <View style={styles.countdownCircle}>
            <Text style={styles.countdownNumber}>{countdown}</Text>
          </View>
          <Text style={styles.emergencySub}>
            {countdown === 0 ? 'Emergency Services Notified' : ''}
          </Text>
          
          <View style={styles.emergencyActionRow}>
            {countdown === 0 && (
              <TouchableOpacity 
                style={[styles.cancelButton, { backgroundColor: '#FF3B30', borderColor: '#FF3B30', marginRight: 10 }]}
                onPress={stopAlert}
              >
                <Text style={[styles.cancelButtonText, { color: '#FFF' }]}>STOP ALERT</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={stopAlert}
            >
              <Text style={styles.cancelButtonText}>
                {countdown === 0 ? 'DISMISS' : 'CANCEL EMERGENCY'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  bpmHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  bpmValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginVertical: 10,
  },
  bpmValue: {
    fontSize: 64,
    fontWeight: '900',
    color: COLORS.text,
  },
  bpmUnit: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.accent,
    marginLeft: 5,
  },
  chartContainer: {
    marginTop: 10,
    alignItems: 'center',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  sliderContainer: {
    marginTop: 20,
  },
  sliderLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  valueText: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  actionButton: {
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    flex: 0.3,
    alignItems: 'center',
  },
  buttonText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  toggleText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confidenceBadge: {
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  confidenceText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  aiResult: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
  },
  aiStatusLabel: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  aiStatusValue: {
    color: COLORS.success,
    fontSize: 18,
    fontWeight: '800',
    marginLeft: 8,
  },
  aiDescription: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  bluetoothBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bluetoothText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginLeft: 4,
  },
  bluetoothActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  bluetoothButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  bluetoothBtnText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  emergencyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18, 18, 18, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    zIndex: 1000,
  },
  emergencyTitle: {
    color: '#FF3B30',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 20,
  },
  emergencyValue: {
    color: '#FFF',
    fontSize: 72,
    fontWeight: '900',
    marginVertical: 10,
  },
  emergencySub: {
    color: '#A0A0A0',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
  },
  cancelButton: {
    backgroundColor: '#333',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  cancelButtonText: {
    color: '#FF3B30',
    fontWeight: '800',
    fontSize: 14,
  },
  emergencyActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  countdownNumber: {
    color: '#FFF',
    fontSize: 48,
    fontWeight: '900',
  },
});
