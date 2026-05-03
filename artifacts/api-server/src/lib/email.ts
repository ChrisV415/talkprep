import sgMail from "@sendgrid/mail";

async function getCredentials(): Promise<{ apiKey: string; fromEmail: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error("SendGrid not configured");
  }

  const res = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=sendgrid`,
    {
      headers: {
        Accept: "application/json",
        "X-Replit-Token": xReplitToken,
      },
    },
  );

  const data = (await res.json()) as {
    items?: { settings: { api_key?: string; from_email?: string } }[];
  };
  const settings = data.items?.[0]?.settings;

  if (!settings?.api_key || !settings?.from_email) {
    throw new Error("SendGrid not connected");
  }

  return { apiKey: settings.api_key, fromEmail: settings.from_email };
}

export async function sendWelcomeEmail(
  toEmail: string,
  firstName: string,
): Promise<void> {
  const { apiKey, fromEmail } = await getCredentials();
  sgMail.setApiKey(apiKey);

  await sgMail.send({
    to: toEmail,
    from: fromEmail,
    subject: "Welcome to TalkPrep",
    text: `Hi ${firstName || "there"},\n\nWelcome to TalkPrep! You're ready to start preparing for your important conversations.\n\nTap "New Prep" to get started.\n\nThe TalkPrep team`,
    html: `<p>Hi ${firstName || "there"},</p><p>Welcome to TalkPrep! You're ready to start preparing for your important conversations.</p><p>Tap <strong>New Prep</strong> to get started.</p><p>The TalkPrep team</p>`,
  });
}

export async function sendSessionSummaryEmail(
  toEmail: string,
  scenario: string,
  scores: { clarity: number; composure: number; outcome_score: number },
): Promise<void> {
  const { apiKey, fromEmail } = await getCredentials();
  sgMail.setApiKey(apiKey);

  const avg = Math.round(
    (scores.clarity + scores.composure + scores.outcome_score) / 3,
  );

  await sgMail.send({
    to: toEmail,
    from: fromEmail,
    subject: `TalkPrep session: ${scenario}`,
    text: `Your session summary\n\nScenario: ${scenario}\nClarity: ${scores.clarity}/5 | Composure: ${scores.composure}/5 | Outcome: ${scores.outcome_score}/5\nOverall: ${avg}/5\n\nKeep practicing!`,
    html: `<h2>Your session summary</h2><p><strong>Scenario:</strong> ${scenario}</p><p>Clarity: ${scores.clarity}/5 &nbsp;|&nbsp; Composure: ${scores.composure}/5 &nbsp;|&nbsp; Outcome: ${scores.outcome_score}/5</p><p><strong>Overall: ${avg}/5</strong></p><p>Keep practicing!</p>`,
  });
}
