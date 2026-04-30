import sys
import json
import psycopg2
import numpy as np

def get_db_data():
    try:
        # Connect to Supabase Cloud Database
        conn = psycopg2.connect("postgresql://postgres:[Vibillow@123]@db.nvxzstfhpxoolblbhyiv.supabase.co:5432/postgres")
        cur = conn.cursor()
        # Fetch last 20 BPM readings
        cur.execute("SELECT bpm FROM vitals ORDER BY time DESC LIMIT 20")
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return [r[0] for r in rows]
    except Exception as e:
        sys.stderr.write(f"--- [AI ERROR] DB Connection Failed: {e} ---\n")
        return None

def classify_sleep(bpms):
    if not bpms or len(bpms) < 5:
        return {"status": "Analyzing...", "confidence": "0%", "apnea_risk": "Low"}
    
    avg_bpm = np.mean(bpms)
    std_bpm = np.std(bpms)
    
    # --- APNEA RISK ANALYSIS (Based on Notebook Features) ---
    diffs = np.diff(bpms)
    rmssd = np.sqrt(np.mean(diffs**2)) if len(diffs) > 0 else 0
    
    # Feature from Notebook: Zero Crossings (Crossing the mean)
    zero_crossings = 0
    for i in range(1, len(bpms)):
        if (bpms[i] - avg_bpm) * (bpms[i-1] - avg_bpm) < 0:
            zero_crossings += 1

    # Logic from Notebook Analysis:
    # Apnea events show high RMSSD and high Zero Crossings (instability)
    apnea_risk_score = 0
    if rmssd > 8: apnea_risk_score += 30
    if zero_crossings > 5: apnea_risk_score += 25
    if std_bpm > 6: apnea_risk_score += 20
    if max(bpms) - min(bpms) > 15: apnea_risk_score += 25
    
    apnea_risk_label = "Low"
    if apnea_risk_score > 70: apnea_risk_label = "High"
    elif apnea_risk_score > 40: apnea_risk_label = "Moderate"


    # --- DEEP ANALYSIS REASONING ---
    possibilities = []
    reasoning = ""
    
    if avg_bpm > 75:
        status = "Awake"
        confidence = min(0.95, 0.7 + (avg_bpm - 75) / 100)
        reasoning = f"BPM ({avg_bpm:.1f}) is above normal sleep threshold. High metabolic activity detected."
    elif 55 <= avg_bpm <= 75:
        if std_bpm > 4:
            status = "Light Sleep"
            confidence = 0.82
            reasoning = f"Moderate heart rate instability (HRV: {std_bpm:.2f}) indicates transition phase."
        else:
            status = "Relaxed"
            confidence = 0.88
            reasoning = "Stable heart rate within waking resting range. Patient is likely stationary/relaxed."
    elif avg_bpm < 55:
        if std_bpm < 2.5:
            status = "Deep Sleep"
            confidence = 0.94
            reasoning = "Profoundly low heart rate and high stability detected. Signs of physical recovery."
        else:
            status = "Light Sleep"
            confidence = 0.78
            reasoning = "Low heart rate but unexpected variability detected. Potential minor disturbance."
    else:
        status = "Stabilizing"
        confidence = 0.60
        reasoning = "Inconsistent signal detected. Calibrating model baseline."

    if apnea_risk_label != "Low":
        reasoning += f" [CAUTION: {apnea_risk_label} Apnea Risk based on RMSSD {rmssd:.2f}]"
        
    sys.stderr.write(f"--- [AI DEEP ANALYSIS] ---\n")
    sys.stderr.write(f"Reasoning: {reasoning}\n")
    sys.stderr.write(f"Prediction: {status} | Risk: {apnea_risk_label}\n")

    return {
        "status": status,
        "confidence": f"{int(confidence * 100)}%",
        "apnea_risk": apnea_risk_label,
        "avg_bpm": round(avg_bpm, 1),
        "hrv": round(std_bpm, 2),
        "rmssd": round(rmssd, 2),
        "zero_crossings": zero_crossings,
        "samples": len(bpms),
        "reasoning": reasoning
    }




if __name__ == "__main__":
    data = get_db_data()
    result = classify_sleep(data)
    print(json.dumps(result))
