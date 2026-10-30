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
  let body: { image?: string; text?: string; grams?: number };
  try { body = await req.json(); } catch { return out(400, { error: "bad_request" }); }
  const txt = String(body.text ?? "").trim().slice(0, 80);
  const img = (body.image ?? "").replace(/^data:image\/\w+;base64,/, "");
  if (!txt && (!img || img.length > 2_000_000)) return out(413, { error: "too_big" });
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
      contents: [{ parts: txt
        ? [{ text: `Give typical nutrition for one item: "${txt.replace(/"/g, "'")}", portion about ${Math.max(1, Math.min(2000, +(body.grams ?? 100)))} g. Return JSON {"items":[...]} with exactly that one item, grams set to that portion.` }]
        : [{ text: PROMPT }, { inline_data: { mime_type: "image/jpeg", data: img } }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0.2 },
    }),
  });
  if (g.status === 429) return out(429, { error: "global_limit" });
  if (!g.ok) return out(502, { error: "ai_failed" });
  try {
    const j = await g.json();
    const t = j.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    const items = (JSON.parse(t).items ?? []).slice(0, 8);
    return out(200, { items });
  } catch { return out(502, { error: "ai_failed" }); }
});
