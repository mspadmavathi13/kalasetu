import json
import re
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from datasets import load_dataset
from sklearn.compose import ColumnTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "models"
DATA_DIR = ROOT / "data"
MODEL_DIR.mkdir(exist_ok=True)
DATA_DIR.mkdir(exist_ok=True)

DATASET_ID = "Coder-Dragon/indian-traditional-artificial-jewellery"

def clean_num(x):
    if x is None or (isinstance(x, float) and np.isnan(x)):
        return np.nan
    s = str(x).replace(",", "").strip()
    m = re.search(r"[-+]?\d*\.?\d+", s)
    return float(m.group()) if m else np.nan

def main():
    print("Downloading/reading public dataset:", DATASET_ID)
    ds = load_dataset(DATASET_ID, split="train")
    df = ds.to_pandas()
    print("Raw rows:", len(df))

    required = [
        "Product Name", "Description", "Features", "Price",
        "Brand", "Product Type", "Net Quantity", "Height", "Length", "Width"
    ]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise RuntimeError(f"Dataset schema changed; missing: {missing}")

    df = df[required].copy()
    df["Price"] = pd.to_numeric(df["Price"], errors="coerce")
    df = df[df["Price"].notna() & (df["Price"] > 0)].copy()

    for c in ["Product Name", "Description", "Features", "Brand", "Product Type"]:
        df[c] = df[c].fillna("").astype(str)

    for c in ["Net Quantity", "Height", "Length", "Width"]:
        df[c] = df[c].map(clean_num)

    # Remove extreme data errors while retaining expensive legitimate items.
    q1, q99 = df["Price"].quantile([0.01, 0.99])
    df = df[(df["Price"] >= max(1, q1 * 0.5)) & (df["Price"] <= q99 * 1.5)].copy()

    # Text is the strongest representation available in this source.
    df["text"] = (
        df["Product Name"] + " " +
        df["Description"] + " " +
        df["Features"]
    ).str.lower()

    # Log target reduces domination by a small number of very expensive products.
    X = df[[
        "text", "Product Type", "Brand",
        "Net Quantity", "Height", "Length", "Width"
    ]]
    y = np.log1p(df["Price"].astype(float))

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42
    )

    pre = ColumnTransformer(
        transformers=[
            ("text", TfidfVectorizer(
                max_features=12000,
                ngram_range=(1, 2),
                min_df=2,
                sublinear_tf=True
            ), "text"),
            ("type", OneHotEncoder(handle_unknown="ignore"), ["Product Type"]),
            ("brand", OneHotEncoder(handle_unknown="ignore"), ["Brand"]),
            ("num", Pipeline([
                ("imputer", SimpleImputer(strategy="median")),
                ("scale", StandardScaler())
            ]), ["Net Quantity", "Height", "Length", "Width"]),
        ],
        remainder="drop"
    )

    model = Pipeline([
        ("preprocessor", pre),
        ("regressor", Ridge(alpha=8.0))
    ])

    model.fit(X_train, y_train)
    pred_log = model.predict(X_test)
    pred = np.maximum(0, np.expm1(pred_log))
    actual = np.expm1(y_test)

    mae = mean_absolute_error(actual, pred)
    rmse = mean_squared_error(actual, pred) ** 0.5
    r2 = r2_score(actual, pred)

    abs_err = np.abs(actual.to_numpy() - pred)
    p90_error = float(np.quantile(abs_err, 0.90))
    median_abs_error = float(np.median(abs_err))

    # Store a compact, reproducible dataset snapshot used for training.
    df.to_csv(DATA_DIR / "training_snapshot.csv", index=False)

    joblib.dump(model, MODEL_DIR / "heritage_pricing_model.joblib")

    metadata = {
        "model_version": "heritage-pricing-v1",
        "dataset": DATASET_ID,
        "rows_after_cleaning": int(len(df)),
        "target": "retail_price_inr",
        "model": "TF-IDF + categorical one-hot + scaled numeric features + Ridge regression",
        "metrics": {
            "MAE_INR": round(float(mae), 2),
            "RMSE_INR": round(float(rmse), 2),
            "R2": round(float(r2), 4)
        },
        "uncertainty": {
            "median_absolute_error_inr": round(median_abs_error, 2),
            "p90_absolute_error_inr": round(p90_error, 2)
        },
        "source_license": "Apache-2.0",
        "scope_note": "Traditional/handmade Indian jewellery retail prices; not a universal Indian handicraft price model."
    }
    (MODEL_DIR / "model_metadata.json").write_text(
        json.dumps(metadata, indent=2), encoding="utf-8"
    )

    print("\nTRAINING COMPLETE")
    print(json.dumps(metadata, indent=2))

if __name__ == "__main__":
    main()
