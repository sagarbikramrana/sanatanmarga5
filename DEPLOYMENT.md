# SanatanMarga Production Deployment Runbook

This document outlines the end-to-end production deployment architecture and step-by-step release procedures for **SanatanMarga** (`pod-studio-saas`).

---

## 1. Architecture Overview

SanatanMarga uses a hardened, split-tier production architecture:
- **Frontend**: Static SPA built with React 18 + Vite, deployed globally via **Firebase Hosting**.
- **Backend**: Express.js server compiled into `dist/server.cjs`, deployed serverlessly via **Google Cloud Run**.
- **Database**: Existing secure cloud instance (**Firebase Firestore**, DB ID: `ai-studio-remixsanatanmedi-ad7ef9ae-98e8-4af7-855d-f0a1340fc944`).
- **Authentication**: Firebase Authentication (`auth/ProtectedRoute`).
- **Media Storage**: Cloudflare R2 object storage for audio/media assets (`sanatanos-assets`).
- **Resilience**: Client-side IndexedDB caching + **SnapshotOS** for zero-downtime offline operational continuity.

---

## 2. Environment Variables & Secret Management

Never hardcode secrets in source code. Classify environment variables securely:

### A. Browser-Safe Vite Variables (`.env`)
Exposed to the client bundle (prefixed with `VITE_`):
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_VAPID_KEY`

### B. Server-Only Secrets (Cloud Run Secrets / Environment)
Never bundled into Vite:
- `GEMINI_API_KEY` (Primary AI generation & editorial assist)
- `EMAIL_USER` / `EMAIL_PASS` (SMTP notifications)
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_WHATSAPP_NUMBER` (WhatsApp alerts)
- `CLOUDFLARE_R2_ACCOUNT_ID` / `CLOUDFLARE_R2_ACCESS_KEY_ID` / `CLOUDFLARE_R2_SECRET_ACCESS_KEY` / `CLOUDFLARE_R2_BUCKET`
- `FIREBASE_SERVICE_ACCOUNT` (JSON stringified service account credentials)

---

## 3. Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set up local `.env` based on `.env.example`.
3. Start the development server:
   ```bash
   npm run dev
   ```

---

## 4. Production Build Verification

Verify that both frontend and backend compilation succeed without errors:
```bash
npm run build
```
This produces:
- `dist/` (Static frontend assets & PWA service worker)
- `dist/server.cjs` (Bundled Express backend with sourcemaps)

Test local server startup:
```bash
npm start
```

---

## 5. Firebase Hosting Deployment (Frontend)

Deploy only the frontend static assets to Firebase Hosting while protecting Firestore rules:
```bash
firebase use pod-studio-saas
firebase deploy --only hosting
```
*Note: SPA rewrites configured in `firebase.json` ensure all deep links (`/category/*`, `/article/*`, `/nepal-hub`, `/listen`, `/admin/revenue-os`) resolve correctly through `/index.html`.*

---

## 6. Google Cloud Run Deployment (Backend API)

Deploy the Express backend from source to Cloud Run:
```bash
gcloud run deploy sanatanmarga-api \
  --source . \
  --platform managed \
  --region asia-east1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production
```
Configure backend runtime secrets securely using Google Cloud Secret Manager or Cloud Run environment variables.

---

## 7. Render Deployment via GitHub (onrender.com)

Render allows you to deploy full-stack applications directly from a GitHub repository in a single click using the blueprint specification (`render.yaml`).

### Step-by-Step GitHub Setup
1. **Export/Push to GitHub**:
   - In AI Studio, export the project to your GitHub repository using the Settings menu or download the ZIP archive.
   - If using the ZIP archive, create a new GitHub repository, initialize it, and push your codebase:
     ```bash
     git init
     git add .
     git commit -m "Initial commit for Sanatan Marga"
     git branch -M main
     git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
     git push -u origin main
     ```

### Step-by-Step Render Setup
1. **Create Web Service**:
   - Log in to your [Render Dashboard](https://dashboard.render.com).
   - Click **New +** and select **Blueprint**. (Alternatively, select **Web Service** and connect your GitHub repo directly).
   - Connect your GitHub repository to Render.
2. **Apply Blueprint (`render.yaml`)**:
   - If using **Blueprint**, Render automatically reads the `render.yaml` configuration at your root.
   - Confirm the service name (`sanatan-marga-platform`), environment (`Node`), Build Command (`npm install && npm run build`), and Start Command (`npm run start`).
3. **Configure Environment Variables**:
   In the Render dashboard, populate the secrets that Render cannot guess:
   - `GEMINI_API_KEY`: Your Google AI Studio Gemini API Key.
   - `APP_URL`: The custom domain or Render default subdomain (e.g., `https://sanatan-marga-platform.onrender.com`).
   - `FIREBASE_SERVICE_ACCOUNT`: *(Optional)* The JSON string of your Firebase Service Account for administrative push messaging.
   - `EMAIL_USER` / `EMAIL_PASS`: *(Optional)* SMTP credentials for sending contact forms or alerts.
   - `CLOUDFLARE_R2_ACCESS_KEY_ID` / `CLOUDFLARE_R2_SECRET_ACCESS_KEY` / `CLOUDFLARE_R2_BUCKET`: *(Optional)* For streaming large civilizational audio records.

### Manual Configuration Option
If you prefer not to use the Blueprint, configure a standard **Web Service** manually:
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm run start`
- **Port**: `10000` (Render's internal router binds dynamically to standard PORT env)

---

## 8. PWA & MediaOS Considerations

- **PWA Service Worker**: Caches app shell assets and offline snapshots via Workbox. Admin routes and authenticated API responses are configured to bypass aggressive static caching.
- **SanatanMarga Listen (MediaOS)**: Persistent audio player using IndexedDB queue persistence. Large audio assets are streamed from Cloudflare R2 object storage, avoiding browser memory bloat or Firestore storage limits.

---

## 8. RevenueOS Compliance

RevenueOS operates strictly within the 5 approved non-intrusive ad placements:
1. Header Banner
2. Homepage Mid
3. Sidebar
4. Article Inline
5. Article Bottom
*Left/right skins and pop-up takeovers remain permanently disabled.*

---

## 9. Health-Check & Rollback Procedures

- **Health Check Endpoint**: `/api/health` returns status code `200` with system telemetry.
- **Rollback**:
  - Frontend: `firebase hosting:version` rollback via Firebase Console.
  - Backend: Revert to previous Cloud Run revision via `gcloud run services update-traffic`.

