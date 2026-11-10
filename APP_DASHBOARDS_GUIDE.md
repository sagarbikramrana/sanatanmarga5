# Prithvi Path Media v3.0 - Admin, Editor & User Dashboards Guide

This document provides a highly detailed, comprehensive feature and function guide of the administrative, editorial, and user dashboards implemented within the **Prithvi Path Media v3.0** platform. Use this document to review management controls, content authoring workflows, and community engagement dashboards with your team.

---

## 1. Executive Platform Admin Dashboard (`AdminDashboard.tsx`)

The **Admin Dashboard** is the ultimate central command center for platform administrators. It provides a highly visual, fluidly animated dashboard tailored to oversee news portals, coordinate journalists, and handle database seed actions.

### Key Features & Capabilities:
*   **High-Impact Analytics Widgets**:
    *   *Total Article Views*: Tracks cumulative page views dynamically aggregated from the `articles` database, translated into Nepali numerals (e.g., १९,५००).
    *   *Live Active Readers*: Visual representation of concurrent users currently engaged with the platform.
    *   *Pending Editorial Drafts*: Real-time count of articles that are currently in progress or awaiting administrative review.
    *   *Today's Publications*: Dynamic tracking of articles successfully pushed live within the last 24 hours.
    *   *Unread Messages Alert*: Counters showcasing pending inquiries submitted via contact forms, keeping communication lines clear.
*   **AI-Powered Database Seeding Engine**:
    *   *Category Selection Modal*: Admins can launch a custom-styled popup to select specific categories (e.g., Politics, Sports, Entertainment) and determine the exact number of articles they wish to populate.
    *   *Dynamic Seeding Progress Overlay*: An immersive overlay that launches when seeding begins. It features an animated, spring-physics-driven progress bar tracking the generation completion rate.
    *   *AI Safety Guardrails Warning*: Visual reminders telling admins not to exit or close the browser tab because the Gemini API is actively researching, transliterating, and drafting the articles.
*   **Sidebar Quick Draft Composers**:
    *   Allows immediate concept capture. Admins can type a quick news title, assign it a core category, and hit submit. The dashboard instantly generates a stub entry in Firestore so journalists can flesh it out in detail later.
*   **Recent Activity & Promotion Streams**:
    *   Displays a list of the 20 most recent breaking or featured article assets. Includes thumbnail previews, category tags, creation timestamps, and live publishing statuses (Published vs. Draft) with direct editorial shortcuts.

---

## 2. Personalized Journalist Editor Dashboard (`EditorDashboard.tsx`)

To keep reporters and editors focused purely on content production without being distracted by structural platform controls, the platform includes a customized **Editor Dashboard** workspace.

### Key Features & Capabilities:
*   **Context-Isolated Statistics**:
    *   Unlike the central Admin Dashboard, all graphs, metrics, and view counters on this view are **filtered dynamically** based on the logged-in Editor's personal user ID (`authorId == currentUser.uid`).
    *   Ensures individual journalists can seamlessly track the reach of their own stories, evaluate which topics perform best, and manage their personal editorial queue.
*   **Authored Content Logs**:
    *   Lists all news pieces composed specifically by the logged-in user.
    *   Provides quick toggles to jump back into their drafted pieces or update published stories.
*   **Isolated Quick Draft Integration**:
    *   Enables rapid writing triggers. Captures headline concepts and automatically sets the user as the primary author on save.
*   **Fully Responsive Sidebar Toggles**:
    *   Utilizes a fluid, window-resize observer. The side navigation panel automatically collapses into thin icon-only ribbons on tablets and mobile screens, giving journalists maximum screen space to focus on typing.

---

## 3. Custom User Dashboard & Profile Hub (`ProfilePage.tsx`)

The **User Dashboard / Profile Page** serves as a highly personalized interactive center for platform subscribers, registered community members, and journalists alike.

### Key Features & Capabilities:
*   **Dynamic Visual Cover Banners**:
    *   Displays modern, fluid gradient header wraps behind custom-rounded profile frames. Allows users to upload and manage custom profile pictures (`photoURL`) or fallback to minimalist vector letters.
*   **Editor Application Workflows**:
    *   Standard community users (`role === 'user'`) can apply to become an editor with a single tap.
    *   On submission, the system routes an application block containing application times and requested notes directly to administrative audit feeds, updating the user's dashboard with a "Pending Editor Request" indicator.
*   **Interactive Multi-Tab Workspace**:
    *   **About Tab**: Features a custom-written user bio parsed with real-time Latin-to-Devanagari phonetic transliteration, coupled with verified social media icons (Website, Facebook, Twitter, Instagram).
    *   **Articles Tab**: If the profile owner is an Editor or Admin, this panel lists all their published news pieces with rich thumbnail slides, view counts, and publication timestamps.
    *   **Chautari Forum Posts**: Aggregates all public discussion threads started by the user in the forums, displaying upvote counts, reply metrics, and categories.
    *   **Bookmarks / Saved Articles (Private)**:
        *   An exclusive personal vault where subscribers bookmark articles for later reading.
        *   Supports **offline-capable bookmarks**: Users can review, read, and delete bookmarked entries even when they have no internet connection. Deletions are enqueued in the browser's local sync stack and synchronized to Firestore the moment connectivity is restored.
