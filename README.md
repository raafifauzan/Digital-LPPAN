# Monitoring Dashboard (Vercel Ready)

Dashboard interaktif bergaya admin panel (inspirasi TailAdmin table) dengan backend Express untuk API data dan Ask AI.

## File utama

- `public/index.html` UI dashboard
- `public/main.css` style custom (tanpa Tailwind)
- `public/app.js` logika fetch + transform data + chart
- `public/favicon.svg` favicon dashboard
- `vercel.json` konfigurasi deploy Vercel
- `api/ask.js` endpoint Ask AI (Express serverless)
- `api/data.js` endpoint data dashboard (backend proxy ke spreadsheet)
- `api/_lib/sheet.js` parser + normalisasi data spreadsheet untuk backend AI
- `api/_lib/ask-service.js` service prompt + call Gemini
- `server.js` entrypoint local Express

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

Set URL spreadsheet lewat environment variable backend:

```env
SHEET_CSV_URL=YOUR_GOOGLE_SHEET_CSV_EXPORT_URL
```

## Syarat akses Google Sheet

Sheet harus bisa diakses publik, minimal:

1. Buka Google Sheets.
2. Klik **Share**.
3. Ubah akses ke **Anyone with the link** (Viewer), atau gunakan **Publish to web**.

Kalau tidak publik, browser akan gagal ambil CSV dari Google Sheets.

## Local preview

Project ini butuh backend API (`/api/data`, `/api/ask`), jadi jalankan dengan Express:

```bash
npm install
npm run dev
```

Lalu buka `http://localhost:3000`.

## Ask AI setup (baru)

Project ini sekarang punya endpoint:
- `GET /api/data` untuk data dashboard
- `POST /api/ask` untuk tanya data dashboard via Gemini

1. Install dependency:

```bash
npm install
```

2. Buat `.env` dari `.env.example`, lalu isi:

```env
GEMINI_API_KEY=...
SHEET_CSV_URL=...
GEMINI_MODEL=gemini-2.5-flash
PORT=3000
```

3. Jalankan local server (Express):

```bash
npm run dev
```

4. Test cepat:

```bash
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"Aplikasi high critical apa saja?","scope":{"quickFilter":"all","analyticsView":"all","search":""}}'
```

Response sukses:

```json
{
  "ok": true,
  "answer": "...",
  "evidence": ["...", "..."],
  "meta": {
    "model": "gemini-2.5-flash",
    "rowsUsed": 12,
    "totalRows": 30
  }
}
```

## Deploy ke Vercel

1. Push folder ini ke GitHub/GitLab/Bitbucket.
2. Import project ke Vercel.
3. Set Environment Variables di Vercel Project:
   - `GEMINI_API_KEY`
   - `SHEET_CSV_URL`
   - `GEMINI_MODEL` (opsional, default `gemini-2.5-flash`)
4. Deploy.

Catatan:
- Routing production sudah diatur lewat `vercel.json`:
  - `/` -> `public/index.html`
  - `/api/*` -> serverless functions di `api/*`
  - static asset -> `public/*`
