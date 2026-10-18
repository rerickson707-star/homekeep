// supabase/functions/home-invite/index.ts
// Invites one person to one or more homes the signed-in owner has. Replaces the old shared-access function.
//
// Rules this function keeps:
//  - The owner is read from the login token. The browser never sends an owner id, name or address.
//  - Pro only. The plan is read from the oldest home the owner has (same rule as the rest of the app).
//  - Every home in the request must belong to the signed-in owner.
//  - At most MAX_PER_HOME people (pending or active) per home.
//  - The invite email is built here, with the owner's name and the addresses read from the database and HTML-escaped.
//
// Needs the secrets DB_URL, SERVICE_ROLE_KEY and RESEND_API_KEY (already set).
// Deploy: npx supabase functions deploy home-invite --project-ref hjkyameroqufaojuerns
// (JWT verification stays ON.)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("DB_URL")!;
const SERVICE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;
const FROM = "Steadwell <hello@trysteadwell.app>";
const MAX_PER_HOME = 10;
const MAX_HOMES = 3;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const ALLOWED_ORIGINS = [
  /^https:\/\/(www\.)?trysteadwell\.app$/,
  /^https:\/\/homekeep-[a-z0-9-]+-rerickson707-star1\.vercel\.app$/,   // dev branch + per-deployment preview URLs
  /^http:\/\/localhost:\d+$/,
];
function corsFor(origin: string): Record<string, string> {
  const h: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (ALLOWED_ORIGINS.some((re) => re.test(origin))) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Result = { propertyId: string; status: "invited" | "resent" | "already" | "full" | "not_yours" };

serve(async (req) => {
  const cors = corsFor(req.headers.get("origin") || "");
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  // Who is asking: from the login token only.
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "not_signed_in" });
  const { data: u, error: uErr } = await admin.auth.getUser(token);
  if (uErr || !u?.user) return json(401, { error: "not_signed_in" });
  const ownerId = u.user.id;
  const ownerEmail = String(u.user.email || "").toLowerCase();

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json(400, { error: "bad_request" }); }
  const memberEmail = String(b?.memberEmail ?? "").trim().toLowerCase();
  const level = b?.level === "full" ? "full" : "limited";
  const ids = Array.isArray(b?.propertyIds) ? [...new Set((b.propertyIds as unknown[]).map(String))] : [];
  if (!EMAIL_RE.test(memberEmail) || memberEmail.length > 254) return json(400, { error: "bad_email" });
  if (memberEmail === ownerEmail) return json(400, { error: "self_invite" });
  if (ids.length < 1 || ids.length > MAX_HOMES || !ids.every((x) => UUID_RE.test(x))) return json(400, { error: "bad_request" });

  try {
    // Which plan: the oldest home this person owns.
    const { data: mine, error: pErr } = await admin
      .from("profiles").select("id, plan, name, address").eq("user_id", ownerId)
      .order("created_at", { ascending: true }).order("id", { ascending: true });
    if (pErr) { console.error("[home-invite] profile lookup failed:", pErr.message); return json(500, { error: "invite_failed" }); }
    const plan = String(mine?.[0]?.plan || "free");
    if (plan !== "pro") return json(403, { error: "plan_required" });
    const ownerName = String(mine?.[0]?.name || "").trim() || ownerEmail;

    const owned = new Map((mine || []).map((p) => [String(p.id), p]));
    const results: Result[] = [];
    const sentHomes: { id: string; address: string }[] = [];

    for (const id of ids) {
      const home = owned.get(id);
      if (!home) { results.push({ propertyId: id, status: "not_yours" }); continue; }

      const { data: existing, error: eErr } = await admin
        .from("home_members").select("id, status").eq("property_id", id).eq("member_email", memberEmail).maybeSingle();
      if (eErr) throw new Error("lookup: " + eErr.message);

      if (existing) {
        if (existing.status === "accepted") { results.push({ propertyId: id, status: "already" }); continue; }
        const { error: upErr } = await admin.from("home_members").update({ role: level }).eq("id", existing.id).eq("owner_id", ownerId);
        if (upErr) throw new Error("update: " + upErr.message);
        results.push({ propertyId: id, status: "resent" });
      } else {
        const { count, error: cErr } = await admin.from("home_members").select("id", { count: "exact", head: true }).eq("property_id", id);
        if (cErr) throw new Error("count: " + cErr.message);
        if ((count || 0) >= MAX_PER_HOME) { results.push({ propertyId: id, status: "full" }); continue; }
        const { error: inErr } = await admin.from("home_members").insert([{
          property_id: id, owner_id: ownerId, member_email: memberEmail, role: level, status: "pending",
        }]);
        if (inErr) throw new Error("insert: " + inErr.message);
        results.push({ propertyId: id, status: "invited" });
      }
      sentHomes.push({ id, address: String(home.address || "your home") });
    }

    if (sentHomes.length === 0) return json(200, { ok: true, sent: false, results });

    if (!RESEND_API_KEY) { console.error("[home-invite] RESEND_API_KEY missing"); return json(500, { error: "invite_failed", results }); }
    const many = sentHomes.length > 1;
    const acceptUrl = `https://www.trysteadwell.app/?shared_invite=${encodeURIComponent(sentHomes[0].id)}&email=${encodeURIComponent(memberEmail)}`;
    const homesHtml = sentHomes.map((h) => `<li style="margin:0 0 6px">${esc(h.address)}</li>`).join("");
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
  body{font-family:'Helvetica Neue',Arial,sans-serif;background:#F4EDDF;margin:0;padding:40px 20px}
  .card{background:#fff;max-width:520px;margin:0 auto;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.08)}
  .header{background:#234A3D;padding:32px;text-align:center}
  .logo{color:#F4EDDF;font-size:22px;font-weight:600;letter-spacing:-.3px}
  .body{padding:32px}
  .title{font-size:22px;font-weight:600;color:#2A2723;margin:0 0 12px}
  .text{font-size:15px;color:#5A534B;line-height:1.6;margin:0 0 20px}
  .btn{display:block;background:#C16140;color:#fff;text-decoration:none;text-align:center;padding:14px 28px;border-radius:10px;font-size:16px;font-weight:600}
  .footer{padding:20px 32px;border-top:1px solid #E8E0D0;font-size:12px;color:#A8A09A;text-align:center}
</style></head>
<body>
  <div class="card">
    <div class="header"><div class="logo">Steadwell</div></div>
    <div class="body">
      <div class="title">${esc(ownerName)} invited you to ${many ? "their homes" : "their home"}</div>
      <div class="text">You've been invited to work on ${many ? "these homes" : "this home"} in Steadwell, home management software that tracks maintenance, equipment, warranties and costs:</div>
      <ul class="text" style="padding-left:20px;margin:0 0 20px">${homesHtml}</ul>
      <div class="text">New to Steadwell? Create a free account using <strong>${esc(memberEmail)}</strong>. Already have one? Sign in with that email. ${many ? "The homes" : "The home"} will appear automatically.</div>
      <a href="${acceptUrl}" class="btn">Open Steadwell</a>
    </div>
    <div class="footer">Invited to ${esc(memberEmail)} &middot; <a href="https://www.trysteadwell.app" style="color:#A8A09A">trysteadwell.app</a></div>
  </div>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [memberEmail], subject: `${ownerName} invited you to ${many ? "their homes" : "their home"} on Steadwell`, html }),
    });
    if (!res.ok) {
      console.error("[home-invite] Resend status:", res.status);
      return json(502, { error: "email_failed", results });
    }
    return json(200, { ok: true, sent: true, results });
  } catch (e) {
    console.error("[home-invite] error:", (e as Error)?.message);
    return json(500, { error: "invite_failed" });
  }
});
