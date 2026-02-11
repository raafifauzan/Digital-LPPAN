require("dotenv").config();

const path = require("path");
const express = require("express");
const askApp = require("./api/ask");
const dataApp = require("./api/data");

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.disable("x-powered-by");

app.use("/api/ask", askApp);
app.use("/api/data", dataApp);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Dashboard running at http://localhost:${PORT}`);
});
