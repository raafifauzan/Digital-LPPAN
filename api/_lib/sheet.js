const FETCH_TIMEOUT_MS = 12000;
const FETCH_RETRY_COUNT = 2;
const FETCH_RETRY_BASE_DELAY_MS = 700;

function normalize(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isEmpty(value) {
  return !String(value ?? "").trim();
}

function compactAppName(name) {
  const raw = String(name ?? "").trim();
  const normalized = normalize(raw);

  if (
    normalized ===
    normalize("Dashboard Action & Follow Up Status of Audit / Non Audit Activity and WBS Activity")
  ) {
    return "Dashboard Status Audit & WBS";
  }

  return raw;
}

function parseCSV(csv) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    const next = csv[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (field || row.length) {
        row.push(field);
        rows.push(row);
      }
      row = [];
      field = "";
      if (char === "\r" && next === "\n") i += 1;
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function findHeaderIndex(headers, aliases) {
  const normalizedHeaders = headers.map((header) => normalize(header));
  for (const alias of aliases) {
    const idx = normalizedHeaders.indexOf(normalize(alias));
    if (idx >= 0) return idx;
  }
  return -1;
}

function mapStatus(raw) {
  const value = normalize(raw);
  if (value === "active") return "Active";
  if (value.includes("progress")) return "On Progress";
  return "Unknown";
}

function mapCriticality(raw) {
  const value = normalize(raw);
  if (value === "high") return "High";
  if (value === "medium") return "Medium";
  if (value === "low") return "Low";
  return "Unknown";
}

function mapMaturity(raw) {
  const value = normalize(raw);
  const match = value.match(/level\s*([1-5])/);
  if (!match) return "Unknown";
  return `Level ${match[1]}`;
}

function mapCategory(raw) {
  const value = normalize(raw);
  if (value.includes("core") || value.includes("operational") || value.includes("compliance")) return "Core";
  if (value.includes("decision")) return "Decision Support";
  if (value.includes("support")) return "Support";
  if (value.includes("product")) return "Product";
  return "Unknown";
}

function mapRoadmap(raw) {
  const value = normalize(raw);
  if (value.includes("need enhancement")) return "Need Enhancement";
  if (value.includes("optimal")) return "Optimal";
  return "Unknown";
}

function mapImplementationYear(raw) {
  const text = String(raw ?? "").trim();
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : "Unknown";
}

function isMandatoryComplete(app) {
  return (
    app.status !== "Unknown" &&
    app.category !== "Unknown" &&
    app.criticality !== "Unknown" &&
    app.maturity !== "Unknown" &&
    app.roadmap !== "Unknown" &&
    (!isEmpty(app.businessOwner) || !isEmpty(app.dataOwner))
  );
}

function buildAppModel(csvRows) {
  const headers = csvRows[0] || [];
  const index = {
    name: findHeaderIndex(headers, ["nama aplikasi", "application name"]),
    status: findHeaderIndex(headers, ["status"]),
    category: findHeaderIndex(headers, ["system category", "category"]),
    criticality: findHeaderIndex(headers, ["level criticality", "criticality"]),
    maturity: findHeaderIndex(headers, ["level maturity", "maturity"]),
    roadmap: findHeaderIndex(headers, ["roadmap status", "roadmap"]),
    implementationYear: findHeaderIndex(headers, ["tahun implementasi", "implementation year", "year implementation"]),
    businessOwner: findHeaderIndex(headers, ["bussiness process owner (bpo)", "business process owner (bpo)", "business owner"]),
    dataOwner: findHeaderIndex(headers, ["data owner"])
  };

  return csvRows
    .slice(1)
    .map((row) => {
      const app = {
        name: compactAppName(row[index.name]),
        status: mapStatus(row[index.status]),
        category: mapCategory(row[index.category]),
        criticality: mapCriticality(row[index.criticality]),
        maturity: mapMaturity(row[index.maturity]),
        roadmap: mapRoadmap(row[index.roadmap]),
        implementationYear: mapImplementationYear(row[index.implementationYear]),
        businessOwner: String(row[index.businessOwner] ?? "").trim(),
        dataOwner: String(row[index.dataOwner] ?? "").trim()
      };

      app.mandatoryComplete = isMandatoryComplete(app);
      app.needsImprovement = app.roadmap === "Need Enhancement";
      return app;
    })
    .filter((app) => !isEmpty(app.name));
}

function categoryFromAnalyticsView(analyticsView) {
  const map = {
    core: "Core",
    decision_support: "Decision Support",
    support: "Support",
    product: "Product"
  };
  return map[String(analyticsView || "").trim()] || null;
}

function applyScope(rows, scope = {}) {
  const quickFilter = String(scope.quickFilter || "all");
  const analyticsView = String(scope.analyticsView || "all");
  const search = normalize(scope.search || "");
  const selectedCategory = categoryFromAnalyticsView(analyticsView);

  return rows.filter((app) => {
    if (quickFilter === "active" && app.status !== "Active") return false;
    if (quickFilter === "high" && app.criticality !== "High") return false;
    if (quickFilter === "enhancement" && app.roadmap !== "Need Enhancement") return false;
    if (quickFilter === "incomplete" && app.mandatoryComplete) return false;
    if (selectedCategory && app.category !== selectedCategory) return false;
    if (search && !normalize(app.name).includes(search)) return false;
    return true;
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchCsvWithRetry(url) {
  let lastError;

  for (let attempt = 0; attempt <= FETCH_RETRY_COUNT; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: "no-store"
      });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error?.name === "AbortError" ? new Error("Request timed out or was canceled.") : error;

      if (attempt < FETCH_RETRY_COUNT) {
        await sleep(FETCH_RETRY_BASE_DELAY_MS * (attempt + 1));
        continue;
      }
      throw lastError;
    }
  }

  throw lastError || new Error("Unknown request error.");
}

async function loadAppsFromSheet(csvUrl) {
  const csvText = await fetchCsvWithRetry(csvUrl);
  const rows = parseCSV(csvText);
  return buildAppModel(rows);
}

module.exports = {
  applyScope,
  loadAppsFromSheet
};
