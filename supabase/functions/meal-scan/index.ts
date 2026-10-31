// meal-scan: photo -> foods with portions via Gemini. Key stays server-side. Photos are never stored.
const KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.5-flash-lite";
const USER_CAP = +(Deno.env.get("SCAN_USER_DAILY") ?? 10);
const GLOBAL_CAP = +(Deno.env.get("SCAN_GLOBAL_DAILY") ?? 400);
const SB = Deno.env.get("SUPABASE_URL")!, SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ORIGINS = ["https://myhealthyhabitsapp.com", "https://www.myhealthyhabitsapp.com", "https://myhealthyhabits.github.io"];
const cors = (o: string | null) => ({
  "Access-Control-Allow-Origin": o && (ORIGINS.includes(o) || o.startsWith("http://localhost")) ? o : ORIGINS[0],
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});
const PROMPT = `You are a nutrition assistant. Identify every distinct food or drink visible in this meal photo.
Estimate each portion using the plate, bowl, utensils and hands for scale. Use common US names (e.g. "grilled chicken breast", "white rice").
Return JSON only. If there is no food, return {"items":[]}. Max 8 items.`;
const SCHEMA = {
  type: "object",
  properties: {
    items: { type: "array", items: { type: "object", properties: {
      name: { type: "string" }, amount: { type: "number" }, unit: { type: "string" },
      grams: { type: "number" }, confidence: { type: "number", description: "0 to 1" },
      kcal: { type: "number" }, protein_g: { type: "number" }, carbs_g: { type: "number" },
      fat_g: { type: "number" }, fiber_g: { type: "number" },
    }, required: ["name", "amount", "unit", "grams", "confidence", "kcal", "protein_g", "carbs_g", "fat_g", "fiber_g"] } },
  },
  required: ["items"],
};
const IDEAS = { type: "object", properties: { ideas: { type: "array", items: { type: "object", properties: {
  title: { type: "string" }, emoji: { type: "string" }, why: { type: "string" }, items: SCHEMA.properties.items,
}, required: ["title", "emoji", "why", "items"] } } }, required: ["ideas"] };
const RECAP = { type: "object", properties: {
  headline: { type: "string" }, wins: { type: "array", items: { type: "string" } },
  tips: { type: "array", items: { type: "string" } }, streak: { type: "string" },
}, required: ["headline", "wins", "tips", "streak"] };
const PARSE = (t: string) => `The user described what they ate: "${t}". Split it into separate foods with the portion they said (or a typical portion if not said). Use common US names. Return JSON {"items":[...]} with typical nutrition for each portion. Max 8 items. If it is not food, return {"items":[]}.`;
const IDEA_P = (c: string) => `You are a friendly nutrition coach. Suggest exactly 3 different, realistic meal ideas for the user's upcoming meal using this context (JSON): ${c}
Each idea should fit within remainingCalories (aim for roughly the share given in targetCalories) and help reach remainingProtein. Never include anything in dislikes. Do not repeat dishes already eaten or suggested today (eatenToday, avoid). Vary cuisines and proteins. Keep it simple to make or buy. "why" is one short upbeat sentence. List each idea's foods as items with portions and nutrition.`;
const RECAP_P = (c: string) => `You are a warm, upbeat health coach. Write a short weekly recap from this data (JSON): ${c}
headline: one fun sentence. wins: 2-3 short specific wins. tips: 1-2 gentle, practical tips (no shaming, no medical advice). streak: one short line about streaks. Keep every line under 120 characters. Use at most one emoji per line.`;
async function sha(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s + "mhh"));
  return [...new Uint8Array(b)].slice(0, 12).map((x) => x.toString(16).padStart(2, "0")).join("");
}
Deno.serve(async (req) => {
  const H = { ...cors(req.headers.get("origin")), "Content-Type": "application/json" };
  const out = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: H });
  if (req.method === "OPTIONS") return new Response("ok", { headers: H });
  if (req.method !== "POST") return out(405, { error: "method" });
  if (!KEY) return out(503, { error: "not_configured" });
  let body: { image?: string; text?: string; grams?: number; mode?: string; ctx?: unknown };
  try { body = await req.json(); } catch { return out(400, { error: "bad_request" }); }
  const txt = String(body.text ?? "").trim().slice(0, 80);
  const img = (body.image ?? "").replace(/^data:image\/\w+;base64,/, "");
  const mode = ["parse", "ideas", "recap"].includes(String(body.mode)) ? String(body.mode) : "";
  const ptxt = String(body.text ?? "").trim().slice(0, 300), ctx = JSON.stringify(body.ctx ?? {}).slice(0, 2500);
  if (mode === "parse" && !ptxt) return out(400, { error: "bad_request" });
  if (!mode && !txt && (!img || img.length > 2_000_000)) return out(413, { error: "too_big" });
  // who: signed-in user id if the JWT is a real user, else hashed IP
  let who = "ip:" + await sha((req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim());
  const auth = req.headers.get("authorization") ?? "";
  if (auth.startsWith("Bearer ")) {
    try {
      const r = await fetch(SB + "/auth/v1/user", { headers: { apikey: SR, authorization: auth } });
      if (r.ok) { const u = await r.json(); if (u?.id) who = "u:" + u.id; }
    } catch { /* treat as guest */ }
  }
  const lim = await fetch(SB + "/rest/v1/rpc/scan_take", {
    method: "POST", headers: { apikey: SR, authorization: "Bearer " + SR, "Content-Type": "application/json" },
    body: JSON.stringify({ p_who: who, p_user_cap: USER_CAP, p_global_cap: GLOBAL_CAP }),
  });
  if (!lim.ok) return out(503, { error: "limit_check" });
  const st = await lim.json();
  if (st !== "ok") return out(429, { error: st === "user" ? "user_limit" : "global_limit", cap: USER_CAP });
  const g = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
    body: JSON.stringify({
      contents: [{ parts: mode === "parse" ? [{ text: PARSE(ptxt.replace(/"/g, "'")) }] : mode === "ideas" ? [{ text: IDEA_P(ctx) }] : mode === "recap" ? [{ text: RECAP_P(ctx) }] : txt
        ? [{ text: `Give typical nutrition for one item: "${txt.replace(/"/g, "'")}", portion about ${Math.max(1, Math.min(2000, +(body.grams ?? 100)))} g. Return JSON {"items":[...]} with exactly that one item, grams set to that portion.` }]
        : [{ text: PROMPT }, { inline_data: { mime_type: "image/jpeg", data: img } }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: mode === "ideas" ? IDEAS : mode === "recap" ? RECAP : SCHEMA, temperature: mode === "ideas" || mode === "recap" ? 0.8 : 0.2 },
    }),
  });
  if (g.status === 429) return out(429, { error: "global_limit" });
  if (!g.ok) return out(502, { error: "ai_failed" });
  try {
    const j = await g.json();
    const t = j.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    const J = JSON.parse(t);
    if (mode === "ideas") return out(200, { ideas: (J.ideas ?? []).slice(0, 3) });
    if (mode === "recap") return out(200, J);
    const items = (J.items ?? []).slice(0, 8);
    return out(200, { items });
  } catch { return out(502, { error: "ai_failed" }); }
});
