const express = require("express");
const { HttpError, processAsk } = require("./_lib/ask-service");

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

app.use(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed. Gunakan POST /api/ask."
    });
  }

  try {
    const result = await processAsk(req.body || {});
    return res.status(200).json({
      ok: true,
      answer: result.answer,
      evidence: result.evidence,
      meta: result.meta
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({
        ok: false,
        error: error.message
      });
    }

    return res.status(500).json({
      ok: false,
      error: "Internal server error."
    });
  }
});

module.exports = app;
