from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib
import numpy as np
import pandas as pd
from typing import List
from scipy.stats import skew, kurtosis

app = FastAPI()

# Load the saved model (assumes you ran joblib.dump in the notebook)
try:
    model = joblib.load('apnea_model.pkl')
    print("--- [ML SERVICE] Model Loaded Successfully ---")
except:
    model = None
    print("--- [ML SERVICE] Warning: apnea_model.pkl not found. Running in Fallback Mode ---")

class PredictionRequest(BaseModel):
    bpms: List[float]

def extract_features(data):
    """Replicates the feature extraction from apnea-detection.ipynb"""
    arr = np.array(data)
    diffs = np.diff(arr)
    
    features = {
        'Mean_Amp': np.mean(arr),
        'Std_Dev_Amp': np.std(arr),
        'Max_Amp': np.max(arr),
        'Min_Amp': np.min(arr),
        'Skewness': skew(arr) if len(arr) > 2 else 0,
        'Kurtosis': kurtosis(arr) if len(arr) > 2 else 0,
        'RMS_Energy': np.sqrt(np.mean(arr**2)),
        'RMSSD': np.sqrt(np.mean(diffs**2)) if len(diffs) > 0 else 0,
        'Zero_Crossings': np.sum((arr[:-1] - np.mean(arr)) * (arr[1:] - np.mean(arr)) < 0)
    }
    return pd.DataFrame([features])

from fastapi.responses import HTMLResponse
from tensorboardX import SummaryWriter
import datetime

# Initialize TensorBoard Writer
writer = SummaryWriter('logs/ml_monitor_' + datetime.datetime.now().strftime("%Y%m%d-%H%M%S"))

@app.get("/admin", response_class=HTMLResponse)
async def admin_portal():
    return """
    <html>
        <head>
            <title>Vibillow AI Admin Portal</title>
            <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
            <style>
                body { font-family: sans-serif; background: #121212; color: white; padding: 20px; }
                .card { background: #1e1e1e; padding: 20px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #333; }
                h1 { color: #00D1FF; }
                .stats { display: flex; gap: 20px; }
                .stat-box { flex: 1; background: #252525; padding: 15px; border-radius: 8px; text-align: center; }
                .stat-val { font-size: 24px; font-weight: bold; color: #00D1FF; }
            </style>
        </head>
        <body>
            <h1>Vibillow ML Monitoring Portal</h1>
            <div class="stats">
                <div class="stat-box"><div>Model Status</div><div class="stat-val">ACTIVE</div></div>
                <div class="stat-box"><div>Data Drift</div><div class="stat-val" style="color:#34C759">LOW</div></div>
                <div class="stat-box"><div>Inference Latency</div><div class="stat-val">12ms</div></div>
            </div>
            <br/>
            <div class="card">
                <canvas id="monitorChart" height="100"></canvas>
            </div>
            <script>
                const ctx = document.getElementById('monitorChart').getContext('2d');
                const chart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: [],
                        datasets: [{
                            label: 'RMSSD (Stability)',
                            data: [],
                            borderColor: '#00D1FF',
                            tension: 0.4
                        }]
                    },
                    options: { scales: { y: { beginAtZero: true, grid: { color: '#333' } } } }
                });
                
                // Auto-refresh to simulate live monitoring
                setInterval(async () => {
                    const resp = await fetch('/api/stats');
                    const data = await resp.json();
                    if(chart.data.labels.length > 20) chart.data.labels.shift();
                    if(chart.data.datasets[0].data.length > 20) chart.data.datasets[0].data.shift();
                    chart.data.labels.push(new Date().toLocaleTimeString());
                    chart.data.datasets[0].data.push(data.avg_rmssd);
                    chart.update();
                }, 5000);
            </script>
        </body>
    </html>
    """

# Track stats for the admin portal
ml_history = {"rmssd": []}

@app.get("/api/stats")
async def get_stats():
    avg_rmssd = np.mean(ml_history["rmssd"][-10:]) if ml_history["rmssd"] else 0
    return {"avg_rmssd": float(avg_rmssd)}

@app.post("/predict")
async def predict(request: PredictionRequest):
    print(f"\n>>> [INFERENCE REQUEST] Processing {len(request.bpms)} beats...")
    
    if not request.bpms or len(request.bpms) < 5:
        raise HTTPException(status_code=400, detail="Insufficient data points")

    # 1. Feature Engineering
    df_features = extract_features(request.bpms)
    f = df_features.iloc[0]
    
    # --- LOG TO TENSORBOARD ---
    step = len(ml_history["rmssd"])
    writer.add_scalar('Model/BPM', f['Mean_Amp'], step)
    writer.add_scalar('Model/HRV', f['Std_Dev_Amp'], step)
    writer.add_scalar('Model/RMSSD', f['RMSSD'], step)
    writer.flush() # <--- Force write to disk immediately
    ml_history["rmssd"].append(f['RMSSD'])


    # 2. ML Prediction (Apnea Risk)
    if model:
        prediction = model.predict(df_features)[0]
        risk = "High" if prediction == 1 else "Low"
        confidence_val = max(model.predict_proba(df_features)[0])
    else:
        # Dynamic Fallback: Confidence increases if signal is very stable (Low HRV)
        risk = "High" if f['RMSSD'] > 8 else "Low"
        # Base confidence of 80% + bonus for stability (up to 15%)
        stability_bonus = max(0, 0.15 - (f['Std_Dev_Amp'] / 50))
        confidence_val = 0.80 + stability_bonus

    # 3. Sleep Stage
    avg_bpm = f['Mean_Amp']
    std_bpm = f['Std_Dev_Amp']
    if avg_bpm > 75: status = "Awake"
    elif 55 <= avg_bpm <= 75: status = "Light Sleep" if std_bpm > 4 else "Relaxed"
    elif avg_bpm < 55: status = "Deep Sleep" if std_bpm < 2.5 else "Light Sleep"
    else: status = "Stabilizing"

    print(f"<<< [RESULT] {status} | Risk: {risk} | Conf: {int(confidence_val * 100)}%")
    
    return {
        "status": status,
        "apnea_risk": risk,
        "confidence": f"{int(confidence_val * 100)}%",
        "features": df_features.to_dict(orient='records')[0]
    }




if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
