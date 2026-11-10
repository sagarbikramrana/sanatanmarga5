# SanatanMarga 5.0 Beta — Runtime Listener & Polling Audit

## 1. Realtime Listeners Inventory

| Owner / Component | Source | When Mounted | When Cleaned Up | Scope | Expected Frequency | Risk Level |
|---|---|---|---|---|---|---|
| `ArticlePage.tsx` | `safeOnSnapshot(commentsQ)` | On article page mount | Component unmount (`return () => unsubComments()`) | Per-article comments query | Triggered on every new comment | MEDIUM (Reads on high-traffic article pages) |
| `src/lib/firebase.ts` | Global Error Interceptor (`window.onerror`, `unhandledrejection`) | Client boot | Never (Global window lifecycle) | Window | Rare / On assertion | LOW |
| `src/lib/auth.tsx` | `onAuthStateChanged(auth, ...)` | AuthProvider mount | Never (Root provider lifecycle) | Global session | On login/logout/token refresh | LOW |
| `src/lib/notifications.ts` | `onMessage(messaging, ...)` | Component / Hook mount | Hook unmount | Foreground FCM | On incoming push message | LOW |
| `src/hooks/usePushNotifications.ts` | `onMessage(messaging, ...)` | Hook mount | Hook unmount | Foreground FCM | On incoming push message | LOW |
| `src/components/ui/SyncStatusBadge.tsx` | Custom window events (`offline-queue-updated`, etc.) | Badge mount | Badge unmount | Window events | On queue mutations | LOW |
| `src/pages/RadioPage.tsx` | `setInterval` (Broadcast Clock) | Page mount | Page unmount (`clearInterval`) | Local 1000ms clock | 1s interval | LOW |
| `server/snapshotOs.ts` | `setInterval(() => this.processQueue(), 10000)` | Server boot | Server shutdown | Background job queue | Every 10s | LOW |
| `server/ttsService.ts` | `registerTTSReadyListener` | Server boot | Process lifecycle | In-process EventEmitter | On TTS audio render completion | LOW |
| `server/sourcePollerService.ts` | Scheduled source poller | Server boot | Process lifecycle | External news pollers | Configurable timer | MEDIUM |

## 2. Key Listener & Polling Findings
1. **Article Page Listeners**:
   - Every reader opening an article attaches a live Firestore query listener (`where("articleId", "==", id)`).
   - In a breaking news scenario with thousands of simultaneous readers, this creates severe Firestore read amplification and quota consumption.
   - **5.0 Goal**: Move article comments to snapshot-first polling or on-demand manual load, removing permanent open realtime listeners on static reading paths.
2. **Missing Global Polling Storms**:
   - Fortunately, `NotificationBell.tsx` does NOT maintain an open Firestore realtime listener; it fetches on-demand with `getDocsWithCacheFallback`.
   - The newsroom dashboard uses event-bus updates rather than aggressive polling loops.
3. **Queue-Triggered View Counter**:
   - `ArticlePage` calls `offlineQueue.queueAction` for views on every visit, which dispatches `action-queued` window events and wakes up `SyncStatusBadge` across the application.
