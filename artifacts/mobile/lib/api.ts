import { fetch } from "expo/fetch";

export function getApiUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) return "http://localhost:80/";
  return `https://${domain}/`;
}

let authTokenGetter: (() => Promise<string | null>) | null = null;

export function setAuthTokenGetter(getter: () => Promise<string | null>) {
  authTokenGetter = getter;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!authTokenGetter) return {};
  try {
    const token = await authTokenGetter();
    if (token) return { Authorization: `Bearer ${token}` };
  } catch {}
  return {};
}

export async function apiRequest<T = unknown>(
  path: string,
  method: string,
  body?: object,
): Promise<T> {
  const baseUrl = getApiUrl();
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
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
): Promise<void> {
  const baseUrl = getApiUrl();
  const authHeaders = await getAuthHeaders();
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        ...authHeaders,
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
