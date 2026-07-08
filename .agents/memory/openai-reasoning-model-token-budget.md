---
name: OpenAI o-series reasoning model token budget
description: o3/o4-mini via chat.completions can return empty content even with finish_reason "stop" absent — silently consumed by hidden reasoning tokens.
---

Calling `o3`/`o4-mini` (and likely other o-series reasoning models) through `chat.completions.create` with a modest `max_completion_tokens` (e.g. 300-600) for a short expected output can return `content: ""` with `finish_reason: "length"`. The entire token budget gets consumed by hidden `reasoning_tokens` (visible in `usage.completion_tokens_details.reasoning_tokens`) before any visible output is produced. This fails silently — no API error, just an empty string streamed to the client.

**Why:** o-series models generate internal reasoning tokens that count against `max_completion_tokens` but aren't part of the visible response. Short-output tasks (e.g. a one-sentence coaching tip) still need a large enough ceiling to let reasoning complete *and* leave room for the answer.

**How to apply:** When using o-series models for short-form output:
1. Set `reasoning_effort: "low"` to reduce reasoning token usage.
2. Set `max_completion_tokens` generously (~1500 for a 1-2 sentence answer) even though the visible output is small — it's a ceiling for reasoning + output combined, not just output.
3. Before shipping, test with `stream: false` and inspect `usage.completion_tokens_details.reasoning_tokens` and `finish_reason` to confirm you're not hitting the ceiling before producing content.
4. For latency/cost-sensitive tasks where reasoning depth isn't needed, consider a non-reasoning model (e.g. gpt-4o, gpt-5.4-mini) instead — reasoning models add real latency (~1-2s+) even at low effort.
