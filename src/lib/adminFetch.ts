import { auth } from "./firebase";

/**
 * Authenticated fetch wrapper for /api/admin/* and protected server endpoints.
 * Automatically attaches the current Firebase user's ID token in the Authorization header.
 */
export async function adminFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      const idToken = await currentUser.getIdToken();
      if (idToken && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${idToken}`);
      }
    }
  } catch (err) {
    // Proceed gracefully if token retrieval fails transiently
  }

  return fetch(input, {
    ...init,
    headers,
  });
}

