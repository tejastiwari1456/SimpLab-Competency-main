# Deploying SimLab Competency Hub to Vercel

This project is pre-configured for full-stack deployment on **Vercel**:
- **Frontend (Vite + React SPA)**: Built into `dist/` via `npm run build:vercel` with SPA rewrites in `vercel.json`.
- **Backend API (Express)**: Deployed as a Vercel Serverless Function at `api/index.ts` (handling all `/api/*` routes with a 30-second timeout for Gemini AI Viva, AI Mentor, and AI Faculty Insights).
- **Database (PostgreSQL)**: `src/db/index.ts` automatically supports both standard Vercel/managed PostgreSQL (`DATABASE_URL` / `POSTGRES_URL`) and Google Cloud SQL (`SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME`) with serverless connection pooling and SSL auto-detection.

---

## 1. Sharing Your Exact Accounts & Data on Vercel

Inside AI Studio, the app connects to Cloud SQL over a local Unix socket (`SQL_HOST=/cloudsql/...`), which is private to Google Cloud. To ensure that **every login, student enrollment, assignment, submission, AI viva report, and competency score** here works identically on Vercel, choose one of the two options below:

### Option A — Connect Vercel Directly to the Same Cloud SQL Database (Live Sync)
Both AI Studio and Vercel share the exact same live PostgreSQL database in real time:
1. In **Google Cloud Console → SQL → Your Instance → Connections**:
   - Enable **Public IP** and require **SSL**.
   - Add an authorized network (or configure a Cloud SQL proxy / static egress).
2. In **Vercel Project Settings → Environment Variables**, set either:
   - `DATABASE_URL=postgresql://<SQL_USER>:<SQL_PASSWORD>@<PUBLIC_IP>:5432/<SQL_DB_NAME>?sslmode=require`
   - **OR** discrete variables: `SQL_HOST=<PUBLIC_IP>`, `SQL_PORT=5432`, `SQL_DB_NAME=<db>`, `SQL_USER=<user>`, `SQL_PASSWORD=<password>`, `SQL_SSL=true`.

### Option B — Migrate Your Current Data to Neon / Supabase / Vercel Postgres
If you prefer a Vercel-native managed PostgreSQL database (e.g., Neon or Supabase from the Vercel Marketplace):
1. Create a PostgreSQL database and copy its `DATABASE_URL`.
2. Export your current SimLab data from this environment (writes to gitignored `.local-backup/simlab-snapshot.json` — **never commit this file**):
   ```bash
   npm run db:export
   ```
3. Apply the full schema migrations (`001`–`006`) and import your exact accounts and records into your Vercel database:
   ```bash
   DATABASE_URL="postgresql://..." npm run db:migrate
   DATABASE_URL="postgresql://..." npm run db:import
   ```
   *(Or, to initialize a fresh database with default demo accounts & classes only, run `DATABASE_URL="postgresql://..." npm run db:setup`.)*

---

## 2. Required Vercel Environment Variables

In **Vercel Dashboard → Your Project → Settings → Environment Variables** (for Production, Preview, and Development):

| Variable | Required | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` *(or `SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME`, `SQL_SSL=true`)* | **Yes** | PostgreSQL connection for all accounts, classes, enrollments, submissions, and analytics. |
| `JWT_SECRET` | **Yes** | Random 32+ character hex secret (e.g. `openssl rand -hex 32`). **Required** so signed-in sessions remain valid across serverless cold starts. |
| `GEMINI_API_KEY` | **Yes** | Server-side Gemini API key powering AI Viva Voce, AI Lab Mentor, and AI Faculty Insights. |
| `JWT_ACCESS_EXPIRES_IN` | Optional | Access token lifetime (default: `2h`). |
| `DATABASE_SSL` | Optional | Defaults to `true` automatically on Vercel for remote Postgres hosts. |
| `FIREBASE_PROJECT_ID` | Optional | Overrides project ID from `firebase-applet-config.json` for Google Sign-In verification. |

> **Google Sign-In note**: If using Firebase Google Sign-In on Vercel, add your `*.vercel.app` (and custom) domain under **Firebase Console → Authentication → Settings → Authorized domains**.

---

## 3. Deploy & Verify

1. Push the repository to GitHub/GitLab/Bitbucket and import it in Vercel (or run `npx vercel --prod`).
2. After deployment completes, open:
   ```
   https://<your-app>.vercel.app/api/health?db=1
   ```
   Confirm the response shows:
   - `"status": "ok"`
   - `"runtime": "vercel-serverless"`
   - `"jwtSecretConfigured": true`
   - `"geminiConfigured": true`
   - `"database": { "configured": true, "connected": true }`
3. Sign in at `https://<your-app>.vercel.app/login` using your existing Student, Teacher, or Admin credentials — your classes, enrollments, assignments, submissions, and competency dashboards will load directly from PostgreSQL.

> **Note on Pair Lab WebSockets**: Pair Lab REST endpoints (`/api/pair-lab/*`) are active on Vercel. Because Vercel Serverless Functions do not maintain long-lived raw WebSocket connections (`/ws/pair-lab`), multi-user live socket sync requires a persistent Node.js host (`npm run build && npm run start`).
