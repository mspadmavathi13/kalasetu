require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const bhashiniRoutes = require("./routes/bhashini");

const app = express();
const PORT = Number(process.env.PORT || 8787);

app.use(cors());
app.use(express.json({ limit: "20mb" }));

app.get("/api/health", (req, res) => {
  const missing = [
    ["BHASHINI_INFERENCE_API_KEY", process.env.BHASHINI_INFERENCE_API_KEY],
    ["BHASHINI_TRANSLATION_SERVICE_ID", process.env.BHASHINI_TRANSLATION_SERVICE_ID],
  ].filter(([, value]) => !value).map(([name]) => name);

  res.json({
    ok: true,
    bhashiniConfigured: missing.length === 0,
    missing,
  });
});

app.use("/api/bhashini", bhashiniRoutes);

app.use(express.static(path.join(__dirname, "public")));

app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API route not found" });
  }
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  const configured = Boolean(
    process.env.BHASHINI_INFERENCE_API_KEY &&
    process.env.BHASHINI_TRANSLATION_SERVICE_ID
  );
  console.log(`KalaSetu running at http://localhost:${PORT}`);
  console.log(`BHASHINI live mode: ${configured ? "READY" : "NOT CONFIGURED"}`);
  if (!configured) {
    console.log("Create .env from .env.example and add your BHASHINI inference key + translation service ID.");
  }
});
