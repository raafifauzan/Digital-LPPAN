# Monitoring Dashboard (Vercel Ready)

Dashboard interaktif bergaya admin panel (inspirasi TailAdmin table) yang membaca data langsung dari Google Spreadsheet tanpa API backend.

## File utama

- `index.html` UI dashboard
- `main.css` style custom (tanpa Tailwind)
- `app.js` logika fetch + transform data + chart
- `vercel.json` konfigurasi deploy Vercel

## Struktur Dashboard

- Page 1: `Digital Portfolio Overview (Data Exposure)`
- Page 2: `Digitalization Monitoring & Control`

## Fitur interaktif

- Page switching: Overview vs Monitoring & Control
- KPI + distribusi data dengan eksposur `Unknown` eksplisit
- Digitalization score (0-100), klasifikasi Mature/Developing/At Risk
- Monitoring action table dengan filter: `High criticality only`, `At risk only`, `Incomplete data only`
- Data quality monitoring (mandatory completeness + missing/inconsistent list)

## Konfigurasi spreadsheet

Edit di `app.js`:

```js
const SHEET_CONFIG = {
  csvUrl: "YOUR_GOOGLE_SHEET_CSV_EXPORT_URL"
};
```

## Syarat akses Google Sheet

Sheet harus bisa diakses publik, minimal:

1. Buka Google Sheets.
2. Klik **Share**.
3. Ubah akses ke **Anyone with the link** (Viewer), atau gunakan **Publish to web**.

Kalau tidak publik, browser akan gagal ambil CSV dari Google Sheets.

## Local preview (opsional)

Bisa langsung pakai server statis sederhana:

```bash
npx serve .
```

Lalu buka `http://localhost:3000`.

## Deploy ke Vercel

1. Push folder ini ke GitHub/GitLab/Bitbucket.
2. Import project ke Vercel.
3. Deploy tanpa setting tambahan.

Selesai, dashboard otomatis memuat data dari Google Sheet.
