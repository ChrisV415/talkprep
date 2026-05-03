import { Router } from "express";
import OpenAI from "openai";
import { requireAuth } from "../middlewares/requireAuth";
import { rateLimiter } from "../middlewares/rateLimiter";

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

router.post("/talkprep/generate", requireAuth, rateLimiter, async (req, res) => {
  startSSE(res);
  const { scenario, who, situation, outcome, tone } = req.body as {
    scenario: string;
    who: string;
    situation: string;
    outcome?: string;
    tone?: string;
  };

  const systemPrompt = `You are an expert conversation coach helping someone prepare for a difficult conversation.
Generate a structured preparation guide with EXACTLY these sections (use these exact headers):

OPENING LINE
---
Write 2-3 specific opening lines the person could actually say. Make them natural and genuine — not robotic scripts.

KEY POINTS
---
List 3-5 specific points they should make. Be concrete and direct, not generic.

HOW THEY MIGHT RESPOND
---
Describe 3-4 realistic reactions they might get, and a specific response to each one.

IF IT GOES WRONG
---
What to do if the conversation gets heated, they shut down, or veers off track. 2-3 specific strategies.

WHAT TO REMEMBER
---
2-3 key mindset reminders for this specific situation. Personal, not generic platitudes.

Keep each section focused and actionable.`;

  const userPrompt = `Scenario: ${scenario}
Who: ${who}
Situation: ${situation}
Desired outcome: ${outcome || "not specified"}
Preferred tone: ${tone || "balanced"}

Generate their conversation prep guide.`;

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
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
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: "Failed to generate prep" })}\n\n`);
    res.end();
  }
});

router.post("/talkprep/roleplay", requireAuth, rateLimiter, async (req, res) => {
  startSSE(res);
  const { messages, systemContext } = req.body as {
    messages: { role: "user" | "assistant"; content: string }[];
    systemContext: string;
  };

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: systemContext },
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
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: "Failed to respond" })}\n\n`);
    res.end();
  }
});

router.post("/talkprep/nudge", requireAuth, rateLimiter, async (req, res) => {
  startSSE(res);
  const { scenario, outcome, userSaid, theySaid } = req.body as {
    scenario: string;
    outcome?: string;
    userSaid: string;
    theySaid: string;
  };

  const prompt = `The user is practicing this conversation:
Scenario: ${scenario} | Desired outcome: ${outcome || "not specified"}
User's last message: "${userSaid}"
Other person's response: "${theySaid}"

Give ONE very short, specific strategic coaching tip (1-2 sentences max) to help the user in their NEXT message. Focus on strategy and outcome — NOT on delivery, tone, or filler words. Be direct. If they handled it well, say so briefly and suggest how to advance. If they missed an opportunity, name it specifically.
Format: Just the tip. No preamble. No labels.`;

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content:
            "You are a strategic conversation coach. Give one sharp, specific tactical tip in 1-2 sentences. No filler, no preamble.",
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
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: "Failed to generate nudge" })}\n\n`);
    res.end();
  }
});

router.post("/talkprep/annotate", requireAuth, rateLimiter, async (req, res) => {
  startSSE(res);
  const { scenario, outcome, context, message } = req.body as {
    scenario: string;
    outcome?: string;
    context: string;
    message: string;
  };

  const prompt = `Analyzing one message in a practice conversation:
Scenario: ${scenario} | Desired outcome: ${outcome || "not specified"}
Context:
${context}
The message being analyzed (User): "${message}"

Rate this message:
- Was it GOOD (handled well, moved toward the goal)?
- Or was there a MISSED OPPORTUNITY (could have been stronger)?

Reply with EXACTLY this format:
RATING: GOOD or MISSED
ANNOTATION: One specific sentence explaining what was good or what the missed opportunity was, and (if missed) what they could say instead.`;

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content:
            "You annotate practice conversation messages with specific, tactical feedback. Be concise and direct.",
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
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: "Failed to annotate" })}\n\n`);
    res.end();
  }
});

router.post("/talkprep/debrief", requireAuth, rateLimiter, async (req, res) => {
  startSSE(res);
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

  const prompt = `Person had this difficult conversation:
Scenario: ${scenario} | Who: ${who} | Situation: ${situation}
Outcome: ${outcome} | What happened: ${happened} | Would do differently: ${different || "nothing specific"}
Scores - Clarity: ${scores?.clarity || "not scored"}/5 | Composure: ${scores?.composure || "not scored"}/5 | Outcome: ${scores?.outcome_score || "not scored"}/5

Give a warm, specific debrief in 3-5 sentences. What did they handle well? What's one thing to remember or do differently? Like a trusted friend — honest but kind. Reference their scores if available.`;

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content:
            "You are a warm, honest conversation coach giving a brief debrief. Specific, not generic. Like a trusted friend. 3-5 sentences.",
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
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: "Failed to generate debrief" })}\n\n`);
    res.end();
  }
});

export default router;
