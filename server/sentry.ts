import * as Sentry from "@sentry/node";

export interface TelemetryEventRecord {
  id: string;
  subsystem: "editorial_outbox" | "snapshot_cas" | "scheduler_os" | "rate_limit" | "general";
  level: "error" | "warning" | "info";
  message: string;
  tags: Record<string, string>;
  context: Record<string, any>;
  timestamp: string;
}

const MAX_TELEMETRY_EVENTS = 200;
const telemetryEvents: TelemetryEventRecord[] = [];
const telemetryCounters = {
  outboxFailures: 0,
  casConflicts: 0,
  schedulerFailures: 0,
  rateLimitFallbacks: 0,
  generalExceptions: 0,
};

function recordTelemetryEvent(
  subsystem: TelemetryEventRecord["subsystem"],
  level: TelemetryEventRecord["level"],
  message: string,
  tags: Record<string, string>,
  context: Record<string, any>
): TelemetryEventRecord {
  const entry: TelemetryEventRecord = {
    id: `tel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    subsystem,
    level,
    message,
    tags,
    context,
    timestamp: new Date().toISOString(),
  };

  telemetryEvents.unshift(entry);
  if (telemetryEvents.length > MAX_TELEMETRY_EVENTS) {
    telemetryEvents.length = MAX_TELEMETRY_EVENTS;
  }
  return entry;
}

export function initServerSentry(app: any) {
  const dsn = process.env.SENTRY_DSN || "";
  const isProd = process.env.NODE_ENV === "production";
  if (dsn) {
    try {
      Sentry.init({
        dsn,
        environment: process.env.NODE_ENV || "development",
        tracesSampleRate: isProd ? 0.2 : 1.0,
      });

      Sentry.setupExpressErrorHandler(app);
      console.log(`Server-side Sentry successfully initialized (sampleRate=${isProd ? 0.2 : 1.0}).`);
    } catch (err) {
      console.error("Failed to initialize backend Sentry:", err);
    }
  } else {
    console.warn("Server Sentry DSN (SENTRY_DSN) is empty. Backend Sentry tracing is disabled or running in simulated mode.");
  }
}

export function captureServerException(error: any, context?: any) {
  telemetryCounters.generalExceptions++;
  const errMsg = error instanceof Error ? error.message : String(error);
  recordTelemetryEvent("general", "error", errMsg, { subsystem: "general" }, context || {});
  console.error("Server exception:", error, context);
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, { extra: context });
  }
}

export interface OutboxFailurePayload {
  jobId: string;
  candidateId?: string;
  articleId?: string;
  attempt: number;
  maxAttempts?: number;
  reason: string;
  workerId?: string;
}

export function captureOutboxFailure(
  jobIdOrPayload: string | OutboxFailurePayload,
  attempt?: number,
  error?: any
) {
  telemetryCounters.outboxFailures++;
  const payload: OutboxFailurePayload =
    typeof jobIdOrPayload === "string"
      ? {
          jobId: jobIdOrPayload,
          attempt: attempt ?? 1,
          reason: error instanceof Error ? error.message : String(error ?? "Outbox error"),
        }
      : jobIdOrPayload;

  recordTelemetryEvent(
    "editorial_outbox",
    "error",
    `Outbox job ${payload.jobId} failed on attempt ${payload.attempt}: ${payload.reason}`,
    { subsystem: "editorial_outbox", job_id: payload.jobId },
    payload
  );

  if (process.env.SENTRY_DSN) {
    Sentry.withScope((scope) => {
      scope.setTag("subsystem", "editorial_outbox");
      scope.setTag("job_id", payload.jobId);
      scope.setContext("outbox", payload as Record<string, any>);
      Sentry.captureException(new Error(payload.reason));
    });
  }
}

export interface CASConflictPayload {
  objectKey?: string;
  moduleId?: string;
  expectedCondition?: string;
  expectedEtag?: string;
  actualEtag?: string;
  incomingGeneration?: number;
  existingGeneration?: number;
  reason: string;
}

export function captureCASConflict(
  moduleIdOrPayload: string | CASConflictPayload,
  expectedCondition?: string,
  reason?: string
) {
  telemetryCounters.casConflicts++;
  const payload: CASConflictPayload =
    typeof moduleIdOrPayload === "string"
      ? {
          moduleId: moduleIdOrPayload,
          objectKey: moduleIdOrPayload,
          expectedCondition: expectedCondition || "",
          reason: reason || "CAS precondition failed",
        }
      : moduleIdOrPayload;

  const targetKey = payload.objectKey || payload.moduleId || "manifest.json";
  recordTelemetryEvent(
    "snapshot_cas",
    "warning",
    `CAS conflict on ${targetKey}: ${payload.reason}`,
    { subsystem: "snapshot_cas", module_id: targetKey },
    payload
  );

  if (process.env.SENTRY_DSN) {
    Sentry.withScope((scope) => {
      scope.setTag("subsystem", "snapshot_cas");
      scope.setTag("module_id", targetKey);
      scope.setContext("cas", payload as Record<string, any>);
      Sentry.captureMessage(`CAS conflict on ${targetKey}: ${payload.reason}`, "warning");
    });
  }
}

export interface SchedulerFailurePayload {
  candidateId: string;
  scheduledAt?: string;
  attempt: number;
  reason: string;
}

export function captureSchedulerFailure(
  candidateIdOrPayload: string | SchedulerFailurePayload,
  attempt?: number,
  error?: any
) {
  telemetryCounters.schedulerFailures++;
  const payload: SchedulerFailurePayload =
    typeof candidateIdOrPayload === "string"
      ? {
          candidateId: candidateIdOrPayload,
          attempt: attempt ?? 1,
          reason: error instanceof Error ? error.message : String(error ?? "Scheduler execution error"),
        }
      : candidateIdOrPayload;

  recordTelemetryEvent(
    "scheduler_os",
    "error",
    `Scheduled candidate ${payload.candidateId} failed on attempt ${payload.attempt}: ${payload.reason}`,
    { subsystem: "scheduler_os", candidate_id: payload.candidateId },
    payload
  );

  if (process.env.SENTRY_DSN) {
    Sentry.withScope((scope) => {
      scope.setTag("subsystem", "scheduler_os");
      scope.setTag("candidate_id", payload.candidateId);
      scope.setContext("scheduler", payload as Record<string, any>);
      Sentry.captureException(new Error(payload.reason));
    });
  }
}

export interface RateLimitFallbackPayload {
  model?: string;
  purpose?: string;
  cooldownMs?: number;
  reason?: string;
  [key: string]: any;
}

export function captureRateLimitFallback(
  subsystemOrPayload: string | RateLimitFallbackPayload,
  detail: Record<string, any> = {}
) {
  telemetryCounters.rateLimitFallbacks++;
  const target =
    typeof subsystemOrPayload === "string"
      ? subsystemOrPayload
      : subsystemOrPayload.model || subsystemOrPayload.purpose || "ai_model";
  const contextData = typeof subsystemOrPayload === "string" ? detail : subsystemOrPayload;

  recordTelemetryEvent(
    "rate_limit",
    "warning",
    `Rate-limit fallback triggered for ${target}`,
    { subsystem: "rate_limit", target },
    contextData
  );

  if (process.env.SENTRY_DSN) {
    Sentry.withScope((scope) => {
      scope.setTag("subsystem", "rate_limit");
      scope.setTag("target", target);
      scope.setContext("rate_limit", contextData);
      Sentry.captureMessage(`Rate-limit fallback triggered for ${target}`, "warning");
    });
  }
}

export function getTelemetryDiagnostics(limit = 50) {
  return {
    sentryConfigured: Boolean(process.env.SENTRY_DSN),
    counters: { ...telemetryCounters },
    recentEvents: telemetryEvents.slice(0, Math.max(1, Math.min(limit, MAX_TELEMETRY_EVENTS))),
  };
}

export function resetTelemetryDiagnostics() {
  telemetryEvents.length = 0;
  telemetryCounters.outboxFailures = 0;
  telemetryCounters.casConflicts = 0;
  telemetryCounters.schedulerFailures = 0;
  telemetryCounters.rateLimitFallbacks = 0;
  telemetryCounters.generalExceptions = 0;
}
