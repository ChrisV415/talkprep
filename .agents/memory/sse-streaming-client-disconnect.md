---
name: SSE streaming client-disconnect handling
description: How to safely handle client disconnects on SSE (server-sent events) endpoints that proxy an upstream AI stream, both server- and client-side.
---

When an Express route streams an upstream (e.g. OpenAI) response over SSE to a client:

- **Server side:** listen for `req.on("close")` to detect client disconnects and abort the upstream call (e.g. pass an `AbortController` signal into the OpenAI SDK call) so the server doesn't keep paying for/generating tokens nobody will receive.
- Guard every `res.write`/`res.end` in `catch` blocks and completion callbacks with `if (!res.writableEnded)` — writing to an already-ended response (which happens once the abort/close path already closed it) throws and can crash the request handler.
- **Client side:** the mirror image matters just as much. If the client's fetch-based stream reader has no `AbortController`, navigating away or unmounting the component leaves the HTTP connection open, so the server's `req.on("close")` never fires and the upstream generation keeps running to completion. Wire an `AbortController` per streaming call, store it in a ref, and abort it in the component's unmount/cleanup effect. Treat `AbortError` as a silent no-op in the stream client's catch handler (it's an expected artifact of intentional cancellation, not a real error).

**Why:** found and fixed as a real resource-leak bug (unbounded OpenAI cost + hanging connections) in an app with 5 SSE endpoints (generate/roleplay/nudge/annotate/debrief) during a strict code review; the fix only closes the loop if both ends abort.

**How to apply:** any new SSE/streaming endpoint added later, and any new screen that calls a streaming client helper, should follow this same pattern from the start rather than being retrofitted after a review.
