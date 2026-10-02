from pathlib import Path
import json
import re
import numpy as np
import pandas as pd
import joblib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
MODEL_PATH = ROOT / "models" / "heritage_pricing_model.joblib"
META_PATH = ROOT / "models" / "model_metadata.json"

app = FastAPI(
    title="KalaSetu Heritage Pricing API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Local MVP. Restrict this before public deployment.
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = None
metadata = {}

def clean_num(x):
    if x is None:
        return np.nan
    s = str(x).replace(",", "").strip()
    m = re.search(r"[-+]?\d*\.?\d+", s)
    return float(m.group()) if m else np.nan

class PriceRequest(BaseModel):
    product_name: str = Field(default="")
    description: str = Field(default="")
    features: str = Field(default="")
    product_type: str = Field(default="")
    brand: str = Field(default="")
    net_quantity: float | None = None
    height: str | float | None = None
    length: str | float | None = None
    width: str | float | None = None

@app.on_event("startup")
def load_model():
    global model, metadata
    if not MODEL_PATH.exists():
        raise RuntimeError(
            "Model not found. Run: python training/train_model.py"
        )
    model = joblib.load(MODEL_PATH)
    if META_PATH.exists():
        metadata = json.loads(META_PATH.read_text(encoding="utf-8"))

@app.get("/")
def root():
    return {
        "service": "KalaSetu Heritage Pricing",
        "status": "running",
        "model_version": metadata.get("model_version", "unknown")
    }

@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model is not None}

@app.get("/api/model-info")
def model_info():
    return metadata

@app.post("/api/predict-price")
def predict_price(req: PriceRequest):
    if model is None:
        raise HTTPException(status_code=503, detail="Model is not loaded.")

    text = " ".join([
        req.product_name or "",
        req.description or "",
        req.features or ""
    ]).strip().lower()

    row = pd.DataFrame([{
        "text": text,
        "Product Type": req.product_type or "",
        "Brand": req.brand or "",
        "Net Quantity": req.net_quantity,
        "Height": clean_num(req.height),
        "Length": clean_num(req.length),
        "Width": clean_num(req.width),
    }])

    pred_log = float(model.predict(row)[0])
    predicted = max(0.0, float(np.expm1(pred_log)))

    # Error-derived interval from held-out validation, stored during training.
    p90 = float(metadata.get("uncertainty", {}).get(
        "p90_absolute_error_inr", max(100.0, predicted * 0.30)
    ))

    lower = max(0.0, predicted - p90)
    upper = predicted + p90

    # This is an uncertainty proxy, not a calibrated probability.
    relative_uncertainty = min(0.95, p90 / max(predicted, 1.0))
    confidence = max(0.05, min(0.95, 1.0 - relative_uncertainty))

    return {
        "predicted_price": round(predicted),
        "lower_bound": round(lower),
        "upper_bound": round(upper),
        "model_confidence": round(confidence, 2),
        "model_version": metadata.get("model_version", "heritage-pricing-v1"),
        "scope": metadata.get("scope_note", ""),
        "note": "Market-price estimate from the public training distribution; artisan retains final pricing control."
    }
