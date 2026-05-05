import { fetch } from "expo/fetch";

export function getApiUrl(): string {
  // On web, always derive the base URL from the current page origin at runtime.
  // This makes the bundle domain-agnostic so it works on any domain without
  // needing to be rebuilt.
  if (
    typeof window !== "undefined" &&
    window.location?.hostname &&
    window.location.hostname !== "localhost"
  ) {
    return `${window.location.protocol}//${window.location.host}/`;
  }
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) return "http://localhost:80/";
  return `https://${domain}/`;
}

let authTokenGetter: (() => Promise<string | null>) | null = null;

export function setAuthTokenGetter(getter: () => Promise<string | null>) {
  authTokenGetter = getter;
}

async function resolveToken(token?: string | null): Promise<string | null> {
  if (token !== undefined) return token ?? null;
  if (!authTokenGetter) return null;
  try {
    return await authTokenGetter();
  } catch {
    return null;
  }
}

function buildAuthHeaders(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiRequest<T = unknown>(
  path: string,
  method: string,
  body?: object,
  token?: string | null,
): Promise<T> {
  const baseUrl = getApiUrl();
  const resolved = await resolveToken(token);
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(resolved),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return response.json() as T;
}

export async function streamRequest(
  path: string,
  body: object,
  onChunk: (text: string) => void,
  onDone?: () => void,
  onError?: (err: Error) => void,
  token?: string | null,
): Promise<void> {
  const baseUrl = getApiUrl();
  const resolved = await resolveToken(token);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        ...buildAuthHeaders(resolved),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      let message = `HTTP ${response.status}`;
      if (response.status === 429) {
        try {
          const json = JSON.parse(text);
          message = json.message || "Monthly AI limit reached";
        } catch {}
      }
      throw new Error(message);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") {
          onDone?.();
          return;
        }
        try {
          const parsed = JSON.parse(data);
          if (parsed.content) onChunk(parsed.content);
          if (parsed.error) throw new Error(parsed.error);
        } catch (e) {
          if (e instanceof Error && e.message !== "Unexpected token") {
            throw e;
          }
        }
      }
    }
    onDone?.();
  } catch (err) {
    onError?.(err instanceof Error ? err : new Error(String(err)));
  }
}
