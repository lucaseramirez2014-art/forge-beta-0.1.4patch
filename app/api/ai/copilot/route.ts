import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CopilotRequest = {
  message?: unknown;
  currentCampaign?: unknown;
  currentStage?: unknown;
  completedLessons?: unknown;
  xp?: unknown;
  level?: unknown;
  userGoal?: unknown;
};

type CopilotReply = { reply: string; recommendedLesson: string | null; reason: string };

const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const text = (value: unknown, fallback = "") => typeof value === "string" ? value.trim().slice(0, 1200) : fallback;
const number = (value: unknown, fallback = 0) => typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : fallback;

function readReply(content: string): { result: CopilotReply; parsed: boolean } {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as Partial<CopilotReply>;
    if (typeof parsed.reply === "string" && parsed.reply.trim()) return { result: { reply: parsed.reply.trim().slice(0, 800), recommendedLesson: typeof parsed.recommendedLesson === "string" && parsed.recommendedLesson.trim() ? parsed.recommendedLesson.trim().slice(0, 160) : null, reason: typeof parsed.reason === "string" ? parsed.reason.trim().slice(0, 400) : "" }, parsed: true };
  } catch { /* Plain text is a valid Copilot fallback. */ }
  return { result: { reply: cleaned.slice(0, 1200), recommendedLesson: null, reason: "" }, parsed: false };
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return json({ error: "Copilot is not configured on this deployment yet." }, 503);

  let input: CopilotRequest;
  try { input = await request.json() as CopilotRequest; } catch { return json({ error: "Please send a valid JSON request." }, 400); }

  const message = text(input.message);
  if (!message) return json({ error: "Enter a question for the Copilot." }, 400);
  const currentCampaign = text(input.currentCampaign, "No campaign selected") || "No campaign selected";
  const currentStage = text(input.currentStage, "No stage selected") || "No stage selected";
  const completedLessons = Array.isArray(input.completedLessons) ? input.completedLessons.filter((lesson): lesson is string => typeof lesson === "string").map((lesson) => lesson.trim().slice(0, 160)).filter(Boolean).slice(0, 30) : [];
  const userGoal = text(input.userGoal);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openrouter/free",
        temperature: 0.3,
        messages: [
          { role: "system", content: "You are FORGE Copilot, a concise productivity and learning guide inside FORGE. Use only the supplied campaign progress. Prioritize existing lessons and never claim a lesson is complete unless it is listed. Recommend one actionable next step when possible. Return ONLY valid JSON: {\"reply\": string, \"recommendedLesson\": string|null, \"reason\": string}." },
          { role: "user", content: JSON.stringify({ message, currentCampaign, currentStage, completedLessons, xp: number(input.xp), level: number(input.level, 1), userGoal: userGoal || null }) },
        ],
      }),
    });
    if (process.env.NODE_ENV !== "production") console.info("[FORGE Copilot] OpenRouter status", response.status);
    if (!response.ok) {
      if (response.status === 429) return json({ error: "Copilot is busy right now. Please try again shortly." }, 429);
      return json({ error: "Copilot is temporarily unavailable. Please try again." }, 502);
    }
    const rawBody = await response.text();
    if (!rawBody.trim()) return json({ error: "Copilot returned no response. Please try again." }, 502);
    let payload: { choices?: Array<{ message?: { content?: unknown } }> } | null = null;
    try { payload = JSON.parse(rawBody) as { choices?: Array<{ message?: { content?: unknown } }> }; } catch { /* Fall back to the non-empty provider body below. */ }
    const content = payload?.choices?.[0]?.message?.content;
    const modelText = typeof content === "string" ? content : "";
    if (process.env.NODE_ENV !== "production") console.info("[FORGE Copilot] choices", Boolean(payload?.choices?.length), "message.content", Boolean(modelText.trim()));
    if (payload && !modelText.trim()) return json({ error: "Copilot returned no response content. Please try again." }, 502);
    const parsed = readReply(modelText || rawBody);
    if (process.env.NODE_ENV !== "production") console.info("[FORGE Copilot] structured JSON parsed", parsed.parsed);
    return json(parsed.result);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return json({ error: "Copilot took too long to respond. Please try again." }, 504);
    return json({ error: "Copilot could not be reached. Please try again." }, 502);
  } finally { clearTimeout(timeout); }
}
