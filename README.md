# Final Project Submission: AI Productivity & AI API Integration for Developers

## Overview
Project ini adalah **dashboard monitoring digitalisasi** (admin-style) yang menampilkan KPI, chart, dan table dari data Google Spreadsheet, lalu menambahkan fitur **AI Chatbot (Ask AI)** untuk tanya jawab berbasis data dashboard menggunakan **Gemini API**.

Target pembelajaran:
- Integrasi AI API secara aman (API key tidak ada di frontend).
- Membuat backend ringan untuk proxy data + prompt orchestration.
- Membangun UI chat yang usable (timestamp, enter-to-send, styling ringan).

## Live (Vercel)
- Dashboard: `https://digital-lppan.vercel.app`
- Health: `https://digital-lppan.vercel.app/api/health`

## Fitur Utama
### 1) Dashboard Monitoring (Frontend)
- KPI ringkas (Total Apps, Active, Need Enhancement, Data Completeness)
- Chart: distribusi kategori, criticality, maturity, status, data owner, implementation year
- Tabel monitoring + filter + pagination
- Data quality: menandai data mandatory lengkap vs incomplete

### 2) Ask AI Chatbot (Gemini)
- Chatbot di dalam dashboard (floating widget)
- Pertanyaan user dijawab **hanya berdasarkan dataset dashboard** (anti-halu)
- Mendukung formatting ringan dari output AI:
  - `**bold**`
  - bullet list `- item`
  - inline code `` `text` ``
- Timestamp per message
- Enter untuk kirim, Shift+Enter untuk baris baru

Catatan:
- Toggle Dark Mode ada sebagai placeholder tapi sementara **dikunci** untuk rilis (tidak bisa di-toggle).

## Arsitektur Singkat
1. Frontend memuat data dari backend: `GET /api/data`
2. Frontend mengirim pertanyaan ke backend: `POST /api/ask`
3. Backend:
   - fetch & normalize data spreadsheet dari `SHEET_CSV_URL`
   - apply filter scope (quick filter + category + search)
   - call Gemini (`@google/genai`) dengan guardrail data-only
4. Backend mengembalikan jawaban ke UI chat

```
Browser (public/*)
  -> GET /api/data  -> fetch CSV spreadsheet -> normalize -> rows
  -> POST /api/ask  -> fetch CSV -> scope -> prompt -> Gemini -> answer
```

## Tech Stack
- Frontend: HTML + Vanilla JS + Tailwind CDN + Chart.js
- Backend: Node.js + Express
- AI SDK: `@google/genai`
- Hosting: Vercel (static + serverless API routes)
- Data source: Google Spreadsheet (CSV export)

## Struktur Folder
- `public/` UI dashboard (HTML/CSS/JS)
- `api/` API routes untuk Vercel (`/api/data`, `/api/ask`)
- `api/_lib/` helper parsing & Ask AI service
- `server.js` local dev server (Express)
- `vercel.json` routing + caching header

## Setup Lokal
1. Install:
```bash
npm install
```

2. Buat `.env` (jangan di-commit) dan isi:
```env
GEMINI_API_KEY=...
SHEET_CSV_URL=...
GEMINI_MODEL=gemini-2.5-flash
PORT=3000
```

3. Run:
```bash
npm run dev
```

4. Open:
- Dashboard: `http://localhost:3000`
- Health: `http://localhost:3000/api/health`

## Deploy ke Vercel
1. Push repo ke GitHub.
2. Import project di Vercel.
3. Set Environment Variables:
   - `GEMINI_API_KEY`
   - `SHEET_CSV_URL`
   - `GEMINI_MODEL` (opsional)
4. Redeploy.

## Keamanan (Credential Safety)
- API key Gemini disimpan di **Vercel Environment Variables** dan `.env` lokal.
- `.env` sudah di-ignore (`.gitignore`) agar tidak ikut ter-push.
- Frontend hanya call endpoint internal `/api/*` (tidak ada API key di browser).

## Limitation
- Free tier Gemini punya limit request harian/menit. Saat habis bisa muncul error 429 (quota).
- Spreadsheet harus bisa diakses publik (Viewer / Publish to web) agar backend bisa fetch CSV.
