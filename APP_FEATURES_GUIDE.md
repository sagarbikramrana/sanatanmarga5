# Prithvi Path Media v3.0 - Comprehensive Features & Functions Guide

This document provides a comprehensive, non-technical, and highly detailed breakdown of all the features and functional modules built into the **Prithvi Path Media v3.0** platform. Use this guide to review current project capabilities with your team, map out product strategies, or align future development goals.

---

## 1. Core Platform Capabilities & Localizations

To serve a primarily Nepalese audience, the platform implements custom linguistic tools and layout protection mechanisms to provide a seamless reading experience in the Devanagari script.

*   **Nepali Text Layout Protection (Accents Safety)**: 
    *   *Problem solved*: The Devanagari script features various horizontal, top, and bottom accents (hraswa, dhirgha, ikar, and ukar) which standard web layouts often clip, hide, or misalign.
    *   *Function*: Implements systematic layout padding offsets on all content-rich text views to ensure that these linguistic accents are fully visible, readable, and never clipped by surrounding visual boundaries.
*   **Phonetic Latin-to-Devanagari Transliteration Input**:
    *   *Function*: Users and journalists can type phonetically in English (Latin characters), and the input field dynamically transliterates their characters into correct written Nepali (Devanagari) in real-time (e.g., typing "nepal" instantly converts to "नेपाल").
    *   *Use cases*: Applied on article editing pages, comments, contact forms, search queries, and community post creation panels.
*   **Dynamic Homepage Page Builder**:
    *   *Function*: Allows administrators to customize the visual appearance of individual categories on the homepage.
    *   *Options*: Categories can be rendered in diverse visual formats including grids, featured list cards, alternating blocks, magazines, masonry streams, or overlay rows.

---

## 2. Progressive Web App (PWA) & Offline-First Engine

The portal is designed to remain highly functional and readable in environments with unstable internet connections, low bandwidth, or restricted query quotas.

*   **PWA Mobile Installation Prompt**:
    *   *Function*: Prompts visitors to install the platform as a native-like app on iOS and Android devices directly from their mobile browser, complete with custom launch screens and standalone window frames.
*   **Automatic Offline Caching (Service Workers)**:
    *   *Function*: Automatically stores static resources (JavaScript, styling, application layouts) and assets (fonts, icons, local logos) in the browser's local cache.
    *   *Smart External Asset Lifespans*: Restricts and manages external assets (like remote Unsplash category images or Google Web Fonts) using a "CacheFirst" rule to optimize device memory.
*   **LocalStorage Offline Sync Queue**:
    *   *Function*: Intercepts and intercepts all actions (such as adding news comments, submitting contact forms, publishing community posts, or subscribing to newsletters) when a user has no active network connection or when the database triggers connection limits.
    *   *Reliable Serialization*: Cleans and reformats database items (e.g., complex timestamp structures) into safe formats so they can be written to the browser's local storage without crashing.
*   **Background Synchronization Loop**:
    *   *Function*: Continuously monitors the user’s connection status. Once internet connectivity is restored, the queue is processed automatically in the background (with 3 auto-retries in case of temporary handshake errors).
    *   *Real-time Toast Alerts*: Notifies the user with subtle, professional slide-in toast notifications upon successful background synchronization.
*   **Active Offline Status Banner**:
    *   *Function*: Renders a visually striking, animated status bar at the bottom of the screen showing connection status, current sync status, and the number of changes currently pending upload.

---

## 3. Editorial Engine & Portal Administration

The administrative panel provides a complete workspace for publishers, editors, and administrators to oversee content, manage navigation, track audience data, and serve scheduled ads.

*   **Role-Based Security Guards**:
    *   *Function*: Restricts portal controls based on user roles:
        *   `Admin`: Full permissions including system settings, custom themes, code/script guides, user roles, ad management, and category layout configurations.
        *   `Editor`: Content authoring, editing drafts, approving submissions, and managing comments.
        *   `User (Subscriber)`: Posting on the community forums, profile customizations, and bookmarking articles.
*   **Drag-and-Drop Category and Menu Builder**:
    *   *Function*: Provides a visual administrative organizer to adjust the ordering and nesting hierarchy of categories in the header navigation menus and footers with real-time sorting.
*   **Ad Space Monetization Manager (Ad Rotator)**:
    *   *Function*: Supports uploading and managing banner advertisements across specific placement slots on the website:
        *   *Slots*: Website Header, Right-Hand Sidebar, Homepage Mid-Section, Article Footer, and Article Inline (embedded directly inside the written news body).
        *   *Controls*: Active/inactive toggles, direct destination link binds, and scheduled campaign expiration configurations.
*   **Professional Journalist Composition Studio**:
    *   *Function*: A comprehensive content creation dashboard containing title inputs, slug generators, rich text formatting (bold, links, headers, lists, blockquotes), breaking news alerts toggles, featured banners, category assigns, and district-level geotagging.
*   **Audience Views & Engagement Analytics**:
    *   *Function*: Displays live statistics (visitor volumes, active signups, category popularity charts, and submission rates) through dynamic visual graphs, enabling editors to prioritize topics based on direct data.

---

## 4. Glamour Talent Hub (Modeling & Photography Directory)

A specialized vertical within the portal designed to showcase models, actors, influencers, and photographers, providing direct professional booking avenues.

*   **Unified Visual Talent Profiles**:
    *   *Function*: Showcases visual portfolios, vital statistics, physical attributes (height, weight, eye color, age), locations, spoken languages, social handles, and verification status of professionals.
*   **Interactive Galleries & Creative Portfolios**:
    *   *Function*: Enables creative professionals to host multiple separate high-resolution photo folders (e.g., headshots, commercial catalogs, high-fashion editorials).
*   **Portfolio Audience Engagement (Reactions & Comments)**:
    *   *Function*: Allows authenticated portal users to interact directly with individual portfolio items by leaving comments or adding emotional reactions (e.g., Like, Heart, Wow, Clap) which populate the model's metrics.
*   **Professional Casting/Booking Inquiries Engine**:
    *   *Function*: Facilitates client relations by allowing brands, agencies, producers, or directors to fill out direct booking inquiries (specifying type of shoot, dates, budget, location, and role requirements) that are instantly routed to the talent's assigned booking manager.

---

## 5. "Chautari" Community Forum

A highly collaborative space designed to drive user signups, user retention, and community discussions.

*   **Threaded Forum Conversations**:
    *   *Function*: Registered members can post new topics, share perspectives, and upload photos across curated categories and hashtags.
*   **Direct News Integration**:
    *   *Function*: Users can pin and link official portal articles directly into forum threads to contextualize current events.
*   **Interactive Upvote/Downvote Scores**:
    *   *Function*: Promotes quality dialogue by allowing the community to vote on posts, sorting top conversations to the top.
*   **Recursive Discussion Comments**:
    *   *Function*: Allows users to reply directly to specific comments in threaded nested chains.
*   **Administrative Report & Moderation Filters**:
    *   *Function*: Allows community members to flag inappropriate content, automatically funneling flagged posts to editor queues for removal or approval.

---

## 6. Advanced Backend Services & Platform Integrations

Behind-the-scenes automated backend scripts keep the portal updated and connected safely.

*   **FENEGOSIDA Gold & Silver Market Scraper**:
    *   *Function*: Automatically scrapes live market values of Gold and Silver in Nepal directly from the official Federation of Nepal Gold and Silver Dealers' Association.
    *   *Memory Cache Control*: Caches results for 24 hours to prevent redundant network calls and database load. Includes automatic fallbacks to static backups if the source website is unreachable.
*   **Multicast Push Notification Broadcasts (FCM)**:
    *   *Function*: Leverages Firebase Cloud Messaging to dispatch real-time news alerts (e.g., Breaking News) to registered browser service workers, generating browser notifications even when the tab is closed.
*   **SEO & Visibility Sitemaps**:
    *   *Function*: Generates standard platform sitemaps (`/sitemap.xml`) alongside dedicated Google News-compliant sitemaps (`/sitemap-news.xml`) automatically, ensuring immediate indexing by search engines.
*   **Automated Email Relays (Nodemailer)**:
    *   *Function*: Safely processes standard inquiries from the platform Contact Form and sends beautifully structured emails directly to administrative mailboxes, complete with user details and message threads.
