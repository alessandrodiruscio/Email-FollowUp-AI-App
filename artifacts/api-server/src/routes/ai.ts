import { Router, type IRouter } from "express";
import { GenerateEmailBody, GenerateFollowUpBody } from "@workspace/api-zod";
import { OpenAI } from "openai";

const router: IRouter = Router();

function getOpenAIClient() {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OpenAI API key not configured. Please set AI_INTEGRATIONS_OPENAI_API_KEY or OPENAI_API_KEY.");
  }

  return new OpenAI({ baseURL, apiKey });
}

function parseJsonFromContent(content: string, fallbackSubject: string): { subject: string; body: string } {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { subject: fallbackSubject, body: content };
  } catch {
    return { subject: fallbackSubject, body: content };
  }
}

router.post("/ai/generate-email", async (req, res) => {
  let data;
  try {
    data = GenerateEmailBody.parse(req.body);
  } catch (err) {
    res.status(400).json({ error: "Invalid request body", detail: String(err) });
    return;
  }

  let openai;
  try {
    openai = getOpenAIClient();
  } catch {
    res.status(503).json({ error: "AI service is not configured. Please connect the OpenAI integration." });
    return;
  }

  const systemPrompt = `You are an expert email copywriter. Generate professional, concise, and effective emails. 
DO NOT include any footer, signature, or closing with name/title/social media links - the recipient already has their own email footer.
Respond ONLY with a JSON object containing "subject" and "body" fields. No markdown, no explanation.`;

  const userPrompt = `Write an email with these details:
- Purpose: ${data.description}
${data.recipientName ? `- Recipient name: ${data.recipientName}` : ""}
${data.senderName ? `- Sender name: ${data.senderName}` : ""}
- Tone: ${data.tone ?? "professional"}

Return JSON: {"subject": "...", "body": "..."}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const parsed = parseJsonFromContent(content, "Generated email");
    return res.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[ai] generate-email failed:", message);
    return res.status(502).json({ error: "AI generation failed. Please try again.", detail: message });
  }
});

router.post("/ai/generate-followup", async (req, res) => {
  let data;
  try {
    data = GenerateFollowUpBody.parse(req.body);
  } catch (err) {
    res.status(400).json({ error: "Invalid request body", detail: String(err) });
    return;
  }

  let openai;
  try {
    openai = getOpenAIClient();
  } catch {
    res.status(503).json({ error: "AI service is not configured. Please connect the OpenAI integration." });
    return;
  }

  const systemPrompt = `You are an expert email copywriter specializing in follow-up emails. 
Write follow-ups that are concise, non-pushy, and add value. 
Respond ONLY with a JSON object containing "subject" and "body" fields. No markdown, no explanation.`;

  const userPrompt = `Write follow-up #${data.followUpNumber} for this email:

Original Subject: ${data.originalSubject}
Original Body:
${data.originalBody}

${data.description ? `Additional context: ${data.description}` : ""}

Requirements:
- Keep it shorter than the original
- Reference the original email naturally
- Be professional but not pushy
- Add a clear call to action

Return JSON: {"subject": "...", "body": "..."}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const parsed = parseJsonFromContent(content, `Follow-up #${data.followUpNumber}`);
    return res.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[ai] generate-followup failed:", message);
    return res.status(502).json({ error: "AI generation failed. Please try again.", detail: message });
  }
});

export default router;
