import { Router } from "express";
import OpenAI from "openai";
import { db, sessions } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { rateLimiter } from "../middlewares/rateLimiter";
import type { AuthenticatedRequest } from "../middlewares/requireAuth";
import type { Request } from "express";

const router = Router();

const openai = new OpenAI({
  apiKey: process.env["AI_INTEGRATIONS_OPENAI_API_KEY"],
  baseURL: process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"],
});

function startSSE(res: import("express").Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();
}

type PastSession = {
  scenario: string;
  who: string;
  situation: string | null;
  scoresClarity: number | null;
  scoresComposure: number | null;
  scoresOutcome: number | null;
  debriefHappened: string | null;
  debriefDifferent: string | null;
};

const VERTICAL_SCENARIOS: Record<string, string[]> = {
  healthcare: [
    "breaking bad news", "end-of-life care conversation", "addiction intervention",
    "mental health crisis", "informed consent", "difficult patient or family",
    "reporting a colleague error", "clinical team conflict",
  ],
  legal: [
    "client deposition prep", "settlement negotiation", "delivering bad case news",
    "workplace investigation interview", "client expectation reset",
    "mediation session", "confidentiality concern",
  ],
  hr: [
    "performance improvement plan", "termination conversation", "hard performance review",
    "denying a raise or promotion", "team conflict resolution",
    "layoff notification", "promotion conversation", "harassment complaint handling",
  ],
  sales: [
    "price objection", "procurement pushback", "renewal at risk",
    "stalled deal close", "executive sponsor conversation",
    "lost deal debrief", "competitive displacement", "asking for a referral",
  ],
};

const VERTICAL_CONTEXT: Record<string, string> = {
  healthcare: ` Clinical: use SPIKES/NURSE/LEAP frameworks where relevant; centre patient autonomy and dignity; flag duty of candour if applicable.`,
  legal: ` Legal: interests vs. positions (Fisher/Ury); BATNA awareness; set client expectations early; face-saving language in mediation/settlement.`,
  hr: ` HR: behaviour-based (not character) feedback; progressive discipline logic; legally defensible and clear language; preserve employee dignity.`,
  sales: ` Sales: consultative not pitch-based; explore objections rather than counter them; anchor value before price; relationship over short-term close.`,
};

function detectVertical(scenario: string): string | null {
  const lower = scenario.toLowerCase().trim();
  for (const [vertical, scenarios] of Object.entries(VERTICAL_SCENARIOS)) {
    if (scenarios.some((s) => lower.includes(s) || s.includes(lower))) {
      return vertical;
    }
  }
  return null;
}

function buildMemoryContext(past: PastSession[]): string {
  if (!past.length) return "";

  const lines = past.map((s, i) => {
    const scores = [
      s.scoresClarity != null ? `Clarity ${s.scoresClarity}/5` : null,
      s.scoresComposure != null ? `Composure ${s.scoresComposure}/5` : null,
      s.scoresOutcome != null ? `Outcome ${s.scoresOutcome}/5` : null,
    ]
      .filter(Boolean)
      .join(", ");
    const happened = s.debriefHappened ? ` What happened: "${s.debriefHappened.slice(0, 120)}${s.debriefHappened.length > 120 ? "…" : ""}"` : "";
    const different = s.debriefDifferent ? ` Would do differently: "${s.debriefDifferent.slice(0, 80)}${s.debriefDifferent.length > 80 ? "…" : ""}"` : "";
    return `  [${i + 1}] ${s.scenario} with ${s.who}${s.situation ? ` — ${s.situation.slice(0, 80)}` : ""}. ${scores ? `Scores: ${scores}.` : ""}${happened}${different}`;
  });

  return `\nUSER'S RECENT PREP HISTORY (use to personalise advice — spot patterns, acknowledge growth, reference relevant past experience):\n${lines.join("\n")}\n`;
}

async function getRecentSessions(userId: string, limit = 5): Promise<PastSession[]> {
  try {
    return await db
      .select({
        scenario: sessions.scenario,
        who: sessions.who,
        situation: sessions.situation,
        scoresClarity: sessions.scoresClarity,
        scoresComposure: sessions.scoresComposure,
        scoresOutcome: sessions.scoresOutcome,
        debriefHappened: sessions.debriefHappened,
        debriefDifferent: sessions.debriefDifferent,
      })
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .orderBy(desc(sessions.createdAt))
      .limit(limit);
  } catch {
    return [];
  }
}

router.post("/talkprep/generate", requireAuth, rateLimiter, async (req: Request, res) => {
  startSSE(res);
  const userId = (req as AuthenticatedRequest).userId;
  const { scenario, who, situation, outcome, tone } = req.body as {
    scenario: string;
    who: string;
    situation: string;
    outcome?: string;
    tone?: string;
  };

  const past = await getRecentSessions(userId);
  const memoryBlock = buildMemoryContext(past);
  const vertical = detectVertical(scenario);
  const verticalBlock = vertical ? VERTICAL_CONTEXT[vertical] : "";

  const systemPrompt = `You are TalkPrep — a conversation coach. Prep this person for their exact conversation. Word-for-word specific. No generic advice.${verticalBlock}

## OPENING — 3 opening lines (A/B/C), note when each works best
## KEY POINTS — 4 points phrased as the user would actually say them
## LIKELY PUSHBACK — 3–4 realistic reactions + a specific calm response to each
## IF IT DERAILS — 2–3 grounding moves for specific derail situations
## MINDSET GOING IN — 3 tailored mental anchors (not generic "stay calm")
## YOUR ONE QUESTION — one reflective question they haven't fully considered

Under 200 words per section. Match the tone requested. Never invent facts.${memoryBlock}`;

  const userPrompt = `Scenario type: ${scenario}
Who they're talking to: ${who}
Situation: ${situation}
Desired outcome: ${outcome || "not specified"}
Preferred tone: ${tone || "balanced"}

Generate their full conversation prep guide.`;

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch {
    res.write(`data: ${JSON.stringify({ error: "Failed to generate prep" })}\n\n`);
    res.end();
  }
});

router.post("/talkprep/roleplay", requireAuth, async (req, res) => {
  startSSE(res);
  const { messages, systemContext } = req.body as {
    messages: { role: "user" | "assistant"; content: string }[];
    systemContext: string;
  };

  const enhancedSystem = `${systemContext}

Vary your emotional register. Let genuine moments land. End some turns with a question or silence-signal. Never break character or coach.`;

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 2048,
      messages: [
        { role: "system", content: enhancedSystem },
        ...messages,
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch {
    res.write(`data: ${JSON.stringify({ error: "Failed to respond" })}\n\n`);
    res.end();
  }
});

router.post("/talkprep/nudge", requireAuth, async (req, res) => {
  startSSE(res);
  const { scenario, outcome, userSaid, theySaid, history } = req.body as {
    scenario: string;
    outcome?: string;
    userSaid: string;
    theySaid: string;
    history?: { role: "user" | "assistant"; content: string }[];
  };

  const transcript = (history && history.length ? history : [
    { role: "user" as const, content: userSaid },
    { role: "assistant" as const, content: theySaid },
  ])
    .slice(-10)
    .map((m) => `${m.role === "user" ? "USER" : "THEM"}: ${m.content}`)
    .join("\n");

  const prompt = `Scenario: ${scenario} | Desired outcome: ${outcome || "not specified"}

CONVERSATION SO FAR:
${transcript}

COACHING TASK:
Look across the whole exchange, not just the last line — spot a pattern (repeating a weak move, missing an opening, escalating unnecessarily) or the sharpest single opportunity right now. Give ONE tactical tip for the user's NEXT message.

FORMAT: One to two sentences. Direct. No preamble ("Great job!", "Consider...", etc.). Start with the insight or the action.`;

  try {
    const stream = await openai.chat.completions.create({
      model: "o4-mini",
      max_completion_tokens: 1500,
      reasoning_effort: "low",
      messages: [
        {
          role: "system",
          content:
            "You are a reasoning coach silently watching a live practice conversation. Analyze speech patterns across turns, not just the last line. One tactical tip, 1–2 sentences, no preamble.",
        },
        { role: "user", content: prompt },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch {
    res.write(`data: ${JSON.stringify({ error: "Failed to generate nudge" })}\n\n`);
    res.end();
  }
});

router.post("/talkprep/annotate", requireAuth, async (req, res) => {
  startSSE(res);
  const { scenario, outcome, context, message } = req.body as {
    scenario: string;
    outcome?: string;
    context: string;
    message: string;
  };

  const prompt = `CONVERSATION CONTEXT:
Scenario: ${scenario} | Desired outcome: ${outcome || "not specified"}

PRIOR EXCHANGE:
${context}

USER'S MESSAGE BEING ANNOTATED: "${message}"

ANNOTATION TASK:
1. Decide: GOOD (this moved toward the outcome or handled the moment well) or MISSED (a meaningful opportunity was left on the table).
2. Write one specific sentence explaining why — reference what they said and what the other person said before it.
3. If MISSED: add one concrete alternative sentence the user could have said instead.

REPLY FORMAT (exactly):
RATING: GOOD or MISSED
ANNOTATION: [your specific explanation]
ALTERNATIVE: [only if MISSED — one sentence they could have said]`;

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 200,
      messages: [
        {
          role: "system",
          content:
            "You annotate practice conversation messages with precise, tactical feedback tied to the exact words used. No generic praise or criticism. Be a sharp but fair evaluator.",
        },
        { role: "user", content: prompt },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch {
    res.write(`data: ${JSON.stringify({ error: "Failed to annotate" })}\n\n`);
    res.end();
  }
});

router.post("/talkprep/debrief", requireAuth, async (req: Request, res) => {
  startSSE(res);
  const userId = (req as AuthenticatedRequest).userId;
  const { scenario, who, situation, outcome, happened, different, scores } =
    req.body as {
      scenario: string;
      who: string;
      situation: string;
      outcome: string;
      happened: string;
      different?: string;
      scores?: { clarity?: number; composure?: number; outcome_score?: number };
    };

  const past = await getRecentSessions(userId, 3);
  const memoryBlock = buildMemoryContext(past);

  const avgScore =
    [scores?.clarity, scores?.composure, scores?.outcome_score]
      .filter((s): s is number => s != null)
      .reduce((a, b, _, arr) => a + b / arr.length, 0) || null;

  const scoreContext = scores
    ? `Clarity: ${scores.clarity ?? "?"}/5 | Composure: ${scores.composure ?? "?"}/5 | Outcome: ${scores.outcome_score ?? "?"}/5${avgScore ? ` (avg ${avgScore.toFixed(1)})` : ""}`
    : "Not scored";

  const prompt = `CONVERSATION DEBRIEF:
Scenario: ${scenario} | With: ${who}
Situation: ${situation}
What they were hoping for: ${outcome}
What actually happened: ${happened}
What they'd do differently: ${different || "nothing mentioned"}
Self-scores — ${scoreContext}
${memoryBlock}
DEBRIEF TASK:
Write a warm, honest 3–5 sentence debrief as a trusted coach who has seen their full history. 
- Acknowledge one specific thing they did or handled well (reference what happened).
- Name one concrete thing to work on or remember — tied directly to their scores and what they said happened.
- If they have past sessions, note any pattern (growth or recurring challenge) — be specific, not vague.
- End with one forward-looking sentence: what to carry into the next conversation.
Tone: honest, warm, direct. Like a coach who respects them enough not to be soft.`;

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 512,
      messages: [
        {
          role: "system",
          content:
            "You are a trusted conversation coach giving a personalised post-conversation debrief. Reference specifics. Be direct but warm. 3–5 sentences. No generic coaching speak.",
        },
        { role: "user", content: prompt },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch {
    res.write(`data: ${JSON.stringify({ error: "Failed to generate debrief" })}\n\n`);
    res.end();
  }
});

export default router;
