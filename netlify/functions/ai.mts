import Anthropic from "@anthropic-ai/sdk";
import type { Config, Context } from "@netlify/functions";

// Daily Bread AI endpoint: streams Claude's answer back to the app.
// Uses Netlify AI Gateway (credentials are injected automatically).
const MODELS: Record<string, { model: string; max_tokens: number }> = {
  quick: { model: "claude-haiku-5-5", max_tokens: 2500 },
  default: { model: "claude-sonnet-5-5", max_tokens: 8000 },
  complex: { model: "claude-sonnet-5-5", max_tokens: 8000 },
};

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") return Response.json({ error: "method_not_allowed" }, { status: 405 });

  // Private app code so strangers can't spend your AI credits.
  const appCode = Netlify.env.get("APP_CODE");
  if (appCode && (req.headers.get("x-app-code") || "").trim().toLowerCase() !== appCode.trim().toLowerCase()) {
    return Response.json({ error: "bad_code" }, { status: 401 });
  }

  if (!Netlify.env.get("ANTHROPIC_API_KEY") && !Netlify.env.get("ANTHROPIC_BASE_URL")) {
    return Response.json({ error: "gateway_inactive" }, { status: 503 });
  }

  let body: any;
  try { body = await req.json(); } catch { return Response.json({ error: "bad_json" }, { status: 400 }); }

  const messages = (Array.isArray(body?.messages) ? body.messages : [])
    .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-20)
    .map((m: any) => ({ role: m.role, content: m.content.slice(0, 40000) }));
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return Response.json({ error: "bad_messages" }, { status: 400 });
  }
  // The API needs the first message to be from the user.
  while (messages.length && messages[0].role !== "user") messages.shift();

  const { model, max_tokens } = MODELS[body?.tier] || MODELS.default;
  const client = new Anthropic();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const s = client.messages.stream({ model, max_tokens, messages });
        for await (const ev of s) {
          if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(ev.delta.text));
          }
        }
      } catch (e: any) {
        console.error("AI error", e?.status, e?.message);
        controller.enqueue(encoder.encode("\n[[ERROR]]" + (e?.status === 429 ? "rate_limited" : "failed")));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
};

export const config: Config = {
  path: "/api/ai",
  method: "POST",
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 30 },
};
