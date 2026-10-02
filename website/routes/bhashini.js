const express = require("express");
const { transcribeAudio, translateText } = require("../services/bhashiniClient");

const router = express.Router();
const SUPPORTED_LANGS = new Set(["kn", "hi", "ta", "te", "mr", "bn"]);

function errorStatus(err) {
  if (err.status) return err.status;
  if (err.code === "CONFIG_MISSING") return 500;
  return 502;
}

router.post("/voice", async (req, res) => {
  try {
    const { audioContent, sourceLanguage, targetLanguage = "en", mimeType = "audio/wav" } = req.body || {};
    if (!audioContent) return res.status(400).json({ error: "audioContent (base64) is required" });
    if (!sourceLanguage || !SUPPORTED_LANGS.has(sourceLanguage)) {
      return res.status(400).json({ error: `sourceLanguage must be one of: ${[...SUPPORTED_LANGS].join(", ")}` });
    }

    const transcript = await transcribeAudio(audioContent, sourceLanguage, mimeType);
    let translatedText = "";
    let translationError = null;

    try {
      translatedText = await translateText(transcript, sourceLanguage, targetLanguage);
    } catch (err) {
      translationError = err.message;
    }

    res.json({
      sourceLanguage,
      targetLanguage,
      transcript,
      translatedText,
      translation: translatedText,
      provider: "BHASHINI/AI4BHARAT",
      translationError,
    });
  } catch (err) {
    console.error("[/api/bhashini/voice]", err.code || err.message);
    res.status(errorStatus(err)).json({ error: err.message, code: err.code || "UNKNOWN" });
  }
});

router.post("/translate", async (req, res) => {
  try {
    const { sourceLanguage, targetLanguage = "en", text } = req.body || {};
    if (!text || !String(text).trim()) return res.status(400).json({ error: "text is required" });
    if (!sourceLanguage || !SUPPORTED_LANGS.has(sourceLanguage)) {
      return res.status(400).json({ error: `sourceLanguage must be one of: ${[...SUPPORTED_LANGS].join(", ")}` });
    }

    const translatedText = await translateText(String(text).trim(), sourceLanguage, targetLanguage);
    res.json({
      sourceLanguage,
      targetLanguage,
      sourceText: String(text).trim(),
      translatedText,
      translation: translatedText,
      provider: "BHASHINI/AI4BHARAT",
    });
  } catch (err) {
    console.error("[/api/bhashini/translate]", err.code || err.message);
    res.status(errorStatus(err)).json({ error: err.message, code: err.code || "UNKNOWN" });
  }
});

module.exports = router;
