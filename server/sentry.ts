import * as Sentry from "@sentry/node";

export function initServerSentry(app: any) {
  const dsn = process.env.SENTRY_DSN || "";
  if (dsn) {
    try {
      Sentry.init({
        dsn,
        tracesSampleRate: 1.0,
      });
      
      // Sentry v8 Express integration:
      Sentry.setupExpressErrorHandler(app);
      console.log("Server-side Sentry successfully initialized.");
    } catch (err) {
      console.error("Failed to initialize backend Sentry:", err);
    }
  } else {
    console.warn("Server Sentry DSN (SENTRY_DSN) is empty. Backend Sentry tracing is disabled or running in simulated mode.");
  }
}

export function captureServerException(error: any, context?: any) {
  console.error("Server exception:", error, context);
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, { extra: context });
  }
}
