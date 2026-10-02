const DHRUVA_URL = "https://dhruva-api.bhashini.gov.in/services/inference/pipeline";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    const err = new Error(`Missing required environment variable: ${name}`);
    err.code = "CONFIG_MISSING";
    throw err;
  }
  return value;
}

function normalizeAudioFormat(mimeType = "audio/wav") {
  const m = String(mimeType).toLowerCase();
  if (m.includes("wav")) return "wav";
  if (m.includes("webm")) return "webm";
  if (m.includes("ogg")) return "ogg";
  return "wav";
}

async function transcribeAudio(base64Audio, sourceLanguage, mimeType = "audio/wav") {
  const apiKey = requireEnv("BHASHINI_INFERENCE_API_KEY");
  // Use BHASHINI's currently documented language-family ASR services.
  // Dravidian: Kannada/Tamil/Telugu; Indo-Aryan: Hindi/Marathi/Bengali.
  const dravidian = "ai4bharat/conformer-multilingual-dravidian-gpu--t4";
  const indoAryan = "ai4bharat/conformer-multilingual-indo_aryan-gpu--t4";
  const asrServiceId = ["kn", "ta", "te"].includes(sourceLanguage) ? dravidian : indoAryan;

  const body = {
    pipelineTasks: [{
      taskType: "asr",
      config: {
        language: { sourceLanguage },
        serviceId: asrServiceId,
      },
    }],
    inputData: { audio: [{ audioContent: base64Audio }] },
  };

  const resp = await fetchWithTimeout(DHRUVA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: apiKey },
    body: JSON.stringify(body),
  });

  await throwForBhashini(resp, "ASR");
  const data = await resp.json();
  const transcript =
    data?.pipelineResponse?.[0]?.output?.[0]?.source ??
    data?.pipelineResponse?.[0]?.output?.[0]?.target ??
    "";

  if (!transcript.trim()) {
    const err = new Error("BHASHINI returned an empty transcription");
    err.code = "EMPTY_TRANSCRIPT";
    throw err;
  }
  return transcript.trim();
}

async function translateText(text, sourceLanguage, targetLanguage) {
  const apiKey = requireEnv("BHASHINI_INFERENCE_API_KEY");
  const translationServiceId = requireEnv("BHASHINI_TRANSLATION_SERVICE_ID");

  const body = {
    pipelineTasks: [{
      taskType: "translation",
      config: {
        language: { sourceLanguage, targetLanguage },
        serviceId: translationServiceId,
      },
    }],
    inputData: { input: [{ source: text }] },
  };

  const resp = await fetchWithTimeout(DHRUVA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: apiKey },
    body: JSON.stringify(body),
  });

  await throwForBhashini(resp, "translation");
  const data = await resp.json();
  const translated = data?.pipelineResponse?.[0]?.output?.[0]?.target ?? "";

  if (!translated.trim()) {
    const err = new Error("BHASHINI returned an empty translation");
    err.code = "EMPTY_TRANSLATION";
    throw err;
  }
  return translated.trim();
}

async function throwForBhashini(resp, operation) {
  if (resp.ok) return;
  if (resp.status === 401 || resp.status === 403) {
    const err = new Error("BHASHINI authentication failed — check BHASHINI_INFERENCE_API_KEY");
    err.code = "AUTH_ERROR";
    err.status = 401;
    throw err;
  }
  if (resp.status === 429) {
    const err = new Error("BHASHINI rate limit reached — please retry shortly");
    err.code = "RATE_LIMIT";
    err.status = 429;
    throw err;
  }
  const detail = await safeText(resp);
  const err = new Error(`BHASHINI ${operation} error (${resp.status}): ${detail.slice(0, 600)}`);
  err.code = operation === "ASR" ? "ASR_FAILED" : "TRANSLATION_FAILED";
  err.status = resp.status;
  throw err;
}

async function fetchWithTimeout(url, options, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (e) {
    if (e.name === "AbortError") {
      const err = new Error("BHASHINI request timed out");
      err.code = "TIMEOUT";
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function safeText(resp) {
  try { return await resp.text(); } catch { return "<no body>"; }
}

module.exports = { transcribeAudio, translateText };
