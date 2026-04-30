import time
import os
import sys
from sleep_classifier import get_db_data, classify_sleep

def clear_console():
    os.system('cls' if os.name == 'nt' else 'clear')

def main():
    print("========================================")
    print("      VIBILLOW AI MONITOR ENGINE        ")
    print("========================================")
    print("Status: INITIALIZING ML PIPELINE...")
    time.sleep(1)

    while True:
        try:
            # 1. Ingest Data
            data = get_db_data()
            
            clear_console()
            print("========================================")
            print("      VIBILLOW AI MONITOR ENGINE        ")
            print("========================================")
            print(f"LAST UPDATE: {time.strftime('%H:%M:%S')}")
            print("----------------------------------------")
            
            if not data:
                print("STATUS: [WAITING FOR DATA...]")
            else:
                # 2. Run Classification
                result = classify_sleep(data)
                
                print(f"SIGNAL WINDOW: {result['samples']} beats ingested")
                print(f"MEAN HEART RATE: {result['avg_bpm']} BPM")
                print(f"HRV (SDNN): {result['hrv']}")
                print(f"RMSSD (CLINICAL): {result['rmssd']}ms")
                print(f"ZERO CROSSINGS: {result.get('zero_crossings', 'N/A')}")
                print("----------------------------------------")

                print(f"AI PREDICTION: {result['status'].upper()}")
                print(f"APNEA RISK: {result['apnea_risk'].upper()}")
                print(f"CONFIDENCE: {result['confidence']}")
                print("----------------------------------------")
                print(f"AI REASONING: {result['reasoning']}")
                print("----------------------------------------")
                print("STATUS: [ANALYSIS COMPLETE - CONTINUOUS MONITORING]")

        except KeyboardInterrupt:
            print("\nShutting down AI Monitor...")
            break
        except Exception as e:
            print(f"ERROR: {e}")
        
        # Poll every 5 seconds for a "live" feel
        time.sleep(5)

if __name__ == "__main__":
    main()
