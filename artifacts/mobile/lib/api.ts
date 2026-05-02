import { fetch } from "expo/fetch";

export function getApiUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) return "http://localhost:80/";
  return `https://${domain}/`;
}

export async function streamRequest(
  path: string,
  body: object,
  onChunk: (text: string) => void,
  onDone?: () => void,
  onError?: (err: Error) => void
): Promise<void> {
  const baseUrl = getApiUrl();
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
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
