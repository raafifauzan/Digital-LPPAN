const API_CONFIG = {
  dataUrl: "/api/data"
};

const STATUS_BUCKETS = ["Active", "On Progress", "Unknown"];
const CRITICALITY_BUCKETS = ["High", "Medium", "Low", "Unknown"];
const MATURITY_BUCKETS = ["Level 1", "Level 2", "Level 3", "Level 4", "Level 5", "Unknown"];
const CATEGORY_BUCKETS = ["Core", "Decision Support", "Support", "Product", "Unknown"];
const ROADMAP_BUCKETS = ["Need Enhancement", "Optimal", "Unknown"];
const STATUS_CHART_BUCKETS = ["Active", "On Progress"];
const CRITICALITY_CHART_BUCKETS = ["High", "Medium", "Low"];
const MATURITY_CHART_BUCKETS = ["Level 1", "Level 2", "Level 3", "Level 4", "Level 5"];
const CATEGORY_CHART_BUCKETS = ["Core", "Decision Support", "Support", "Product"];
const BAR_CHART_GRACE = "10%";
const CHART_GREEN_SCALE = ["#166534", "#15803d", "#16a34a", "#22c55e", "#4ade80", "#86efac"];
const CHART_NEUTRAL = "#e2e8f0";
const FETCH_TIMEOUT_MS = 12000;
const FETCH_RETRY_COUNT = 2;
const FETCH_RETRY_BASE_DELAY_MS = 700;
const DARK_THEME_LOCKED = true;

const state = {
  allApps: [],
  analyticsView: "all",
  projectSearch: "",
  filterActiveOnly: false,
  filterHighCritical: false,
  filterNeedEnhancement: false,
  filterIncompleteData: false,
  currentPage: 1,
  pageSize: 5,
  isLoading: false,
  askAi: {
    isOpen: false,
    isSending: false,
    messages: [
      { role: "assistant", text: "Tanyakan sesuatu tentang data dashboard ini.", timestamp: Date.now() }
    ]
  }
};

const els = {
  refreshBtn: document.getElementById("refreshBtn"),
  themeToggle: document.getElementById("themeToggle"),
  themeToggleIcon: document.getElementById("themeToggleIcon"),
  projectSearch: document.getElementById("projectSearch"),
  errorText: document.getElementById("errorText"),
  overviewSubtitle: document.getElementById("overviewSubtitle"),
  summarySection: document.getElementById("summarySection"),
  mainChartSection: document.getElementById("mainChartSection"),
  secondaryChartSection: document.getElementById("secondaryChartSection"),
  tableSection: document.getElementById("tableSection"),

  kpiGrid: document.getElementById("kpiGrid"),

  snapshotHighCritical: document.getElementById("snapshotHighCritical"),
  snapshotNeedEnhancement: document.getElementById("snapshotNeedEnhancement"),
  snapshotIncomplete: document.getElementById("snapshotIncomplete"),
  snapshotRiskExposure: document.getElementById("snapshotRiskExposure"),

  activeFiltersText: document.getElementById("activeFiltersText"),
  clearTableFiltersBtn: document.getElementById("clearTableFiltersBtn"),
  quickFilterDropdown: document.getElementById("quickFilterDropdown"),
  quickFilter: document.getElementById("quickFilter"),
  quickFilterBtn: document.getElementById("quickFilterBtn"),
  quickFilterMenu: document.getElementById("quickFilterMenu"),
  quickFilterLabel: document.getElementById("quickFilterLabel"),
  quickFilterReset: document.getElementById("quickFilterReset"),
  analyticsDropdown: document.getElementById("analyticsDropdown"),
  analyticsView: document.getElementById("analyticsView"),
  analyticsViewBtn: document.getElementById("analyticsViewBtn"),
  analyticsViewMenu: document.getElementById("analyticsViewMenu"),
  analyticsViewLabel: document.getElementById("analyticsViewLabel"),
  prevPageBtn: document.getElementById("prevPageBtn"),
  nextPageBtn: document.getElementById("nextPageBtn"),
  pageButtons: document.getElementById("pageButtons"),
  paginationSummary: document.getElementById("paginationSummary"),

  monitoringTableBody: document.getElementById("monitoringTableBody"),
  monitoringMobileList: document.getElementById("monitoringMobileList"),
  insightSummary: document.getElementById("insightSummary"),

  askAiFab: document.getElementById("askAiFab"),
  askAiPanel: document.getElementById("askAiPanel"),
  askAiCloseBtn: document.getElementById("askAiCloseBtn"),
  askAiForm: document.getElementById("askAiForm"),
  askAiInput: document.getElementById("askAiInput"),
  askAiSubmitBtn: document.getElementById("askAiSubmitBtn"),
  askAiError: document.getElementById("askAiError"),
  askAiMessages: document.getElementById("askAiMessages")
};

let mainDistributionChart;
let criticalityPieChart;
let maturityBarChart;
let statusBarChart;
let dataOwnerBarChart;
let implementationYearBarChart;
let projectSearchTimer;
let loadAbortController;
let chartReflowTimer;
let cursorBgRaf;
let lastCursorBgUpdate = 0;
let lastCursorX = 12;
let lastCursorY = 6;

function isDarkThemeEnabled() {
  return document.documentElement.classList.contains("theme-dark");
}

function syncThemeToggleUi() {
  const dark = isDarkThemeEnabled();
  if (els.themeToggleIcon) {
    els.themeToggleIcon.textContent = dark ? "light_mode" : "dark_mode";
  }
  if (els.themeToggle) {
    if (DARK_THEME_LOCKED) {
      els.themeToggle.setAttribute("aria-label", "Dark mode is temporarily locked");
      els.themeToggle.setAttribute("title", "Dark mode is temporarily locked");
      els.themeToggle.disabled = true;
      els.themeToggle.classList.add("opacity-60", "cursor-not-allowed");
      return;
    }
    els.themeToggle.disabled = false;
    els.themeToggle.classList.remove("opacity-60", "cursor-not-allowed");
    els.themeToggle.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    els.themeToggle.setAttribute("title", dark ? "Light Mode" : "Dark Mode");
  }
}

function applyTheme(mode) {
  if (DARK_THEME_LOCKED) {
    document.documentElement.classList.remove("theme-dark");
    try {
      localStorage.setItem("dashboard-theme", "light");
    } catch (_error) {
      // noop
    }
    applyChartThemeDefaults();
    reflowCharts();
    syncThemeToggleUi();
    return;
  }
  const useDark = mode === "dark";
  document.documentElement.classList.toggle("theme-dark", useDark);
  try {
    localStorage.setItem("dashboard-theme", useDark ? "dark" : "light");
  } catch (_error) {
    // noop
  }
  applyChartThemeDefaults();
  reflowCharts();
  syncThemeToggleUi();
}

function applyChartThemeDefaults() {
  if (!window.Chart) return;
  const dark = isDarkThemeEnabled();
  Chart.defaults.color = dark ? "#9fb0c6" : "#64748b";
  Chart.defaults.plugins.tooltip.backgroundColor = dark ? "rgba(13, 22, 40, 0.95)" : "rgba(255, 255, 255, 0.9)";
  Chart.defaults.plugins.tooltip.titleColor = dark ? "#f1f5f9" : "#0f172a";
  Chart.defaults.plugins.tooltip.bodyColor = dark ? "#d4deec" : "#334155";
  Chart.defaults.plugins.tooltip.borderColor = dark ? "rgba(71, 85, 105, 0.55)" : "rgba(148, 163, 184, 0.35)";
}

if (window.Chart) {
  Chart.defaults.font.family = '"Plus Jakarta Sans", "Helvetica", "Arial", sans-serif';
  applyChartThemeDefaults();
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.cornerRadius = 12;
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.displayColors = false;
  Chart.defaults.plugins.tooltip.titleMarginBottom = 6;
  Chart.register({
    id: "barValueLabel",
    afterDatasetsDraw(chart) {
      if (chart.config.type !== "bar") return;
      const { ctx } = chart;
      const isHorizontal = chart.options?.indexAxis === "y";
      ctx.save();
      ctx.fillStyle = "#334155";
      ctx.font = '600 11px "Plus Jakarta Sans", Helvetica, Arial, sans-serif';
      ctx.textAlign = isHorizontal ? "left" : "center";
      ctx.textBaseline = isHorizontal ? "middle" : "bottom";
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        meta.data.forEach((bar, index) => {
          const value = dataset.data[index];
          if (value == null) return;
          if (isHorizontal) {
            ctx.fillText(String(value), bar.x + 6, bar.y);
          } else {
            ctx.fillText(String(value), bar.x, bar.y - 6);
          }
        });
      });
      ctx.restore();
    }
  });
  Chart.register({
    id: "segmentValueLabel",
    afterDatasetsDraw(chart) {
      if (!["doughnut", "pie"].includes(chart.config.type)) return;
      const { ctx } = chart;
      const meta = chart.getDatasetMeta(0);
      const values = chart.data.datasets?.[0]?.data || [];
      const total = values.reduce((sum, value) => sum + Number(value || 0), 0);
      if (!total) return;

      ctx.save();
      ctx.font = '600 11px "Plus Jakarta Sans", Helvetica, Arial, sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      meta.data.forEach((arc, index) => {
        const rawValue = Number(values[index] || 0);
        if (!rawValue) return;

        const angle = (arc.startAngle + arc.endAngle) / 2;
        const radius = arc.innerRadius + (arc.outerRadius - arc.innerRadius) * 0.55;
        const x = arc.x + Math.cos(angle) * radius;
        const y = arc.y + Math.sin(angle) * radius;

        // Small slices are skipped to avoid overlapping labels.
        const pct = (rawValue / total) * 100;
        if (pct < 8) return;

        ctx.fillStyle = "#ffffff";
        ctx.fillText(String(rawValue), x, y);
      });

      ctx.restore();
    }
  });
}

function normalize(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function displayText(value) {
  const text = String(value ?? "").trim();
  return normalize(text) === "unknown" || !text ? "-" : text;
}

function splitDataOwners(raw) {
  return String(raw ?? "")
    .split(/[;,/|\n]+|\s+dan\s+/i)
    .map((item) => item.trim())
    .filter(Boolean);
}

function badgeClass(type, value) {
  const v = normalize(value);
  if (type === "status") {
    if (v === "active") return "inline-flex whitespace-nowrap rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700";
    if (v.includes("progress")) return "inline-flex whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700";
    return "inline-flex whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700";
  }
  if (type === "criticality") {
    if (v === "high") return "inline-flex whitespace-nowrap rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700";
    if (v === "medium") return "inline-flex whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700";
    if (v === "low") return "inline-flex whitespace-nowrap rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700";
    return "inline-flex whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700";
  }
  if (type === "roadmap") {
    if (v.includes("enhancement")) return "inline-flex max-w-[120px] whitespace-normal items-center justify-center rounded-full bg-amber-100 px-2.5 py-1 text-center text-xs font-medium leading-tight text-amber-700";
    if (v === "optimal") return "inline-flex max-w-[120px] whitespace-normal items-center justify-center rounded-full bg-emerald-100 px-2.5 py-1 text-center text-xs font-medium leading-tight text-emerald-700";
    return "inline-flex max-w-[120px] whitespace-normal items-center justify-center rounded-full bg-slate-100 px-2.5 py-1 text-center text-xs font-medium leading-tight text-slate-700";
  }
  if (type === "maturity") {
    if (v === "level 1") return "inline-flex whitespace-nowrap rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700";
    if (v === "level 2") return "inline-flex whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700";
    if (v === "level 3") return "inline-flex whitespace-nowrap rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-700";
    if (v === "level 4") return "inline-flex whitespace-nowrap rounded-full bg-lime-100 px-2.5 py-1 text-xs font-medium text-lime-700";
    if (v === "level 5") return "inline-flex whitespace-nowrap rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700";
    return "inline-flex whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700";
  }
  return "inline-flex whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700";
}

function renderBadge(type, value) {
  if (normalize(value) === "unknown") return "";
  return `<span class="${badgeClass(type, value)}">${escapeHtml(value)}</span>`;
}

function renderBadgeOrDash(type, value) {
  const badge = renderBadge(type, value);
  return badge || '<span class="text-xs text-slate-400">-</span>';
}

function countByBucket(rows, key, buckets) {
  const result = {};
  buckets.forEach((bucket) => {
    result[bucket] = 0;
  });

  rows.forEach((row) => {
    const value = buckets.includes(row[key]) ? row[key] : "Unknown";
    result[value] += 1;
  });

  return result;
}

function getSelectedCategory() {
  const selectedCategoryMap = {
    core: "Core",
    decision_support: "Decision Support",
    support: "Support",
    product: "Product"
  };
  return selectedCategoryMap[state.analyticsView] || null;
}

function getCategoryScopedRows(rows = state.allApps) {
  const selectedCategory = getSelectedCategory();
  if (!selectedCategory) return rows;
  return rows.filter((app) => app.category === selectedCategory);
}

function passesQuickFilter(app) {
  if (state.filterActiveOnly && app.status !== "Active") return false;
  if (state.filterHighCritical && app.criticality !== "High") return false;
  if (state.filterNeedEnhancement && app.roadmap !== "Need Enhancement") return false;
  if (state.filterIncompleteData && app.mandatoryComplete) return false;
  return true;
}

function getDashboardRows() {
  return getCategoryScopedRows(state.allApps).filter(passesQuickFilter);
}

function getChartRows() {
  return getDashboardRows().filter((app) => app.mandatoryComplete);
}

function renderKPIs() {
  const scopedRows = getDashboardRows();
  const total = scopedRows.length;
  const active = scopedRows.filter((app) => app.status === "Active").length;
  const needingImprovement = scopedRows.filter((app) => app.needsImprovement).length;
  const completeness = total
    ? (scopedRows.filter((app) => app.mandatoryComplete).length / total) * 100
    : 0;

  els.kpiGrid.innerHTML = `
    <article class="kpi-card h-full min-h-[122px] rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-card flex flex-col justify-between">
      <div class="flex items-start justify-between">
        <div class="h-8 w-8 rounded-lg bg-brand-50 text-brand-600 grid place-items-center">
          <span class="material-symbols-outlined">apps</span>
        </div>
        <span class="rounded-full bg-brand-50 px-2 py-1 text-[11px] font-medium text-brand-700">Portfolio</span>
      </div>
      <div class="pt-3 text-right">
        <p class="kpi-value text-4xl leading-none font-semibold text-[#0b3d20]">${total}</p>
        <p class="mt-3 text-xs text-slate-500">Total Applications</p>
      </div>
    </article>
    <article class="kpi-card h-full min-h-[122px] rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-card flex flex-col justify-between">
      <div class="flex items-start justify-between">
        <div class="h-8 w-8 rounded-lg bg-brand-50 text-brand-600 grid place-items-center">
          <span class="material-symbols-outlined">task_alt</span>
        </div>
        <span class="rounded-full bg-brand-50 px-2 py-1 text-[11px] font-medium text-brand-700">Status</span>
      </div>
      <div class="pt-3 text-right">
        <p class="kpi-value text-4xl leading-none font-semibold text-[#0b3d20]">${active}</p>
        <p class="mt-3 text-xs text-slate-500">Active Applications</p>
      </div>
    </article>
    <article class="kpi-card h-full min-h-[122px] rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-card flex flex-col justify-between">
      <div class="flex items-start justify-between">
        <div class="h-8 w-8 rounded-lg bg-brand-50 text-brand-600 grid place-items-center">
          <span class="material-symbols-outlined">construction</span>
        </div>
        <span class="rounded-full bg-brand-50 px-2 py-1 text-[11px] font-medium text-brand-700">Attention</span>
      </div>
      <div class="pt-3 text-right">
        <p class="kpi-value text-4xl leading-none font-semibold text-[#0b3d20]">${needingImprovement}</p>
        <p class="mt-3 text-xs text-slate-500">Need Enhancement</p>
      </div>
    </article>
    <article class="kpi-card h-full min-h-[122px] rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-card flex flex-col justify-between">
      <div class="flex items-start justify-between">
        <div class="h-8 w-8 rounded-lg bg-brand-50 text-brand-600 grid place-items-center">
          <span class="material-symbols-outlined">dataset</span>
        </div>
        <span class="rounded-full bg-brand-50 px-2 py-1 text-[11px] font-medium text-brand-700">Quality</span>
      </div>
      <div class="pt-3 text-right">
        <p class="kpi-value text-4xl leading-none font-semibold text-[#0b3d20]">${completeness.toFixed(1)}%</p>
        <p class="mt-3 text-xs text-slate-500">Data Completeness</p>
      </div>
    </article>
  `;
}

function renderInsight() {
  const scopedRows = getDashboardRows();
  const total = scopedRows.length;
  const statusDist = countByBucket(scopedRows, "status", STATUS_BUCKETS);
  const criticalityDist = countByBucket(scopedRows, "criticality", CRITICALITY_BUCKETS);
  const categoryDist = countByBucket(scopedRows, "category", CATEGORY_BUCKETS);
  const roadmapDist = countByBucket(scopedRows, "roadmap", ROADMAP_BUCKETS);
  const riskExposure = scopedRows.filter(
    (app) => app.criticality === "High" || app.roadmap === "Need Enhancement" || !app.mandatoryComplete
  ).length;

  const topCategory = Object.entries(categoryDist).sort((a, b) => b[1] - a[1])[0] || ["Unknown", 0];
  const completeness = total
    ? (scopedRows.filter((app) => app.mandatoryComplete).length / total) * 100
    : 0;

  els.insightSummary.textContent = `Dari ${total} aplikasi, eksposur risiko saat ini ada pada ${riskExposure} aplikasi, terutama dari ${criticalityDist.High} High Criticality dan ${roadmapDist["Need Enhancement"]} Need Enhancement. Kategori terbesar adalah ${topCategory[0]} (${topCategory[1]} aplikasi), dengan data completeness ${completeness.toFixed(1)}% dan ${statusDist.Unknown} status masih Unknown.`;
}

function renderOverviewChart() {
  if (!window.Chart) return;
  const compactView = window.matchMedia("(max-width: 1280px)").matches;

  const chartRows = getChartRows();
  const selectedCategory = getSelectedCategory();
  const filteredRows = chartRows;

  const dist = countByBucket(filteredRows, "category", CATEGORY_CHART_BUCKETS);
  if (els.overviewSubtitle) {
    els.overviewSubtitle.textContent = selectedCategory
      ? `Applications in ${selectedCategory} category`
      : "Applications by system category";
  }

  if (mainDistributionChart) mainDistributionChart.destroy();
  mainDistributionChart = new Chart(document.getElementById("mainDistributionChart"), {
    type: "bar",
    data: {
      labels: CATEGORY_CHART_BUCKETS,
      datasets: [
        {
          label: "Applications",
          data: CATEGORY_CHART_BUCKETS.map((bucket) => dist[bucket]),
          backgroundColor: CHART_GREEN_SCALE.slice(1, 5),
          borderRadius: 8,
          maxBarThickness: compactView ? 58 : 72,
          barPercentage: 0.9,
          categoryPercentage: 0.85
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            maxRotation: 0,
            minRotation: 0,
            autoSkip: false,
            font: { size: compactView ? 10 : 12 },
            callback(value) {
              const label = this.getLabelForValue(value);
              if (compactView && label === "Decision Support") return "Decision";
              return label;
            }
          }
        },
        y: {
          display: false,
          beginAtZero: true,
          grace: BAR_CHART_GRACE
        }
      }
    }
  });
}

function renderSecondaryCharts() {
  if (!window.Chart) return;
  const compactView = window.matchMedia("(max-width: 1280px)").matches;

  const chartRows = getChartRows();
  const scopedRows = getDashboardRows();
  const criticalityDist = countByBucket(chartRows, "criticality", CRITICALITY_CHART_BUCKETS);
  const maturityDist = countByBucket(chartRows, "maturity", MATURITY_CHART_BUCKETS);
  const statusDist = countByBucket(chartRows, "status", STATUS_CHART_BUCKETS);
  const ownerCountMap = {};
  const ownerLabelMap = {};
  scopedRows.forEach((app) => {
    const owners = splitDataOwners(app.dataOwner);
    if (!owners.length) return;

    owners.forEach((owner) => {
      const key = normalize(owner);
      ownerCountMap[key] = (ownerCountMap[key] || 0) + 1;
      if (!ownerLabelMap[key]) ownerLabelMap[key] = owner;
    });
  });
  const ownerEntries = Object.entries(ownerCountMap).sort((a, b) => b[1] - a[1]);
  const ownerTop = ownerEntries.slice(0, 5);
  const othersTotal = ownerEntries.slice(5).reduce((sum, [, count]) => sum + count, 0);

  const ownerLabels = ownerTop.map(([ownerKey]) => {
    const label = ownerLabelMap[ownerKey] || ownerKey;
    return label.length > 18 ? `${label.slice(0, 18)}...` : label;
  });
  const ownerValues = ownerTop.map(([, count]) => count);
  if (othersTotal > 0) {
    ownerLabels.push("Others");
    ownerValues.push(othersTotal);
  }
  const ownerBarColors = ownerLabels.map((label, index) => {
    if (label === "Others") return CHART_NEUTRAL;
    return CHART_GREEN_SCALE[index] || CHART_GREEN_SCALE[CHART_GREEN_SCALE.length - 1];
  });

  const yearCountMap = {};
  scopedRows.forEach((app) => {
    if (app.implementationYear === "Unknown") return;
    yearCountMap[app.implementationYear] = (yearCountMap[app.implementationYear] || 0) + 1;
  });
  const yearLabels = Object.keys(yearCountMap).sort((a, b) => Number(a) - Number(b));
  const yearValues = yearLabels.map((year) => yearCountMap[year]);

  if (criticalityPieChart) criticalityPieChart.destroy();
  criticalityPieChart = new Chart(document.getElementById("criticalityPieChart"), {
    type: "doughnut",
    data: {
      labels: CRITICALITY_CHART_BUCKETS,
      datasets: [
        {
          data: CRITICALITY_CHART_BUCKETS.map((bucket) => criticalityDist[bucket]),
          backgroundColor: CHART_GREEN_SCALE.slice(0, 3),
          borderWidth: 0,
          offset: (context) => (context.dataIndex === 0 ? 16 : 0),
          hoverOffset: 14
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      radius: "85%",
      cutout: "40%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            boxWidth: compactView ? 10 : 14,
            boxHeight: compactView ? 10 : 14,
            padding: compactView ? 10 : 14,
            font: { size: compactView ? 11 : 12 }
          }
        }
      }
    }
  });

  if (maturityBarChart) maturityBarChart.destroy();
  maturityBarChart = new Chart(document.getElementById("maturityBarChart"), {
    type: "bar",
    data: {
      labels: MATURITY_CHART_BUCKETS,
      datasets: [
        {
          label: "Applications",
          data: MATURITY_CHART_BUCKETS.map((bucket) => maturityDist[bucket]),
          backgroundColor: CHART_GREEN_SCALE[2],
          borderRadius: 7,
          maxBarThickness: 56,
          barPercentage: 0.9,
          categoryPercentage: 0.85
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { display: false, beginAtZero: true, grace: BAR_CHART_GRACE }
      }
    }
  });

  if (statusBarChart) statusBarChart.destroy();
  const statusMax = Math.max(...STATUS_CHART_BUCKETS.map((bucket) => statusDist[bucket]), 0);
  statusBarChart = new Chart(document.getElementById("statusBarChart"), {
    type: "bar",
    data: {
      labels: STATUS_CHART_BUCKETS,
      datasets: [
        {
          data: STATUS_CHART_BUCKETS.map((bucket) => statusDist[bucket]),
          backgroundColor: CHART_GREEN_SCALE[3],
          borderRadius: 6,
          maxBarThickness: 62,
          barPercentage: 0.9,
          categoryPercentage: 0.85
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, minRotation: 0, font: { size: 10 } } },
        y: {
          display: false,
          beginAtZero: true,
          suggestedMax: Math.max(5, Math.ceil(statusMax * 1.35)),
          grace: BAR_CHART_GRACE
        }
      }
    }
  });

  if (dataOwnerBarChart) dataOwnerBarChart.destroy();
  dataOwnerBarChart = new Chart(document.getElementById("dataOwnerBarChart"), {
    type: "bar",
    data: {
      labels: ownerLabels.length ? ownerLabels : ["No Data"],
      datasets: [
        {
          data: ownerValues.length ? ownerValues : [0],
          backgroundColor: ownerValues.length ? ownerBarColors : [CHART_NEUTRAL],
          borderRadius: 6,
          maxBarThickness: 56,
          barPercentage: 0.9,
          categoryPercentage: 0.9
        }
      ]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false, beginAtZero: true, grace: BAR_CHART_GRACE },
        y: { grid: { display: false }, ticks: { font: { size: 10 } } }
      }
    }
  });

  if (implementationYearBarChart) implementationYearBarChart.destroy();
  implementationYearBarChart = new Chart(document.getElementById("implementationYearBarChart"), {
    type: "bar",
    data: {
      labels: yearLabels.length ? yearLabels : ["No Data"],
      datasets: [
        {
          data: yearValues.length ? yearValues : [0],
          backgroundColor: CHART_GREEN_SCALE.slice(1, 5),
          borderRadius: 6,
          maxBarThickness: 56,
          barPercentage: 0.9,
          categoryPercentage: 0.9
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, minRotation: 0, font: { size: 10 } } },
        y: { display: false, beginAtZero: true, grace: BAR_CHART_GRACE }
      }
    }
  });
}

function renderSnapshot() {
  const scopedRows = getDashboardRows();
  const highCritical = scopedRows.filter((app) => app.criticality === "High").length;
  const needEnhancement = scopedRows.filter((app) => app.roadmap === "Need Enhancement").length;
  const incomplete = scopedRows.filter((app) => !app.mandatoryComplete).length;
  const riskExposure = scopedRows.filter(
    (app) => app.criticality === "High" || app.roadmap === "Need Enhancement" || !app.mandatoryComplete
  ).length;

  els.snapshotHighCritical.textContent = String(highCritical);
  els.snapshotNeedEnhancement.textContent = String(needEnhancement);
  els.snapshotIncomplete.textContent = String(incomplete);
  els.snapshotRiskExposure.textContent = String(riskExposure);
}

function getFilteredRows() {
  const q = normalize(state.projectSearch);
  return getDashboardRows().filter((app) => {
    if (q && !normalize(app.name).includes(q)) return false;
    return true;
  });
}

function renderTable() {
  renderActiveFiltersText();

  const sortedRows = getFilteredRows().sort((a, b) => {
    const criticalityOrder = CRITICALITY_BUCKETS.indexOf(a.criticality) - CRITICALITY_BUCKETS.indexOf(b.criticality);
    if (criticalityOrder !== 0) return criticalityOrder;
    return a.name.localeCompare(b.name);
  });

  const totalRows = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / state.pageSize));
  state.currentPage = Math.min(Math.max(1, state.currentPage), totalPages);
  const start = (state.currentPage - 1) * state.pageSize;
  const rows = sortedRows.slice(start, start + state.pageSize);
  const startEntry = totalRows ? start + 1 : 0;
  const endEntry = totalRows ? Math.min(start + state.pageSize, totalRows) : 0;

  els.paginationSummary.textContent = `Showing ${startEntry} to ${endEntry} of ${totalRows} entries`;
  els.prevPageBtn.disabled = state.currentPage <= 1;
  els.nextPageBtn.disabled = state.currentPage >= totalPages;

  const maxVisiblePages = 3;
  let from = Math.max(1, state.currentPage - 1);
  let to = Math.min(totalPages, from + maxVisiblePages - 1);
  from = Math.max(1, to - maxVisiblePages + 1);

  const pageWindow = [];
  for (let page = from; page <= to; page += 1) {
    pageWindow.push(page);
  }

  els.pageButtons.innerHTML = pageWindow
    .map((page) => {
      const active = page === state.currentPage;
      return `<button type="button" data-page="${page}" class="h-10 min-w-[40px] rounded-xl border px-3 text-sm ${
        active
          ? "border-brand-200 bg-brand-50 font-semibold text-brand-700"
          : "border-slate-200 bg-white text-slate-700"
      }">${page}</button>`;
    })
    .join("");

  if (!rows.length) {
    if (els.monitoringTableBody) {
      els.monitoringTableBody.innerHTML =
        '<tr><td class="px-3 py-10 text-center text-sm text-slate-500" colspan="8">No applications match the selected filters.</td></tr>';
    }

    if (els.monitoringMobileList) {
      els.monitoringMobileList.innerHTML =
        '<article class="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">No applications match the selected filters.</article>';
    }
    return;
  }

  if (els.monitoringTableBody) {
    els.monitoringTableBody.innerHTML = rows
      .map(
        (app) => `
          <tr class="align-middle">
            <td class="px-4 py-3 font-medium text-slate-700 break-words align-middle">${escapeHtml(app.name)}</td>
            <td class="px-4 py-3 text-center align-middle">${renderBadgeOrDash("status", app.status)}</td>
            <td class="px-4 py-3 text-slate-600 break-words align-middle">${escapeHtml(displayText(app.category))}</td>
            <td class="px-4 py-3 text-center align-middle">${renderBadgeOrDash("criticality", app.criticality)}</td>
            <td class="px-4 py-3 text-center align-middle">${renderBadgeOrDash("maturity", app.maturity)}</td>
            <td class="px-4 py-3 text-center align-middle">${renderBadgeOrDash("roadmap", app.roadmap)}</td>
            <td class="px-4 py-3 text-slate-600 break-words align-middle">${escapeHtml(displayText(app.dataOwner || ""))}</td>
            <td class="px-4 py-3 text-center text-slate-600 align-middle">${escapeHtml(displayText(app.implementationYear))}</td>
          </tr>
        `
      )
      .join("");
  }

  if (els.monitoringMobileList) {
    els.monitoringMobileList.innerHTML = rows
      .map(
        (app) => `
          <article class="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <h4 class="break-words text-sm font-semibold text-slate-800">${escapeHtml(app.name)}</h4>
            <div class="mt-2 flex flex-wrap gap-2">
              ${renderBadgeOrDash("status", app.status)}
              ${renderBadgeOrDash("criticality", app.criticality)}
              ${renderBadgeOrDash("maturity", app.maturity)}
              ${renderBadgeOrDash("roadmap", app.roadmap)}
            </div>
            <div class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>
                <p class="text-slate-400">Category</p>
                <p class="font-medium text-slate-700">${escapeHtml(displayText(app.category))}</p>
              </div>
              <div>
                <p class="text-slate-400">Effective Year</p>
                <p class="font-medium text-slate-700">${escapeHtml(displayText(app.implementationYear))}</p>
              </div>
              <div class="col-span-2">
                <p class="text-slate-400">Data Owner</p>
                <p class="font-medium text-slate-700 break-words">${escapeHtml(displayText(app.dataOwner || ""))}</p>
              </div>
            </div>
          </article>
        `
      )
      .join("");
  }
}

function applyQuickFilter(value) {
  state.filterActiveOnly = value === "active";
  state.filterHighCritical = value === "high";
  state.filterNeedEnhancement = value === "enhancement";
  state.filterIncompleteData = value === "incomplete";

  state.currentPage = 1;
  renderAll();
}

function renderActiveFiltersText() {
  if (!els.activeFiltersText) return;

  const filters = [];
  if (state.filterActiveOnly) filters.push("Active Only");
  if (state.filterHighCritical) filters.push("High Criticality");
  if (state.filterNeedEnhancement) filters.push("Need Enhancement");
  if (state.filterIncompleteData) filters.push("Incomplete Data");
  if (state.projectSearch?.trim()) filters.push(`Search: "${state.projectSearch.trim()}"`);
  const selectedCategory = getSelectedCategory();
  if (selectedCategory) filters.push(`Category: ${selectedCategory}`);

  els.activeFiltersText.textContent = `Active filters: ${filters.length ? filters.join(", ") : "All Data"}`;
}

function getQuickFilterValueFromState() {
  if (state.filterActiveOnly) return "active";
  if (state.filterHighCritical) return "high";
  if (state.filterNeedEnhancement) return "enhancement";
  if (state.filterIncompleteData) return "incomplete";
  return "all";
}

function buildAskAiScopeFromState() {
  return {
    quickFilter: getQuickFilterValueFromState(),
    analyticsView: state.analyticsView || "all",
    search: String(state.projectSearch || "").trim().slice(0, 120)
  };
}

function setAskAiPanelOpen(isOpen) {
  state.askAi.isOpen = Boolean(isOpen);
  if (!els.askAiPanel || !els.askAiFab) return;

  els.askAiPanel.classList.toggle("hidden", !state.askAi.isOpen);
  els.askAiFab.setAttribute("aria-expanded", String(state.askAi.isOpen));

  if (state.askAi.isOpen && els.askAiInput && !state.askAi.isSending) {
    setTimeout(() => {
      els.askAiInput.focus();
    }, 0);
  }
}

function setAskAiError(message) {
  if (!els.askAiError) return;
  const text = String(message || "").trim();
  els.askAiError.textContent = text;
  els.askAiError.classList.toggle("hidden", !text);
}

function setAskAiSending(isSending) {
  state.askAi.isSending = Boolean(isSending);
  if (els.askAiInput) {
    els.askAiInput.disabled = state.askAi.isSending;
  }
  if (els.askAiSubmitBtn) {
    els.askAiSubmitBtn.disabled = state.askAi.isSending;
    els.askAiSubmitBtn.textContent = state.askAi.isSending ? "Mengirim..." : "Kirim";
  }
}

function normalizeAskAiAnswer(answerRaw) {
  const text = String(answerRaw || "").trim();
  if (!text) return "Data tidak ditemukan pada dataset yang tersedia.";

  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed.answer === "string" && parsed.answer.trim()) {
        return parsed.answer.trim();
      }
    } catch (_error) {
      // Keep fallback below.
    }
  }

  return text;
}

function renderAskAiMessages() {
  if (!els.askAiMessages) return;
  els.askAiMessages.innerHTML = state.askAi.messages
    .map((message) => {
      const isUser = message.role === "user";
      const wrapperClass = isUser ? "ml-auto max-w-[85%]" : "max-w-[85%]";
      const bubbleClass = isUser
        ? "rounded-2xl bg-brand-600 px-3 py-2 text-sm text-white"
        : "rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-700";
      const time = new Date(Number(message.timestamp) || Date.now()).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit"
      });
      const timeClass = isUser ? "mt-1 text-right text-[11px] text-slate-500" : "mt-1 text-[11px] text-slate-500";
      return `<div class="${wrapperClass}"><div class="${bubbleClass}">${escapeHtml(message.text)}</div><div class="${timeClass}">${escapeHtml(
        time
      )}</div></div>`;
    })
    .join("");

  els.askAiMessages.scrollTop = els.askAiMessages.scrollHeight;
}

function pushAskAiMessage(role, text) {
  const cleanText = String(text || "").trim();
  if (!cleanText) return;
  state.askAi.messages.push({ role, text: cleanText, timestamp: Date.now() });
  if (state.askAi.messages.length > 20) {
    state.askAi.messages = state.askAi.messages.slice(-20);
  }
  renderAskAiMessages();
}

async function submitAskAiQuestion(event) {
  event.preventDefault();
  if (!els.askAiInput) return;

  const question = String(els.askAiInput.value || "").trim();
  if (question.length < 3) {
    setAskAiError("Pertanyaan minimal 3 karakter.");
    return;
  }
  if (question.length > 500) {
    setAskAiError("Pertanyaan maksimal 500 karakter.");
    return;
  }

  setAskAiError("");
  pushAskAiMessage("user", question);
  if (els.askAiInput) {
    els.askAiInput.value = "";
  }
  setAskAiSending(true);

  try {
    const payload = {
      question,
      scope: buildAskAiScopeFromState()
    };

    const response = await fetch("/api/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    let result = {};
    try {
      result = await response.json();
    } catch (_error) {
      result = {};
    }

    if (!response.ok || !result?.ok) {
      const serverError = String(result?.error || "").trim();
      if (response.status === 400) {
        throw new Error(serverError || "Input tidak valid.");
      }
      if (response.status === 405) {
        throw new Error("Endpoint AI tidak mendukung method ini.");
      }
      throw new Error(serverError || "AI service sedang tidak tersedia.");
    }

    pushAskAiMessage("assistant", normalizeAskAiAnswer(result.answer));
  } catch (error) {
    setAskAiError(error?.message || "Gagal memproses pertanyaan.");
  } finally {
    setAskAiSending(false);
  }
}

function resetAllFilters() {
  state.projectSearch = "";
  state.currentPage = 1;
  state.analyticsView = "all";

  if (els.projectSearch) els.projectSearch.value = "";

  setCustomDropdownValue(els.quickFilter, els.quickFilterLabel, "all", "All Data", els.quickFilterMenu);
  setCustomDropdownValue(
    els.analyticsView,
    els.analyticsViewLabel,
    "all",
    "All Categories",
    els.analyticsViewMenu
  );

  state.filterActiveOnly = false;
  state.filterHighCritical = false;
  state.filterNeedEnhancement = false;
  state.filterIncompleteData = false;
}

function setCustomDropdownValue(inputEl, labelEl, value, labelText, menuEl) {
  if (inputEl) inputEl.value = value;
  if (labelEl) labelEl.textContent = labelText;

  if (menuEl) {
    const options = Array.from(menuEl.querySelectorAll("button[data-value]"));
    options.forEach((option) => {
      const selected = option.dataset.value === value;
      option.setAttribute("aria-selected", String(selected));
      option.classList.toggle("bg-slate-100", selected);
      option.classList.toggle("font-medium", selected);
    });
  }
}

function isMenuOpen(menuEl) {
  return !!menuEl && !menuEl.classList.contains("hidden");
}

function toggleDropdownMenu(buttonEl, menuEl, open) {
  if (!menuEl || !buttonEl) return;
  menuEl.classList.toggle("hidden", !open);
  buttonEl.setAttribute("aria-expanded", String(open));
}

function closeDropdown(menuEl, buttonEl) {
  toggleDropdownMenu(buttonEl, menuEl, false);
}

function openDropdown(menuEl, buttonEl) {
  toggleDropdownMenu(buttonEl, menuEl, true);
}

function setupCustomDropdown({ dropdownEl, buttonEl, menuEl, inputEl, labelEl, onSelect, fallbackLabel }) {
  if (!dropdownEl || !buttonEl || !menuEl) return;

  const getOptions = () => Array.from(menuEl.querySelectorAll("button[data-value]"));

  const setActiveOption = (index) => {
    const options = getOptions();
    options.forEach((option, i) => {
      const highlighted = i === index;
      option.classList.toggle("bg-slate-100", highlighted);
      option.classList.toggle("font-medium", highlighted);
    });
    if (options[index]) options[index].focus();
  };

  const selectOption = (option) => {
    const selectedValue = option.dataset.value || "all";
    const selectedLabel = option.textContent?.trim() || fallbackLabel;
    setCustomDropdownValue(inputEl, labelEl, selectedValue, selectedLabel, menuEl);
    onSelect(selectedValue);
    closeDropdown(menuEl, buttonEl);
  };

  buttonEl.addEventListener("click", () => {
    const willOpen = !isMenuOpen(menuEl);
    closeDropdown(els.quickFilterMenu, els.quickFilterBtn);
    closeDropdown(els.analyticsViewMenu, els.analyticsViewBtn);
    toggleDropdownMenu(buttonEl, menuEl, willOpen);
    if (!willOpen) return;

    const options = getOptions();
    const selectedIndex = Math.max(0, options.findIndex((option) => option.dataset.value === inputEl?.value));
    setActiveOption(selectedIndex);
  });

  buttonEl.addEventListener("keydown", (event) => {
    if (!["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) return;
    event.preventDefault();
    if (!isMenuOpen(menuEl)) openDropdown(menuEl, buttonEl);

    const options = getOptions();
    if (!options.length) return;
    const selectedIndex = Math.max(0, options.findIndex((option) => option.dataset.value === inputEl?.value));
    setActiveOption(selectedIndex);
  });

  menuEl.addEventListener("click", (event) => {
    const option = event.target.closest("button[data-value]");
    if (!option) return;
    selectOption(option);
  });

  menuEl.addEventListener("keydown", (event) => {
    const options = getOptions();
    if (!options.length) return;

    const currentIndex = Math.max(0, options.findIndex((option) => option === document.activeElement));
    let nextIndex = currentIndex;

    if (event.key === "ArrowDown") nextIndex = Math.min(options.length - 1, currentIndex + 1);
    if (event.key === "ArrowUp") nextIndex = Math.max(0, currentIndex - 1);
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = options.length - 1;

    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      setActiveOption(nextIndex);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      selectOption(options[currentIndex]);
      buttonEl.focus();
      return;
    }

    if (event.key === "Escape" || event.key === "Tab") {
      closeDropdown(menuEl, buttonEl);
      if (event.key === "Escape") buttonEl.focus();
    }
  });
}

function renderAll() {
  renderKPIs();
  renderInsight();
  renderOverviewChart();
  renderSecondaryCharts();
  renderSnapshot();
  renderTable();
  reflowCharts();
}

function reflowCharts() {
  const charts = [
    mainDistributionChart,
    criticalityPieChart,
    maturityBarChart,
    statusBarChart,
    dataOwnerBarChart,
    implementationYearBarChart
  ];

  charts.forEach((chart) => {
    if (!chart) return;
    chart.resize();
    chart.update("none");
  });
}

function showError(message) {
  els.errorText.textContent = message;
  els.errorText.classList.remove("hidden");
}

function hideError() {
  els.errorText.textContent = "";
  els.errorText.classList.add("hidden");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setLoadingState(isLoading) {
  state.isLoading = isLoading;

  const sections = [
    els.summarySection,
    els.mainChartSection,
    els.secondaryChartSection,
    els.tableSection
  ];

  sections.forEach((section) => {
    if (!section) return;
    section.classList.toggle("opacity-70", isLoading);
    section.classList.toggle("animate-pulse", isLoading);
  });

  if (els.refreshBtn) {
    els.refreshBtn.disabled = isLoading;
    els.refreshBtn.textContent = isLoading ? "Loading..." : "Refresh Data";
  }

  const controls = [
    els.projectSearch,
    els.quickFilterBtn,
    els.analyticsViewBtn,
    els.quickFilterReset,
    els.clearTableFiltersBtn,
    els.prevPageBtn,
    els.nextPageBtn
  ];

  controls.forEach((control) => {
    if (!control) return;
    control.disabled = isLoading;
  });

  if (isLoading) {
    closeDropdown(els.quickFilterMenu, els.quickFilterBtn);
    closeDropdown(els.analyticsViewMenu, els.analyticsViewBtn);
  }

  if (isLoading && !state.allApps.length) {
    if (els.kpiGrid) {
      els.kpiGrid.innerHTML = Array.from({ length: 4 })
        .map(
          () => `
            <article class="h-full min-h-[122px] rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-card">
              <div class="h-3 w-20 rounded bg-slate-100"></div>
              <div class="mt-5 h-10 w-16 rounded bg-slate-100"></div>
              <div class="mt-3 h-3 w-28 rounded bg-slate-100"></div>
            </article>
          `
        )
        .join("");
    }

    if (els.insightSummary) {
      els.insightSummary.textContent = "Generating executive summary from source data...";
    }

    if (els.monitoringTableBody) {
      els.monitoringTableBody.innerHTML =
        '<tr><td class="px-3 py-10 text-center text-sm text-slate-500" colspan="8">Loading applications...</td></tr>';
    }

    if (els.monitoringMobileList) {
      els.monitoringMobileList.innerHTML =
        '<article class="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">Loading applications...</article>';
    }

    if (els.paginationSummary) {
      els.paginationSummary.textContent = "Loading entries...";
    }
  }
}

async function fetchDashboardRowsWithRetry(url) {
  let lastError;

  for (let attempt = 0; attempt <= FETCH_RETRY_COUNT; attempt += 1) {
    const controller = new AbortController();
    loadAbortController = controller;
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: "no-store"
      });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (!payload?.ok || !Array.isArray(payload?.rows)) {
        throw new Error(payload?.error || "Invalid data payload.");
      }
      return payload.rows;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error?.name === "AbortError") {
        lastError = new Error("Request timed out or was canceled.");
      } else {
        lastError = error;
      }

      if (attempt < FETCH_RETRY_COUNT) {
        await sleep(FETCH_RETRY_BASE_DELAY_MS * (attempt + 1));
        continue;
      }
      throw lastError;
    } finally {
      if (loadAbortController === controller) {
        loadAbortController = null;
      }
    }
  }

  throw lastError || new Error("Unknown request error.");
}

async function loadData() {
  if (loadAbortController) {
    loadAbortController.abort();
  }

  hideError();
  setLoadingState(true);

  try {
    const rows = await fetchDashboardRowsWithRetry(API_CONFIG.dataUrl);
    state.allApps = rows;

    if (!state.allApps.length) throw new Error("No readable rows found in spreadsheet.");

    renderAll();
  } catch (error) {
    if (error?.name === "AbortError") return;
    showError(`Failed to load data: ${error.message}`);
  } finally {
    setLoadingState(false);
  }
}

function bindEvents() {
  els.refreshBtn.addEventListener("click", loadData);
  if (els.themeToggle && !DARK_THEME_LOCKED) {
    els.themeToggle.addEventListener("click", () => {
      applyTheme(isDarkThemeEnabled() ? "light" : "dark");
    });
  }

  if (els.projectSearch) {
    els.projectSearch.addEventListener("input", (event) => {
      clearTimeout(projectSearchTimer);
      projectSearchTimer = setTimeout(() => {
        state.projectSearch = event.target.value || "";
        state.currentPage = 1;
        renderTable();
      }, 300);
    });
  }

  els.prevPageBtn.addEventListener("click", () => {
    if (state.currentPage > 1) state.currentPage -= 1;
    renderTable();
  });

  els.nextPageBtn.addEventListener("click", () => {
    state.currentPage += 1;
    renderTable();
  });

  if (els.quickFilterReset) {
    els.quickFilterReset.addEventListener("click", () => {
      resetAllFilters();
      renderAll();
    });
  }

  if (els.clearTableFiltersBtn) {
    els.clearTableFiltersBtn.addEventListener("click", () => {
      resetAllFilters();
      renderAll();
    });
  }

  setupCustomDropdown({
    dropdownEl: els.quickFilterDropdown,
    buttonEl: els.quickFilterBtn,
    menuEl: els.quickFilterMenu,
    inputEl: els.quickFilter,
    labelEl: els.quickFilterLabel,
    fallbackLabel: "All Data",
    onSelect: (selectedValue) => applyQuickFilter(selectedValue)
  });

  setupCustomDropdown({
    dropdownEl: els.analyticsDropdown,
    buttonEl: els.analyticsViewBtn,
    menuEl: els.analyticsViewMenu,
    inputEl: els.analyticsView,
    labelEl: els.analyticsViewLabel,
    fallbackLabel: "All Categories",
    onSelect: (selectedValue) => {
      state.analyticsView = selectedValue || "all";
      state.currentPage = 1;
      renderAll();
    }
  });

  document.addEventListener("click", (event) => {
    if (
      els.quickFilterMenu &&
      els.quickFilterDropdown &&
      !els.quickFilterDropdown.contains(event.target)
    ) {
      closeDropdown(els.quickFilterMenu, els.quickFilterBtn);
    }
    if (
      els.analyticsViewMenu &&
      els.analyticsDropdown &&
      !els.analyticsDropdown.contains(event.target)
    ) {
      closeDropdown(els.analyticsViewMenu, els.analyticsViewBtn);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    closeDropdown(els.quickFilterMenu, els.quickFilterBtn);
    closeDropdown(els.analyticsViewMenu, els.analyticsViewBtn);
    if (state.askAi.isOpen) {
      setAskAiPanelOpen(false);
    }
  });

  setCustomDropdownValue(
    els.quickFilter,
    els.quickFilterLabel,
    els.quickFilter?.value || "all",
    els.quickFilterLabel?.textContent?.trim() || "All Data",
    els.quickFilterMenu
  );

  setCustomDropdownValue(
    els.analyticsView,
    els.analyticsViewLabel,
    els.analyticsView?.value || "all",
    els.analyticsViewLabel?.textContent?.trim() || "All Categories",
    els.analyticsViewMenu
  );

  if (els.analyticsView) {
    state.analyticsView = els.analyticsView.value || "all";
  }

  if (els.askAiFab) {
    els.askAiFab.addEventListener("click", () => {
      setAskAiPanelOpen(!state.askAi.isOpen);
    });
  }

  if (els.askAiCloseBtn) {
    els.askAiCloseBtn.addEventListener("click", () => {
      setAskAiPanelOpen(false);
    });
  }

  if (els.askAiForm) {
    els.askAiForm.addEventListener("submit", submitAskAiQuestion);
  }

  if (els.askAiInput && els.askAiForm) {
    els.askAiInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      event.preventDefault();
      if (!state.askAi.isSending) {
        els.askAiForm.requestSubmit();
      }
    });
  }

  document.addEventListener("click", (event) => {
    if (!state.askAi.isOpen || !els.askAiPanel || !els.askAiFab) return;
    const clickedInsidePanel = els.askAiPanel.contains(event.target);
    const clickedFab = els.askAiFab.contains(event.target);
    if (!clickedInsidePanel && !clickedFab) {
      setAskAiPanelOpen(false);
    }
  });

  els.pageButtons.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-page]");
    if (!button) return;
    state.currentPage = Number(button.dataset.page || 1);
    renderTable();
  });

  const triggerChartReflow = () => {
    clearTimeout(chartReflowTimer);
    chartReflowTimer = setTimeout(reflowCharts, 120);
  };

  window.addEventListener("resize", triggerChartReflow);
  window.addEventListener("orientationchange", triggerChartReflow);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", triggerChartReflow);
  }

  if (window.matchMedia("(pointer: fine)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.addEventListener("mousemove", (event) => {
      if (cursorBgRaf) cancelAnimationFrame(cursorBgRaf);
      cursorBgRaf = requestAnimationFrame(() => {
        const now = performance.now();
        if (now - lastCursorBgUpdate < 32) return;

        const x = (event.clientX / window.innerWidth) * 100;
        const y = (event.clientY / window.innerHeight) * 100;
        if (Math.abs(x - lastCursorX) < 0.6 && Math.abs(y - lastCursorY) < 0.6) return;

        document.body.style.setProperty("--cursor-x", `${x.toFixed(2)}%`);
        document.body.style.setProperty("--cursor-y", `${y.toFixed(2)}%`);
        lastCursorX = x;
        lastCursorY = y;
        lastCursorBgUpdate = now;
      });
    });
  }

  setAskAiPanelOpen(false);
  renderAskAiMessages();
  syncThemeToggleUi();
}

bindEvents();
loadData();
