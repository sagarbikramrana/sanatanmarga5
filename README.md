# SanatanMarga (सनातन मार्ग) — Multi-Tenant Media Engine v4.2.8

SanatanMarga is an enterprise-grade, high-performance news, media, and digital publishing platform built for scale, resilience, and offline-first availability. Powered by React 19, Vite, Express, Snapshot OS, ListenOS (R2 TTS Caching), and Firebase Firestore.

## 🚀 Key Features

- **Snapshot OS**: Atomic, static JSON module publishing for zero-read client distribution and lightning-fast page loads.
- **ListenOS R2 Audio Cache v2**: Deterministic SHA-256 TTS generation powered by Gemini AI, stored immutably on Cloudflare R2 CDN for zero-Firestore audio playback.
- **Multi-Tenant Isolation**: Built-in support for multi-tenant publication and role-based access control (RBAC).
- **Offline-First Resilience**: Service worker dynamic caching and local queue synchronization.
- **Editorial OS & AI Assist**: Comprehensive admin dashboard for news, blogs, events, community posts, and media management.

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Vite
- **Backend Server**: Node.js, Express, TypeScript (`server.ts`)
- **Database & Auth**: Firebase Firestore, Firebase Authentication, Firebase Admin SDK
- **Storage & CDN**: Cloudflare R2 (S3 API), Local Disk Fallback
- **AI Synthesis**: Google Gemini 3.8 Flash & TTS (`@google/genai`)

## 🚦 Getting Started

### Prerequisites

- Node.js 18+ and `npm`

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd sanatanmarga
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Environment Variables:
   Copy `.env.example` to `.env` and configure your credentials:
   ```bash
   cp .env.example .env
   ```

4. Start Development Server:
   ```bash
   npm run dev
   ```

5. Build for Production:
   ```bash
   npm run build
   npm start
   ```

## 📄 License

All rights reserved © SanatanMarga.
