# Sanatan Media (सनातन मार्ग) — Complete UI/UX & Design System Specification

## 1. Executive Summary & Design Philosophy

**Sanatan Media (सनातन मार्ग)** is a next-generation Nepali digital media, newsroom, and community platform built on React, Tailwind CSS, and Firebase. The user experience (UX) and visual design (UI) bridge ancient cultural authenticity with contemporary digital publishing standards.

### Core Visual Principles
1. **Sattvic Clarity (Light Mode)**: Pure, bright, and legible layouts utilizing soft slate backgrounds (`#f8fafc`), clean white surfaces (`#ffffff`), and high-contrast typography designed for daily news consumption.
2. **Twilight Focus (Dark Mode)**: Eye-safe deep slate dark canvases (`#0f172a`) with rich surface elevations (`#1e2937`) and subtle primary glows (`rgba(0,144,224,0.15)`) ideal for evening reading and media viewing.
3. **Spiritual Gold Accent (`--sacred`)**: A signature gold token (`#D4AF37` Light / `#F4D03F` Dark) representing auspiciousness, highlights, premium badges, and AI-powered tools.
4. **Brand Primary Blue (`--primary`)**: Trustworthy newsroom blue (`#0072B5` Light / `#0090E0` Dark) providing visual anchors across buttons, active states, and navigation links.
5. **Mobile-First Ergonomics**: Elevated mobile floating bottom navigation (`MobileBottomNav`) with a role-aware bottom sheet ("+") and gesture-friendly touch targets (min 44px).

---

## 2. Color System & Theme Tokens

The application employs a CSS Variable-driven theme engine with seamless light/dark mode toggling, smooth 250ms color transitions, and zero layout shift.

### 2.1 CSS Variable Mapping

| Token Name | Light Mode Value | Dark Mode Value | Semantic Purpose |
| :--- | :--- | :--- | :--- |
| `--primary` | `#0072B5` (Logo Blue) | `#0090E0` (Vibrant Blue) | Primary branding, CTAs, active states |
| `--accent` | `#b91c1c` (Crimson) | `#ef4444` (Bright Red) | Breaking news, urgent alerts, destructive |
| `--sacred` | `#D4AF37` (Spiritual Gold) | `#F4D03F` (Luminous Gold) | AI features, badges, sacred highlights |
| `--background` | `#f8fafc` (Slate 50) | `#0f172a` (Slate 950) | Global app canvas background |
| `--foreground` | `#020617` (Slate 950) | `#e2e8f0` (Slate 200) | Primary body & heading text |
| `--card` | `#ffffff` (Pure White) | `#1e2937` (Slate 800) | Surface containers, cards, modals |
| `--card-foreground` | `#020617` (Slate 950) | `#f8fafc` (Slate 50) | High-contrast text on card surfaces |
| `--muted` | `#f1f5f9` (Slate 100) | `#334155` (Slate 700) | Muted areas, subtle card fills |
| `--muted-foreground` | `#64748b` (Slate 500) | `#94a3b8` (Slate 400) | Secondary labels, timestamps, meta text |
| `--border` | `#e2e8f0` (Slate 200) | `#475569` (Slate 600) | Component borders & dividers |
| `--secondary` | `#e2e8f0` | `#334155` | Secondary button backgrounds |
| `--secondary-foreground` | `#0f172a` | `#f8fafc` | Text on secondary elements |
| `--destructive` | `#dc2626` | `#ef4444` | Errors, delete actions |
| `--success` | `#16a34a` (Green 600) | `#22c55e` (Green 500) | Confirmations, success states |
| `--warning` | `#ca8a04` (Yellow 600) | `#eab308` (Yellow 500) | Pending state, caution banners |
| `--overlay` | `rgba(255,255,255,0.8)` | `rgba(15,23,42,0.85)` | Backdrop modals & floating glass |

---

### 2.2 Role-Based Color Scheme (Badges & User Levels)

Permissions and user states are visually communicated through standardized badge styling:

```tsx
// Role Color Matrix
const RoleThemeMap = {
  super_admin: {
    label: "सुपर/एडमिनिस्ट्रेटर",
    badge: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
  },
  editor: {
    label: "मुख्य सम्पादक/सम्पादक",
    badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
  },
  journalist: {
    label: "पत्रकार/रिपोर्टर",
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
  },
  user: {
    label: "दर्ता सदस्य",
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
  },
  guest: {
    label: "पाहुना प्रयोगकर्ता",
    badge: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20"
  }
};
```

---

## 3. Typography & Devanagari Font System

Sanatan Media utilizes a Devanagari-optimized typography system supporting fluent rendering of Nepali unicode (`NTP`) alongside clean Latin characters.

### 3.1 Font Families
- **Primary Body & Display**: `"Hind Siliguri", "Inter", ui-sans-serif, system-ui, sans-serif`
- **Fallback Stack**: System sans-serif fonts ensuring immediate fallback while web fonts hydrate.

### 3.2 Fluid Typography Scale (`clamp`)

| Token | Min Size | Preferred / Fluid | Max Size | Line Height | Typical Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `--text-xxs` | `0.60rem` | `0.55rem + 0.15vw` | `0.70rem` | `1.4` | Tiny badges, metadata, footnotes |
| `--text-xs` | `0.75rem` | `0.717rem + 0.164vw` | `0.875rem` | `1.4` | Category pills, timestamps, labels |
| `--text-sm` | `0.875rem` | `0.842rem + 0.164vw` | `1.00rem` | `1.4` | Form labels, card excerpts, navigation |
| `--text-base` | `1.00rem` | `0.967rem + 0.164vw` | `1.125rem` | `1.5` | Standard body text, article content |
| `--text-lg` | `1.125rem` | `1.092rem + 0.164vw` | `1.25rem` | `1.5` | Lead body text, card titles |
| `--text-xl` | `1.25rem` | `1.185rem + 0.329vw` | `1.50rem` | `1.4` | Subheadings (H3), section headers |
| `--text-2xl` | `1.50rem` | `1.402rem + 0.493vw` | `1.875rem` | `1.3` | Section headings (H2), modal titles |
| `--text-3xl` | `1.875rem` | `1.777rem + 0.493vw` | `2.25rem` | `1.2` | Major Article Headlines (H1) |
| `--text-4xl` | `2.25rem` | `2.053rem + 0.986vw` | `3.00rem` | `1.1` | Hero Title Displays |
| `--text-5xl` | `3.00rem` | `2.737rem + 1.315vw` | `4.00rem` | `1.1` | Special Breaking News Banners |

---

## 4. Spacing, Layout & Radius Hierarchy

### 4.1 Responsive Containers
- **Main Container (`.container-custom`)**: `max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12`
- **Bento & Multi-Column Grids**:
  - Desktop (`lg`, `xl`): 3 to 4 columns for news feed, sidebar widgets, and media grids.
  - Tablet (`md`): 2 columns.
  - Mobile (`sm`): 1 column with edge-to-edge scrollable horizontal carousels.

### 4.2 Corner Radii System & Nesting Math
The app strictly enforces mathematical corner radius nesting (`Inner Radius = Outer Radius - Padding`):

- **Outer App Container Radius (`--app-radius`)**: `40px` (`2.5rem` / `rounded-3xl`)
- **4XL Radius (`--radius-4xl`)**: `64px` (`4rem`)
- **Category Hero Radius (`--radius-cat-hero`)**: `40px` (`2.5rem`)
- **2XL Card Radius (`--radius-2xl`)**: `32px` (`2rem`)
- **XL Inner Container Radius (`--radius-xl`)**: `16px` (`1rem`)
- **Standard Button & Tag Pills**: `9999px` (`rounded-full`)

---

## 5. Component UI Specs & Design Patterns

### 5.1 Dual-Header & Navigation (`Header.tsx`)
1. **Top Utility Bar**: Live time in Devanagari, Stock Ticker (NEPSE / Forex), Social Links, Language Switcher, Theme Toggle (Sun/Moon).
2. **Main Branding Row**: High-resolution Sanatan Media logo, auspicious quote ticker, search trigger button, notification bell with unread badge, profile quick menu, and Admin link.
3. **Category Navigation Bar**: Horizontal sticky bar with smooth horizontal scroll containing news categories (गृह, राजनीति, धर्म-संस्कृति, विचार, अर्थ, खेलकूद, जीवनशैली, प्रवास).

---

### 5.2 Mobile Bottom Navigation & Role-Aware FAB (`MobileBottomNav.tsx`)

A floating bottom navigation bar tailored specifically for touch ergonomics on smartphones.

```
       ⭕ [Floating FAB Button]
      ➕ (Primary Blue, White Icon, Elevated)
 ╭───────────────────────────────────────────╮
 │  🏠       🔍       ➕       🔔      👤    │
 │ Home    Search   Create   Alerts   Profile│
 ╰───────────────────────────────────────────╯
```

#### Key Specs:
- **Floating Frame**: Rounded floating bar (`rounded-3xl`) situated `16px` (`bottom-4`) above the screen edge with a soft backdrop blur (`backdrop-blur-xl`) and subtle border (`border-border-theme`).
- **Elevated Center FAB Button**: 52x52px circular button (`w-13 h-13`) raised above the bar with primary blue gradient, white `+` icon, and touch vibration feedback (`navigator.vibrate`).
- **Notification Unread Badge**: Pulsing crimson badge showing real-time unread counts on the `🔔` Alerts button.
- **Role-Aware Create Sheet**: Tapping `+` opens a smooth spring bottom sheet dynamically tailored to the user's logged-in role:
  - **Guest**: Sign-in call-to-action to contribute.
  - **Registered User**: Create Community Post, Upload Photo, Request Event.
  - **Reporter / Journalist**: Breaking News Draft, Field Media Upload, Voice Note.
  - **Editor / Admin**: Write Article, AI Article Generator, Media Library, Live Broadcast.

---

### 5.3 News Cards & Article Cards (`premium-card`)

```css
.premium-card {
  background-color: var(--card);
  border: 1px solid rgba(var(--border), 0.5);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.04);
  border-radius: 40px;
  overflow: hidden;
  transition: all 0.7s cubic-bezier(0.16, 1, 0.3, 1);
}

.premium-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 40px 80px -20px rgba(0, 114, 181, 0.15);
}
```

- **Featured Image**: 16:9 aspect ratio with subtle zoom hover effect (`scale-105`).
- **Category Badge**: Absolute positioned top-left pill (`bg-primary/90 text-white backdrop-blur-md`).
- **Headline**: Bold, high-contrast Devanagari heading with clamp sizing.
- **Meta Bar**: Author avatar, author name, time ago (e.g. "२ घण्टा अगाडि"), reading duration, and bookmark toggle button.

---

### 5.4 AI Article Generator Modal (`AIGeneratorModal.tsx`)
- **Accent Theme**: Spiritual Gold (`--sacred`) styling with glowing border effects.
- **Input Controls**: Category dropdown, topic prompt text area, tone selector (पत्रकारिता शैली, गम्भीर सम्पादकीय, विश्लेषणात्मक).
- **Generation Output**: Real-time streaming response displaying title, meta summary, body paragraphs, and auto-suggested tags.

---

## 6. Motion & Animation Standards

The application uses **Motion (`motion/react`)** for declarative component animations and transitions:

1. **Spring Transitions**: Standard bottom sheet and modal animations:
   - `type: "spring"`, `damping: 25`, `stiffness: 280`
2. **Page & Tab Fade**: Soft layout transitions (`opacity: 0` to `opacity: 1`, duration `200ms`).
3. **Hover Lift**: Micro-interactions on buttons and cards using `.hover-lift` (`hover:-translate-y-1 active:scale-95`).
4. **Shimmer Skeleton**: Continuous gradient sweep animation (`@keyframes shimmer 2s infinite`) on loading placeholder cards.

---

## 7. Accessibility (a11y) & Performance Checklist

- **Keyboard Focus**: Explicit focus rings using `:focus-visible` (`outline: 2px solid var(--ring)`).
- **Color Contrast**: All body text and headings satisfy WCAG AA contrast ratio (> 4.5:1 in both light and dark mode).
- **Reduced Motion**: Automated fallback via `@media (prefers-reduced-motion: reduce)` stripping non-essential animations.
- **Dark Mode Persistence**: User dark mode preference stored in `localStorage` and synchronized with system dark mode settings.
