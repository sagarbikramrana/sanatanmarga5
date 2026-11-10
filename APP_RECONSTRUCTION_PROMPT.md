# Saatan Marga v3.0 - Reconstruction & Technical Architecture Specification

This document provides a highly comprehensive, detailed blueprint of the **Prithvi Path Media v3.0** application. It serves as both technical documentation for future reference/changes and a complete reconstruction master prompt to build the entire app again from scratch.

---

## Part 1: Architecture & Technical Stack

**Sanatan Marga Media v3.0** is a full-stack, highly optimized Nepali news portal and media platform. It includes real-time updates, offline-first capabilities, PWA support, a talent directory ("Glamour Hub"), and a community forum ("Chautari").

### 1. Technology Choices
- **Frontend Framework**: React 19, Vite, TypeScript, `react-router-dom` (v7) for SPA routing.
- **Styling**: Tailwind CSS (v4) with customized theme definitions for high-contrast light and obsidian dark interfaces, fluid layout bounds (`w-full max-w-7xl mx-auto`), and custom spacing.
- **Animations**: `motion` (imported from `motion/react`) for fluid entry animations, interactive hover dynamics, and seamless slider choreography.
- **Database & Auth**: Google Firebase (Firestore and Firebase Authentication).
- **Backend Runtime**: Node.js (v20+) with Express, TypeScript runner `tsx`, Firebase Admin SDK (for administrative endpoints and multicast FCM notifications), and standard integrations.
- **Libraries**:
  - `lucide-react`: SVG icon library.
  - `sonner`: Toast messages for notifications and offline sync status.
  - `nodemailer`: Automatic administrative email routing for contact form inquiries.
  - `cheerio` & `axios`: Scraping engine for Nepalese gold/silver markets with multi-layered cache fallbacks.
  - `react-quill-new`: Advanced Rich Text Editor for journalists.
  - `recharts`: Dynamic admin and editor analytics dashboards.

---

## Part 2: Core Functional Modules & Implementation Details

### 1. Progressive Web App (PWA) & Offline-First Core
The app is fully offline-capable, configured via `vite-plugin-pwa` within `vite.config.ts`.
- **Caching Strategy**: Custom Workbox runtime-caching rules:
  - Static resources (JS, CSS, HTML, local images) are stored locally.
  - External assets (e.g., Unsplash thumbnails, Google Web Fonts) use a `CacheFirst` strategy with explicit limits (e.g., maximum 50-100 items, 15-30 days expiration).
  - Firestore assets/photos use a `StaleWhileRevalidate` strategy.
- **Offline Queue System (`/src/lib/offlineQueue.ts`)**:
  - Exposes wrappers: `addDocWithQueue`, `updateDocWithQueue`, `setDocWithQueue`, and `deleteDocWithQueue`.
  - When the app detects standard `navigator.onLine === false` or catches network/database errors (such as Firebase's `unavailable` or `resource-exhausted` errors), the operation is enqueued in the browser's `localStorage` (`offline_sync_queue`).
  - To handle serialization properly, complex object types (e.g., Firestore's `serverTimestamp` fields) are sanitized into strings/placeholders prior to storage.
  - When a connection is restored, a background synchronization loop (`sync()`) processes the enqueued items sequentially (retrying up to 3 times in case of transient errors) and fires success toasts using `sonner`.
- **Offline Banner (`/src/components/ui/OfflineBanner.tsx`)**:
  - A bottom-aligned floating banner that renders the offline status, number of pending sync events, and alerts users of quota limits with sleek, responsive animations.

### 2. Nepal/Nepali Localization & Typography Guardrails
To support vertical accents of the Devanagari script (hraswa, dhirgha, ikar, and ukar), the app uses custom styling utilities to ensure no part of the Nepali letters is clipped.
- **Nepali Text class (`.nepali-text`)**: Defines a helper utility:
  ```css
  .nepali-text {
    @apply pt-1 leading-normal;
  }
  ```
  This is applied to text fields where hraswa/dhirgha ikars and ukars appear, providing padding to accommodate accents.
- **Transliteration Utility (`/src/lib/nepaliTransliteration.ts`)**: Real-time Latin-to-Devanagari text transliteration helper allowing writers and users to type phonetically (e.g., "nepal" converts to "नेपाल") without requiring dedicated Devanagari keyboards. Included in `NepaliInput` fields.

### 3. Editorial Engine & Admin Dashboard
Multi-user editorial workflows with detailed administrative controls:
- **Role-Based Routing**: Defines `UserRole = "admin" | "editor" | "user"`.
- **Menu Builder (`AdminMenu.tsx`)**: Drag-and-drop category order editor using `@hello-pangea/dnd` or `@dnd-kit/sortable` to modify header/footer menu structures.
- **Ad Rotator Slider (`AdminAds.tsx` / `AdSlider.tsx`)**: Controls visual banners in pre-defined slots (`header`, `sidebar`, `homepage_mid`, `article_bottom`, `article_inline`) with scheduling options and activation toggles.
- **Rich-Text Composer (`AdminEditor.tsx`)**: Includes custom inputs, transliteration fields, breaking news indicators, excerpt generators, and direct image uploader components.
- **Analytics Display**: Leverages `recharts` to render real-time portal statistics (traffic counts, category popularities, user signup frequencies) for admins and editors.

### 4. Glamour Talent Hub (Modeling Directory)
A specialized casting and directory directory:
- **Profiles**: Model and Photographer profiles sorted by categories (Fashion, Commercial, Actor, Influencer, Kids, Photographer), attributes (height, weight, age, languages, locations), and verification badges.
- **Interactive Portfolio Gallery**: Implements user engagement counters:
  - Users can react to portfolio images (reactions: like, heart, wow, clap) and leave feedback.
  - Seamless tracking inside sub-collections (`galleryReactions`, `galleryComments`).
- **Booking / Inquiries System**: Integrated form allowing brands, directors, or producers to issue project inquiries (Photoshoots, Music Videos, Movies, Advertisements) directly to associated booking agents.

### 5. "Chautari" Community Forums
An engaging community center:
- **Posting**: Registered users can create posts with categories, hashtags, and links to relevant news pieces.
- **Reactions & Moderation**: Integrated upvote/downvote scores, recursive comments/replies, and administrative flags for reporting objectionable content.

### 6. Backend Integration & Automated Services (`server.ts`)
A custom Express server handles backend utilities safely behind-the-scenes, keeping all API keys secure:
- **Scraping Engine (`/api/market-data`)**: Fetches Nepalese gold/silver markets directly from FENEGOSIDA, parsing the website using `cheerio`. Implements a 24-hour JSON cache on disk/memory to mitigate frequent requests, and falls back to server-side static values if scraping fails.
- **Broadcast System (`/api/broadcast` and `/api/notifications/send-role-based`)**: Sends multicast FCM push notifications via Firebase Admin SDK to registered browser service workers and populates standard user bells.
- **Administrative API Actions**: Includes methods to create/update platform user records safely bypassing Firestore client permissions.
- **SEO Sitemaps**: Dynamic XML generation for both standard `/sitemap.xml` and Google News `/sitemap-news.xml` protocols.
- **Nodemailer Contact Relay**: Forwards portal contact inquiries directly to administrator emails.

---

## Part 3: Directory & File Map

```
/
├── .env.example                # Example environment variable declarations
├── COMPONENTS_GUIDE.md         # Fast file lookup map for developers
├── DEPLOYMENT.md               # Standard deployment guidelines
├── firebase-blueprint.json     # Firestore schemas & structural specifications
├── firestore.rules             # Secure rules governing database paths
├── index.html                  # Core HTML file
├── metadata.json               # App name and permissions settings
├── package.json                # Project dependencies and operational scripts
├── server.ts                   # Custom full-stack Express server
├── tsconfig.json               # TypeScript compiler options
├── vite.config.ts              # Vite configurations including VitePWA
│
└── src/
    ├── App.tsx                 # Core application layout and router setup
    ├── index.css               # Main Tailwind v4 file with .nepali-text rules
    ├── main.tsx                # Entry-point renderer
    │
    ├── components/             # Reusable Interface Modules
    │   ├── ErrorBoundary.tsx   # React fallback bounds
    │   ├── StyleProvider.tsx   # Context wrapper for theme configurations
    │   │
    │   ├── admin/              # Admin components (AIGeneratorModal, etc.)
    │   ├── ads/                # Ad components (AdSlider, etc.)
    │   ├── auth/               # Signup/login widgets
    │   ├── community/          # Forums components (CreatePostModal, etc.)
    │   ├── layout/             # Structure (Header, Footer, Sidebar, etc.)
    │   ├── news/               # Rendering widgets for articles
    │   ├── notifications/      # NotificationBell components
    │   └── ui/                 # Reusable building blocks (NepaliInput, OfflineBanner)
    │
    ├── constants/              # Fixed values (e.g., backupData.ts)
    ├── hooks/                  # React Hooks (usePushNotifications, etc.)
    │
    ├── lib/                    # Library Initializations
    │   ├── auth.tsx            # Firebase Auth context provider
    │   ├── errorHandling.ts    # Centralized Firestore error mapper
    │   ├── firebase.ts         # Standard Firebase init with cache configurations
    │   ├── nepalData.ts        # Districts and local geometries
    │   ├── nepaliTransliteration.ts # Latin-to-Devanagari mapping mechanics
    │   ├── notifications.ts    # Bell handlers
    │   └── offlineQueue.ts     # Standard Offline Queue managers
    │
    ├── pages/                  # Standard Views & Route Handlers
    ├── services/               # Dynamic XML and content processors
    ├── types/
    │   └── index.ts            # Global TypeScript Interfaces
    └── utils/                  # Utility scripts (formatting, sharing, etc.)
```

---

## Part 4: Database Schemas (Firestore)

Based on the Firestore specifications, here are the schema expectations for standard records:

### 1. `users` (Collection)
- **Document ID**: `uid` (Firebase Authentication string)
- **Schema**:
  ```json
  {
    "uid": "string",
    "email": "string",
    "displayName": "string",
    "role": "admin | editor | user",
    "photoURL": "string (optional)",
    "bio": "string (optional)",
    "location": "string (optional)",
    "website": "string (optional)",
    "facebook": "string (optional)",
    "twitter": "string (optional)",
    "instagram": "string (optional)",
    "fcmTokens": ["string"],
    "createdAt": "date-time"
  }
  ```
- **Sub-Collection**: `bookmarks`
  - **Document ID**: `articleId`
  - **Schema**:
    ```json
    {
      "articleId": "string",
      "title": "string",
      "thumbnail": "string (optional)",
      "createdAt": "date-time"
    }
    ```

### 2. `articles` (Collection)
- **Schema**:
  ```json
  {
    "title": "string",
    "content": "string",
    "excerpt": "string",
    "categoryId": "string",
    "authorId": "string",
    "authorName": "string",
    "status": "draft | published",
    "featuredImage": "string",
    "videoUrl": "string (optional)",
    "views": "integer",
    "isBreaking": "boolean",
    "isFeatured": "boolean",
    "districts": ["string"],
    "createdAt": "date-time",
    "updatedAt": "date-time"
  }
  ```

### 3. `categories` (Collection)
- **Schema**:
  ```json
  {
    "nameNepali": "string",
    "nameEnglish": "string",
    "slug": "string",
    "order": "integer",
    "homepageStyle": "grid | featured_list | cards | alternating | magazine | masonry | overlay"
  }
  ```

### 4. `communityPosts` (Collection)
- **Schema**:
  ```json
  {
    "title": "string",
    "content": "string",
    "authorId": "string",
    "authorName": "string",
    "upvotes": "integer",
    "downvotes": "integer",
    "commentCount": "integer",
    "status": "active | removed | flagged",
    "createdAt": "date-time"
  }
  ```

### 5. `models` (Collection)
- **Schema**:
  ```json
  {
    "name": "string",
    "profileImage": "string",
    "coverImages": ["string"],
    "category": "Fashion | Commercial | Actor | Influencer | Kids | Photographer",
    "gender": "Male | Female | Other",
    "location": "string",
    "isVerified": "boolean",
    "isFeatured": "boolean",
    "createdAt": "date-time"
  }
  ```

---

## Part 5: Complete Reconstruction Master Prompt

Copy and paste the prompt below into an AI coder agent to reconstruct this exact platform from scratch in any clean directory.

```text
Please build a premium, full-stack, offline-first Nepali News Portal and Media platform named "Prithvi Path Media v3.0". 
Use React 19, Vite, Tailwind CSS v4, TypeScript, and Google Firebase (Firestore & Authentication) for the client. 
Build a Node.js/Express backend running on port 3000 to manage secure administrative and API workflows.

Ensure the final application contains the following core components and behaviors:

1. OFFLINE-FIRST ENGINE (PWA):
   - Configure 'vite-plugin-pwa' in 'vite.config.ts' with proper offline caching rules (Unsplash/storage assets using StaleWhileRevalidate, fonts/local assets using CacheFirst).
   - Implement an Offline Sync Queue (using localStorage) in a file '/src/lib/offlineQueue.ts' that intercepts Firestore creates, edits, and deletes when standard connection is down (navigator.onLine is false) or when Firebase quota limits are caught.
   - Cleanly serialize and sanitize complex fields (such as serverTimestamp placeholders) to prevent JSON localStorage storage crashes. When connection is regained, process and synchronize the queue automatically, firing success toasts.
   - Design a highly polished floating 'OfflineBanner.tsx' that slides in gracefully when offline, tracking pending changes and alerting users.

2. NEPALESE TRANSLITERATION & TEXT ALIGNMENT:
   - Provide a phonetic transliteration parser ('/src/lib/nepaliTransliteration.ts') that maps English typing to Devanagari (e.g., 'nepal' -> 'नेपाल'). Wrap this in a reusable 'NepaliInput.tsx' component.
   - Ensure all Devanagari text uses a special CSS class '.nepali-text' (with 'pt-1 leading-normal') inside '/src/index.css' to ensure that top/bottom accents (hraswa, dhirgha, ikar, and ukar) are never cropped by layout structures.

3. ROLE-BASED EDITORIAL & SYSTEM ADMINISTRATION:
   - Separate user roles into 'admin', 'editor', and 'user'. Create client role guards.
   - Create a customizable 'AdminMenu.tsx' that supports drag-and-drop hierarchy editing of header and footer navigation paths.
   - Build a comprehensive advertisement system ('AdminAds.tsx') with multiple slots (header, sidebar, article body, inline) and automatic ad banner rotators ('AdSlider.tsx').
   - Create an 'AdminEditor.tsx' containing content authoring inputs, rich text composing elements, and breaking/featured toggles.

4. GLAMOUR TALENT HUB & BOOKING DIRECTORY:
   - Setup a 'ModelsPage.tsx' and 'ModelProfilePage.tsx' featuring professional portfolios of models and photographers.
   - Implement portfolio gallery interactions where logged-in users can react (like, heart, wow, clap) and comment.
   - Build a project inquiry workflow sending formatted casting details to linked booking agents.

5. "CHAUTARI" COMMUNITY HUB:
   - Create a social forum ('CommunityPage.tsx') where members write discussion topics, upvote/downvote posts, search hashtags, and share news items directly to the feed. Include reporting and moderation filters.

6. ROBUST BACKEND ROUTING ('server.ts'):
   - Scrape real-time Nepalese gold/silver markets from FENEGOSIDA, utilizing standard parsing ('cheerio') with an on-disk/in-memory 24-hour JSON cache to optimize API calls, fallback cleanly if scraping fails.
   - Deploy dynamic XML feeds for sitemaps (standard '/sitemap.xml' and Google News '/sitemap-news.xml').
   - Setup a server notification broadcast path ('/api/broadcast') that sends multicast push alerts via Firebase Admin SDK based on user tokens and saves them globally to Firestore notifications.
   - Implement email forwarding using 'nodemailer' to route Contact Form entries directly to admin mailboxes.

Ensure a highly polished, aesthetic, editorial design utilizing Inter for UI headings, responsive grids, and true-dark/obsidian background variations. Build exactly as specified, with zero placeholder logic or incomplete functions!
```

---
*End of technical architecture specification.*
