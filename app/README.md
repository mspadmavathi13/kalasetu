# KalaSetu — Heritage Pricing ML (v1)

This package provides a local FastAPI service for Heritage Pricing.

## Data provenance

Training data:
Coder-Dragon/indian-traditional-artificial-jewellery on Hugging Face.
- 6,953 records
- traditional/handmade Indian jewellery
- actual retail `Price` field
- Apache-2.0
- Source: https://huggingface.co/datasets/Coder-Dragon/indian-traditional-artificial-jewellery

This is a jewellery-focused v1 market-price model. It is NOT claimed to represent all Indian handicrafts.

## Architecture

KalaSetu HTML
  -> POST /api/predict-price
  -> trained TF-IDF + Ridge regression pipeline
  -> predicted market price + uncertainty band

The model uses product text, product type, brand, quantity and dimensions available in the public dataset.
It does not fabricate labour/material/rarity labels that are absent from the source data.

## 1. Install

Windows:
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

## 2. Train

python training/train_model.py

The script downloads the public dataset through Hugging Face Datasets, cleans it, trains the model, evaluates it, and saves:
models/heritage_pricing_model.joblib
models/model_metadata.json

## 3. Run API

python app.py

API:
http://localhost:8000
Docs:
http://localhost:8000/docs

## 4. Test

POST /api/predict-price

Example JSON:
{
  "product_name": "Traditional Kundan Necklace Set",
  "description": "Handmade traditional Indian jewellery with kundan work",
  "features": "Kundan, handmade, traditional",
  "product_type": "Necklace",
  "brand": "",
  "net_quantity": 1,
  "height": "",
  "length": "",
  "width": ""
}

Response:
{
  "predicted_price": 1234.0,
  "lower_bound": 900.0,
  "upper_bound": 1650.0,
  "model_confidence": 0.71,
  "model_version": "heritage-pricing-v1"
}

The uncertainty band is a model-derived validation error band, not a guarantee.
