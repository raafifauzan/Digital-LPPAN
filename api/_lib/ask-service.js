const { GoogleGenAI } = require("@google/genai");
const { applyScope, loadAppsFromSheet } = require("./sheet");

const DEFAULT_MODEL = "gemini-2.5-flash";
const DATA_NOT_FOUND_TEXT = "Data tidak ditemukan pada dataset yang tersedia.";

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
  }
}

function sanitizeScope(scope) {
  const quickFilterSet = new Set(["all", "active", "high", "enhancement", "incomplete"]);
  const analyticsViewSet = new Set(["all", "core", "decision_support", "support", "product"]);

  const quickFilter = String(scope?.quickFilter || "all").trim();
  const analyticsView = String(scope?.analyticsView || "all").trim();
  const search = String(scope?.search || "").trim().slice(0, 120);

  return {
    quickFilter: quickFilterSet.has(quickFilter) ? quickFilter : "all",
    analyticsView: analyticsViewSet.has(analyticsView) ? analyticsView : "all",
    search
  };
}

function ensureQuestion(questionRaw) {
  const question = String(questionRaw || "").trim();
  if (!question) throw new HttpError(400, "Body wajib berisi question.");
  if (question.length < 3) throw new HttpError(400, "Panjang question minimal 3 karakter.");
  if (question.length > 500) throw new HttpError(400, "Panjang question maksimal 500 karakter.");
  return question;
}

function cleanEvidence(evidenceRaw) {
  if (!Array.isArray(evidenceRaw)) return [];
  return evidenceRaw
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 5);
}

function extractJsonObject(text) {
  const source = String(text || "").trim();
  if (!source) return null;

  const withoutFence = source.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();

  try {
    return JSON.parse(withoutFence);
  } catch (_error) {
    // Continue to regex extraction.
  }

  const match = withoutFence.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch (_error) {
    return null;
  }
}

function sanitizeAnswer(answerRaw) {
  const text = String(answerRaw || "").trim();
  if (!text) return "";

  const unwrapped = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const parsed = extractJsonObject(unwrapped);
  if (parsed?.answer && typeof parsed.answer === "string" && parsed.answer.trim()) {
    return parsed.answer.trim();
  }

  let candidate = unwrapped;
  if (/^\s*\{/.test(candidate) && /"answer"\s*:/.test(candidate)) {
    candidate = candidate
      .replace(/^[\s{]*"answer"\s*:\s*/i, "")
      .replace(/,\s*"evidence"[\s\S]*$/i, "")
      .replace(/[}\s]*$/i, "")
      .trim();
  }

  const normalized = candidate.replace(/^"+|"+$/g, "").trim();

  return normalized;
}

function buildPrompt(question, rows, scope) {
  const compactRows = rows.map((row) => ({
    name: row.name,
    status: row.status,
    category: row.category,
    criticality: row.criticality,
    maturity: row.maturity,
    roadmap: row.roadmap,
    implementationYear: row.implementationYear,
    dataOwner: row.dataOwner || "-",
    businessOwner: row.businessOwner || "-",
    mandatoryComplete: row.mandatoryComplete
  }));

  return [
    "Anda adalah asisten analitik dashboard digitalisasi.",
    "Jawab HANYA berdasarkan DATASET yang diberikan.",
    "DILARANG menggunakan pengetahuan umum di luar DATASET.",
    `Jika data tidak cukup atau tidak ada, jawab tepat: "${DATA_NOT_FOUND_TEXT}"`,
    "Jawab dengan kalimat natural yang jelas, maksimal 3-5 kalimat.",
    "Jawaban harus lengkap, tidak boleh terpotong.",
    "Jika menyebut angka/fakta, hanya ambil dari dataset.",
    "Jangan gunakan format JSON.",
    "Boleh gunakan markdown ringan agar mudah dibaca: **bold** dan bullet list (- item).",
    "Jangan gunakan tabel markdown dan jangan gunakan code block.",
    "",
    `SCOPE AKTIF: ${JSON.stringify(scope)}`,
    `PERTANYAAN: ${question}`,
    `DATASET: ${JSON.stringify(compactRows)}`
  ].join("\n");
}

async function askGemini({ question, scopedRows, totalRows, scope }) {
  if (!scopedRows.length) {
    return {
      answer: DATA_NOT_FOUND_TEXT,
      evidence: [],
      meta: {
        model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
        rowsUsed: 0,
        totalRows
      }
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new HttpError(500, "Server belum dikonfigurasi untuk AI.");
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const ai = new GoogleGenAI({ apiKey });

  const prompt = buildPrompt(question, scopedRows, scope);
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      temperature: 0.2,
      topP: 0.75,
      topK: 25,
      maxOutputTokens: 1000
    }
  });

  const rawText =
    response?.text ||
    response?.candidates?.[0]?.content?.parts?.map((part) => part?.text || "").join("") ||
    "";

  const parsed = extractJsonObject(rawText);
  const answer = sanitizeAnswer(parsed?.answer || rawText) || DATA_NOT_FOUND_TEXT;
  const evidence = cleanEvidence(parsed?.evidence);

  return {
    answer,
    evidence,
    meta: {
      model,
      rowsUsed: scopedRows.length,
      totalRows
    }
  };
}

async function processAsk(body) {
  const question = ensureQuestion(body?.question);
  const scope = sanitizeScope(body?.scope || {});

  const csvUrl = String(process.env.SHEET_CSV_URL || "").trim();
  if (!csvUrl) {
    throw new HttpError(500, "SHEET_CSV_URL belum diset.");
  }

  const allApps = await loadAppsFromSheet(csvUrl);
  if (!allApps.length) {
    return {
      answer: DATA_NOT_FOUND_TEXT,
      evidence: [],
      meta: {
        model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
        rowsUsed: 0,
        totalRows: 0
      }
    };
  }

  const scopedRows = applyScope(allApps, scope);
  const result = await askGemini({
    question,
    scopedRows,
    totalRows: allApps.length,
    scope
  });

  return result;
}

module.exports = {
  HttpError,
  processAsk
};
