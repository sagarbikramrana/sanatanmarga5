import { auth } from "@/src/lib/firebase";

export function resetRotatingAiCache() {
  // No-op client side
}

export const generateWithRotation = async (options: {
  model: string;
  contents: any;
  config?: any;
  category?: string;
  moduleName?: string;
  requestId?: string;
}) => {
  let idToken: string | undefined;
  try {
    if (auth.currentUser) {
      idToken = await auth.currentUser.getIdToken();
    }
  } catch (e) {
    console.warn("Could not get auth ID token for AI proxy:", e);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (idToken) {
    headers["Authorization"] = `Bearer ${idToken}`;
  }

  const reqPayload = {
    ...options,
    requestId: options.requestId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    moduleName: options.moduleName || "AI_NEWSROOM"
  };

  console.log(`[AI_NEWSROOM] Dispatching AI rotation request (module=${reqPayload.moduleName}, model=${options.model}, category=${options.category || 'general'}, reqId=${reqPayload.requestId})`);

  const baseUrl = typeof window !== "undefined" ? "" : (process.env.API_BASE_URL || "http://localhost:3000");
  const res = await fetch(`${baseUrl}/api/gemini/generate-with-rotation`, {
    method: "POST",
    headers,
    body: JSON.stringify(reqPayload),
  });

  const rawText = await res.text();
  const trimmedText = rawText.trim();
  const isHtml = trimmedText.toLowerCase().startsWith("<!doctype") || 
                 trimmedText.toLowerCase().startsWith("<html") || 
                 res.headers.get("content-type")?.includes("text/html");

  if (isHtml) {
    console.error("[rotatingAiService] API endpoint returned HTML instead of JSON:", trimmedText.slice(0, 200));
    const error = new Error("DISCOVERY_API_INVALID_RESPONSE");
    (error as any).status = res.status;
    (error as any).isInvalidHtmlResponse = true;
    (error as any).code = "DISCOVERY_API_INVALID_RESPONSE";
    throw error;
  }

  if (!res.ok) {
    let parsedErr = rawText;
    let parsedObj: any = null;
    try {
      parsedObj = JSON.parse(rawText);
      parsedErr = parsedObj.error || rawText;
    } catch {}
    
    const isQuota = res.status === 429 || 
                    parsedErr.includes("429") || 
                    parsedErr.includes("RESOURCE_EXHAUSTED") || 
                    parsedErr.toLowerCase().includes("quota");

    const userFriendlyMsg = isQuota
      ? "AI Discovery अहिले उपलब्ध छैन। API quota समाप्त भएको छ।"
      : parsedErr || `API Server Error (Status ${res.status})`;

    const error = new Error(userFriendlyMsg);
    (error as any).response = parsedObj || rawText;
    (error as any).status = res.status;
    (error as any).isQuotaError = isQuota;
    (error as any).code = isQuota ? "AI_QUOTA_EXHAUSTED" : "API_ERROR";
    throw error;
  }

  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch (parseErr) {
    console.error("[rotatingAiService] JSON parse error on response:", rawText.slice(0, 200));
    const error = new Error("DISCOVERY_API_INVALID_RESPONSE");
    (error as any).status = res.status;
    (error as any).isInvalidHtmlResponse = true;
    (error as any).code = "DISCOVERY_API_INVALID_RESPONSE";
    throw error;
  }

  if (!data.success) {
    const isQuota = data.code === "AI_QUOTA_EXHAUSTED" || (data.error && data.error.includes("429"));
    const error = new Error(data.error || "AI generation failed");
    (error as any).response = data;
    (error as any).isQuotaError = isQuota;
    (error as any).code = isQuota ? "AI_QUOTA_EXHAUSTED" : (data.code || "API_ERROR");
    throw error;
  }

  if (data.modelUsed) {
    console.log(`[AI_MODEL_CALL_SUCCESS] (module=${reqPayload.moduleName}, modelUsed=${data.modelUsed}, reqId=${reqPayload.requestId})`);
  }

  return data.response;
};

