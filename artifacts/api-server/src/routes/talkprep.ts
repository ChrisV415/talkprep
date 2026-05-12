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
  healthcare: `
CLINICAL CONTEXT: The user is a healthcare professional (doctor, nurse, social worker, or allied health). Apply clinical communication best practices:
- Reference frameworks where relevant: SPIKES (for bad news), NURSE (empathy), LEAP (motivational interviewing), shared decision-making.
- Respect patient autonomy, dignity, and informed consent.
- Acknowledge the emotional weight carried by clinicians — burnout, moral distress, institutional pressure.
- Use clinical language naturally but keep advice immediately actionable.
- Regulatory context (duty of candour, mandatory reporting) matters — flag if relevant.`,

  legal: `
LEGAL CONTEXT: The user is a legal professional (lawyer, mediator, HR investigator). Apply professional communication norms:
- Emphasize managing client expectations honestly and early — avoid overpromising.
- Be aware of attorney-client privilege, confidentiality, and professional ethics boundaries.
- Frame negotiation advice around interests vs. positions (Fisher/Ury) and BATNA awareness.
- Settlement and mediation contexts require face-saving language — acknowledge the other side's legitimate interests.
- Deposition prep requires the user to be calm, precise, and non-reactive.`,

  hr: `
HR/MANAGEMENT CONTEXT: The user is a manager or HR professional preparing for a high-stakes people conversation. Apply employment best practices:
- Emphasize documentation, specificity, and behaviour-based (not character-based) feedback.
- Follow progressive discipline logic where applicable — be fair and consistent.
- Preserve the employee's dignity throughout, regardless of the outcome.
- For PIPs and terminations: be clear, direct, and legally defensible — avoid softening language that creates ambiguity.
- For conflict: remain neutral, gather both sides, and focus on impact not intent.`,

  sales: `
SALES CONTEXT: The user is a sales professional preparing for a buyer conversation. Apply consultative selling frameworks:
- Focus on understanding the buyer's real constraints (budget cycle, internal politics, risk aversion) before proposing solutions.
- Emphasize listening over pitching — the goal is to surface the buyer's own logic for moving forward.
- Objections are buying signals — coach the user to explore them rather than counter them.
- Reference negotiation anchoring, value framing, and concession sequencing where relevant.
- Long-term relationship > short-term close — never win the deal at the cost of trust.`,
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

  const systemPrompt = `You are TalkPrep — a sharp, empathetic conversation coach. Your job is to help someone walk into a specific real conversation fully prepared, not with generic advice.${verticalBlock}

YOUR OUTPUT FORMAT — use these exact section headers, in this order:

## OPENING
Write 3 distinct opening lines the user could actually say out loud. Each should feel natural (not scripted), immediately establish intent without aggression, and fit the tone requested. Label them A, B, C and briefly note when each one works best.

## KEY POINTS
List exactly 4 specific points to make in this conversation. Each point must: (a) be concrete and tied to this situation, (b) anticipate the other person's mindset, (c) be phrased as the user would actually say it — not abstract bullet points.

## LIKELY PUSHBACK
Identify 3–4 realistic reactions the other person may have. For each: state what they'll say/do, then give a specific calm response the user can use. No generic deflections — make responses fit this person and scenario.

## IF IT DERAILS
Give 2–3 grounding moves for when the conversation gets heated, goes silent, or veers off track. Name the exact situation and the exact move. Include one for an emotional escalation and one for stonewalling.

## MINDSET GOING IN
3 specific mental anchors for this conversation — not generic ("stay calm") but tailored to this person, this scenario, and what tends to trip people up in situations like this.

## YOUR ONE QUESTION
End with a single reflective question for the user to sit with before the conversation. It should surface something they may not have fully considered.

RULES:
- Be direct and specific. Generic prep is useless prep.
- Under 220 words per section.
- Never invent facts about people or situations not provided.
- Match the requested tone throughout.${memoryBlock}`;

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

ADDITIONAL REALISM RULES:
- Vary your sentence length and emotional register turn by turn — real people don't respond identically every time.
- If the user says something that genuinely lands well, let it soften you slightly (don't maintain artificial resistance).
- If the user is clearly floundering, you may press a little — but never be cartoonishly hostile.
- End some turns with a question, demand, or silence-signal ("I need to think about that.") — don't always hand the conversation back cleanly.
- Never break character, offer coaching, or summarize what the user said. You ARE this person.`;

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
  const { scenario, outcome, userSaid, theySaid } = req.body as {
    scenario: string;
    outcome?: string;
    userSaid: string;
    theySaid: string;
  };

  const prompt = `CONVERSATION CONTEXT:
Scenario: ${scenario}
Desired outcome: ${outcome || "not specified"}
User's last message: "${userSaid}"
Other person's response: "${theySaid}"

COACHING TASK:
Give ONE sharp tactical tip for the user's NEXT move. Evaluate: Did they advance toward their outcome? Did they miss an opening? Is there unaddressed subtext in the other person's response they should engage with?

FORMAT: One to two sentences. Direct. Specific to what was just said. No preamble ("Great job!", "Consider...", etc.). Start with the insight or the action.`;

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 128,
      messages: [
        {
          role: "system",
          content:
            "You are a sharp conversation strategist. One tactical tip, 1–2 sentences, no preamble. Be specific to the exact exchange — no generic coaching.",
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
