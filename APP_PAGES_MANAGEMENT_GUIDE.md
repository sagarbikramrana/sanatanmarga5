# Prithvi Path Media v3.0 - Application Page & Dashboard Management Guide

This document outlines every user-facing page in the **Prithvi Path Media v3.0** platform, what content it displays, and the specific administrative or editorial dashboard panels used to manage and configure them.

---

## 1. Public Content & Portal Pages

These represent the primary, user-facing pages where public readers engage with news, media, and regional updates.

### A. Homepage (`HomePage.tsx`)
*   **What it displays**: The main landing page of the portal, showcasing featured sliders, breaking news banners, categorized news grids, latest updates, gold/silver price charts, and advertisement spots.
*   **How it is managed**:
    *   **Category Order & Layout**: Configured via the **Page Builder** dashboard (`AdminPageBuilder.tsx`), where admins assign custom layout styles (e.g., masonry, magazine, grid, alternating card lists) to specific categories.
    *   **Menu Ordering**: Managed via the **Menu Builder** (`AdminMenu.tsx`), where navigation link structures are customized.
    *   **Advertisements**: Banner ads are fed dynamically by the **Ad Monetization Manager** (`AdminAds.tsx`).
    *   **Market Data**: Live gold and silver prices are automatically scraped and cached server-side (`server.ts`).

### B. Category Landing Pages (`CategoryPage.tsx`)
*   **What it displays**: All news articles published under a selected category (e.g., Politics, Business, Sports).
*   **How it is managed**:
    *   **Category Creation**: Admins add or edit categories, English/Nepali names, slugs, and order from the **Category Manager** (`AdminCategories.tsx`).
    *   **Content Feed**: Articles appear here automatically when created and tagged with this category in the **Journalist Composer** (`AdminEditor.tsx` or `AdminDashboard.tsx`).

### C. News Article Detail View (`ArticlePage.tsx`)
*   **What it displays**: The full written content of a news story, complete with headlines, responsive cover media, text accents safety protection, author bios, social sharing integrations, relative article feeds, and nested comment chains.
*   **How it is managed**:
    *   **Content & Media**: Authored and published via the **Journalist Composer** (`AdminEditor.tsx`).
    *   **Comments & Moderation**: User comments can be flagged, approved, or deleted by editors from the **Community Moderation Dashboard** (`AdminCommunity.tsx`). Editors can also pin important comments directly inside the article.
    *   **Article Ads**: Custom advertisements are dynamically injected into pre-defined body slots managed via `AdminAds.tsx`.

### D. District-Specific News (`DistrictPage.tsx`)
*   **What it displays**: Geotagged news articles filtered by any of the 77 Nepalese districts, allowing local readers to access relevant regional updates.
*   **How it is managed**:
    *   **Geotagging**: Managed during the article drafting stage in the **Journalist Composer** (`AdminEditor.tsx`), where writers select one or more Nepalese districts from a validated multi-select dropdown.

### E. Latest & Trending News Stream (`LatestNewsPage.tsx`, `TrendingPage.tsx`)
*   **What it displays**: Fast-scrolling, high-density streams showcasing newly published updates and highly engaging stories sorted automatically by viewer traffic metrics.
*   **How it is managed**:
    *   **Trending Algorithm**: Automatically compiled using a background score calculation model that sorts articles based on views, comment count, and creation age (`server.ts`).

---

## 2. Interactive Community Modules

These pages host the interactive forums and live chat systems that drive subscriber engagement.

### A. "Chautari" Forums & Posts (`CommunityPage.tsx`, `CommunityPostPage.tsx`)
*   **What it displays**: The central community board where registered members publish discussion topics, search custom hashtags, upvote/downvote content, share news links, and reply to comments.
*   **How it is managed**:
    *   **Community Moderation Dashboard** (`AdminCommunity.tsx`): Administrators and editors can monitor flagged threads, filter reports, remove offensive content, or toggle status values (Active, Flagged, Removed) in real-time.

### B. Live Chat & Broadcast Board (`LivePage.tsx`)
*   **What it displays**: Interactive, real-time comment threads designed for live events, election updates, or breaking news broadcasts.
*   **How it is managed**:
    *   **Direct Moderation**: Admins can pin important updates or delete disruptive chats directly inside the live thread.

---

## 3. Glamour Talent Hub

A dedicated niche within the platform designed to showcase local and professional modeling portfolios and photographer directories.

### A. Glamour Directory & Bios (`ModelsPage.tsx`, `ModelProfilePage.tsx`)
*   **What it displays**: Grid listings of verified models, photographers, and actors, filtered by gender, category, and location, leading to detail views hosting high-res portfolios, physical attributes, social icons, and user reactions (likes, hearts, wow, claps).
*   **How it is managed**:
    *   **Glamour Hub Manager** (`AdminModels.tsx`): Admins create profiles, input physical credentials, upload cover gallery folders, toggle verification badges, and promote featured models to the front directory page.

---

## 4. Operational & Informational Pages

Administrative, organizational, and informational pages.

### A. Contact Portal (`ContactPage.tsx`)
*   **What it displays**: Contact numbers, map links, and an inquiry form allowing users to submit messages.
*   **How it is managed**:
    *   **Inquiries Dashboard** (`AdminContactMessages.tsx`): Admins read submitted messages, track statuses (New, Replied, Resolved), or purge old logs.
    *   **Email Forwarding Relay**: The backend server (`server.ts`) intercepts contact submissions and uses `nodemailer` to safely forward them directly to admin mailboxes.

### B. Events Portal (`EventsPage.tsx`, `EventPostPage.tsx`)
*   **What it displays**: A local calendar tracking community events, press releases, modeling castings, and portal activities.
*   **How it is managed**:
    *   **Event Editor Panel** (`AdminEventEditor.tsx` & `AdminEvents.tsx`): Allows admins to compose event summaries, details, maps, and schedules.

---

## 5. Summary Matrix: What Dashboard Controls What?

Use this quick lookup map to see how each user-facing page is managed:

| User-Facing Page | Admin / Editor Dashboard File | Managed Feature / Database Collection |
| :--- | :--- | :--- |
| **Homepage** | `AdminPageBuilder.tsx` & `AdminMenu.tsx` | Category display styles (`settings/homepage_layout`), Header/Footer menu order (`menuItems`). |
| **Homepage / Sidebar** | `AdminAds.tsx` | Ad placement schedules and URLs (`ads`). |
| **Category Landing** | `AdminCategories.tsx` | Category metadata, Devanagari names, slugs (`categories`). |
| **Article Detail Page** | `AdminEditor.tsx` | Journalist articles, breaking status, cover media (`articles`). |
| **Chautari Forums** | `AdminCommunity.tsx` | Post moderation, flags, upvote control (`communityPosts`). |
| **Glamour Hub** | `AdminModels.tsx` | Talent portfolios, photos, heights, verification (`models`). |
| **Contact Us** | `AdminContactMessages.tsx` | Contact submissions and email routing (`contactMessages`). |
| **Events Page** | `AdminEventEditor.tsx` | Community calendar schedules (`events`). |
| **User Profiles** | `AdminUsers.tsx` | Member settings, roles (User/Editor/Admin) (`users`). |
| **Global System** | `AdminSettings.tsx` | Platform configurations, custom API keys, FCM push configurations (`settings`). |
