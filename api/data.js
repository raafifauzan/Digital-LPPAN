const express = require("express");
const { loadAppsFromSheet } = require("./_lib/sheet");

const app = express();

app.disable("x-powered-by");

app.use(async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed. Gunakan GET /api/data."
    });
  }

  const csvUrl = String(process.env.SHEET_CSV_URL || "").trim();
  if (!csvUrl) {
    return res.status(500).json({
      ok: false,
      error: "SHEET_CSV_URL belum diset."
    });
  }

  try {
    const rows = await loadAppsFromSheet(csvUrl);
    return res.status(200).json({
      ok: true,
      rows
    });
  } catch (_error) {
    return res.status(500).json({
      ok: false,
      error: "Gagal memuat data dashboard."
    });
  }
});

module.exports = app;
