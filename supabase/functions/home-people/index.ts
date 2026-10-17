// supabase/functions/home-people/index.ts
// Invite, change and remove the people on a Steadwell account. Replaces the old shared-access function.
//
// Who may call it: the account owner, or an accepted Admin of the account.
//   - Owner: can invite Admins, Full access and Tasks & assets people, and manage all of them.
//   - Admin: can invite and manage Full access and Tasks & assets people. Cannot create or remove Admins.
// Rules this function keeps:
//  - The caller is read from the login token. The browser never sends an owner id, name or address.
//  - Pro only. The plan is read from the account owner's oldest home (same rule as the rest of the app).
//  - Every home in a request must belong to the account the caller owns or administers.
//  - No limit on how many people a home can have (pending or active), and no limit on Admins.
//  - Emails are built here from database values and HTML-escaped.
//
// Run steadwell-admin-level.sql FIRST.
// Needs the secrets DB_URL, SERVICE_ROLE_KEY and RESEND_API_KEY (already set).
// Deploy: npx supabase functions deploy home-people --project-ref hjkyameroqufaojuerns
// (JWT verification stays ON.)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("DB_URL")!;
const SERVICE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;
const FROM = "Steadwell <hello@trysteadwell.app>";
const MAX_EMAILS = 50; // per request, so one pasted list cannot send a flood of emails; send as many batches as needed
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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const LEVEL_LABEL: Record<string, string> = { admin: "Admin", full: "Full access", limited: "Tasks & assets" };

type Home = { id: string; user_id: string; name: string | null; address: string | null; plan: string | null; created_at: string };
class Fail extends Error { constructor(public status: number, public code: string) { super(code); } }

// Everything the caller may manage: the homes they own, and every home of any account they administer.
async function loadContext(userId: string, userEmail: string) {
  const { data: owned, error: e1 } = await admin.from("profiles").select("id, user_id, name, address, plan, created_at")
    .eq("user_id", userId).order("created_at", { ascending: true }).order("id", { ascending: true });
  if (e1) throw new Error("profiles: " + e1.message);

  const ownerIds = new Set<string>();
  const [a, b] = await Promise.all([
    admin.from("account_admins").select("owner_id").eq("status", "accepted").eq("member_id", userId),
    admin.from("account_admins").select("owner_id").eq("status", "accepted").eq("member_email", userEmail),
  ]);
  if (a.error || b.error) throw new Error("admins: " + (a.error?.message || b.error?.message));
  [...(a.data || []), ...(b.data || [])].forEach((r) => ownerIds.add(String(r.owner_id)));
  ownerIds.delete(userId);

  let adminHomes: Home[] = [];
  if (ownerIds.size > 0) {
    const { data, error } = await admin.from("profiles").select("id, user_id, name, address, plan, created_at")
      .in("user_id", [...ownerIds]).order("created_at", { ascending: true }).order("id", { ascending: true });
    if (error) throw new Error("admin homes: " + error.message);
    adminHomes = (data || []) as Home[];
  }
  const homes = new Map<string, Home>();
  [...((owned || []) as Home[]), ...adminHomes].forEach((h) => homes.set(String(h.id), h));

  // The plan of an account is the plan of its oldest home.
  const planOf = new Map<string, string>();
  const nameOf = new Map<string, string>();
  [...((owned || []) as Home[]), ...adminHomes].forEach((h) => {
    if (!planOf.has(h.user_id)) { planOf.set(h.user_id, String(h.plan || "free")); nameOf.set(h.user_id, String(h.name || "").trim()); }
  });
  return { owned: (owned || []) as Home[], homes, planOf, nameOf };
}

async function sendEmail(to: string, subject: string, html: string, text: string) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY missing");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, text }),
  });
  if (!res.ok) { console.error("[home-people] Resend status:", res.status); throw new Error("email_failed"); }
}

// ---- Email layout -------------------------------------------------------------------------
// Built from tables with every style inline, because Gmail, Outlook and Apple Mail each drop
// or override <style> rules (that is what turned the button text blue). Addresses and emails
// are wrapped in our own links so Gmail's automatic blue underlined links do not take over.
const C = { cream: "#F4EDDF", pine: "#234A3D", clay: "#C16140", ink: "#2A2723", body: "#4A443E", muted: "#7A7168", panel: "#F7F2E8", line: "#E8E0D0" };
const FONT = "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";
const LEVEL_DESC: Record<string, string> = {
  admin: "Full access to every home, plus inviting and managing people.",
  full: "Tasks, assets, service history, contractors, expenses and projects.",
  limited: "Tasks, assets, service history and contractors. Expenses and projects stay private.",
};
const plainLink = (href: string, text: string, extra = "") =>
  `<a href="${esc(href)}" style="color:${C.ink};text-decoration:none;${extra}">${text}</a>`;
const mapLink = (addr: string) => plainLink(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`, esc(addr), "font-weight:700;");
const mailLink = (e: string) => plainLink(`mailto:${e}`, esc(e), "font-weight:700;");
const field = (label: string, valueHtml: string, last = false) =>
  `<tr><td style="padding:0 0 ${last ? 0 : 16}px"><div style="font:13px/1.4 ${FONT};color:${C.muted};margin:0 0 3px">${label}</div><div style="font:16px/1.45 ${FONT};color:${C.ink}">${valueHtml}</div></td></tr>`;

function wrap(opts: { title: string; intro: string; fields: string; memberEmail: string; inviter: string; preheader: string }) {
  const { title, intro, fields, memberEmail, inviter, preheader } = opts;
  const link = `https://www.trysteadwell.app/?shared_invite=1&email=${encodeURIComponent(memberEmail)}`;
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${title}</title></head>
<body style="margin:0;padding:0;background:${C.cream}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.cream}">${esc(preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.cream}" style="background:${C.cream}"><tr><td align="center" style="padding:32px 14px">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
    <tr><td align="center" bgcolor="${C.pine}" style="background:${C.pine};padding:28px 24px 26px">
      <a href="https://www.trysteadwell.app" style="text-decoration:none"><img src="https://www.trysteadwell.app/icon-192.png" width="56" height="56" alt="Steadwell" style="display:block;margin:0 auto 12px;width:56px;height:56px;border-radius:14px;border:0;color:${C.cream};font:700 14px/56px ${FONT}"></a>
      <span style="font:700 24px/1 ${SERIF};color:${C.cream};letter-spacing:.2px">Steadwell</span>
    </td></tr>
    <tr><td style="padding:36px 36px 8px">
      <h1 style="margin:0 0 14px;font:700 26px/1.25 ${SERIF};color:${C.ink}">${title}</h1>
      <p style="margin:0 0 24px;font:16px/1.6 ${FONT};color:${C.body}">${intro}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.panel}" style="background:${C.panel};border-radius:12px"><tr><td style="padding:20px 22px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${fields}</table>
      </td></tr></table>
    </td></tr>
    <tr><td style="padding:28px 36px 8px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td align="center" bgcolor="${C.clay}" style="background:${C.clay};border-radius:10px">
          <a href="${link}" style="display:block;padding:16px 24px;font:700 17px/1.2 ${FONT};color:#ffffff !important;text-decoration:none"><span style="color:#ffffff">Open Steadwell</span></a>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:18px 36px 34px">
      <p style="margin:0;font:14px/1.6 ${FONT};color:${C.body}">Sign in with ${mailLink(memberEmail)}, or create a free account with it. Your invitation will already be there.</p>
    </td></tr>
    <tr><td style="padding:18px 36px 24px;border-top:1px solid ${C.line}">
      <p style="margin:0;font:12px/1.6 ${FONT};color:${C.muted};text-align:center">${esc(inviter)} entered your email address to send this invitation. If you were not expecting it, you can ignore this message.<br>Steadwell &middot; ${plainLink("https://www.trysteadwell.app", "trysteadwell.app", `color:${C.muted};text-decoration:underline`)}</p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

async function sendHomeInvite(to: string, inviter: string, level: string, addresses: string[]) {
  const many = addresses.length > 1;
  const lv = LEVEL_LABEL[level] ? level : "limited";
  const homesHtml = addresses.map((a) => `<div style="margin:0 0 4px">${mapLink(a)}</div>`).join("");
  const html = wrap({
    title: `${esc(inviter)} invited you to ${many ? "their homes" : "their home"}`,
    intro: `${esc(inviter)} added you to ${many ? "these homes" : "this home"} on Steadwell, where they keep track of maintenance, equipment, warranties and costs.`,
    fields: field(many ? "Homes" : "Home", homesHtml) + field("Your access", `<strong>${esc(LEVEL_LABEL[lv])}</strong><div style="font:14px/1.5 ${FONT};color:${C.body};margin-top:2px">${esc(LEVEL_DESC[lv])}</div>`, true),
    memberEmail: to, inviter, preheader: `Open Steadwell with ${to} to see ${many ? "your homes" : "your home"}.`,
  });
  const text = `${inviter} invited you to ${many ? "their homes" : "their home"} on Steadwell.\n\n${many ? "Homes" : "Home"}:\n${addresses.join("\n")}\n\nYour access: ${LEVEL_LABEL[lv]}. ${LEVEL_DESC[lv]}\n\nSign in with ${to}, or create a free account with it, at https://www.trysteadwell.app/ and your invitation will already be there.\n\nIf you were not expecting this, you can ignore it.`;
  await sendEmail(to, `${inviter} invited you to ${many ? "their homes" : "their home"} on Steadwell`, html, text);
}
async function sendAdminInvite(to: string, owner: string) {
  const html = wrap({
    title: `${esc(owner)} invited you as an Admin`,
    intro: `${esc(owner)} asked you to help run their Steadwell account, where they keep track of maintenance, equipment, warranties and costs for their homes.`,
    fields: field("Account", `${esc(owner)}&rsquo;s Steadwell account`) + field("Your access", `<strong>Admin</strong><div style="font:14px/1.5 ${FONT};color:${C.body};margin-top:2px">${esc(LEVEL_DESC.admin)}</div>`, true),
    memberEmail: to, inviter: owner, preheader: `Open Steadwell with ${to} to start as an Admin.`,
  });
  const text = `${owner} invited you as an Admin on Steadwell.\n\nYour access: Admin. ${LEVEL_DESC.admin}\n\nSign in with ${to}, or create a free account with it, at https://www.trysteadwell.app/ and your invitation will already be there.\n\nIf you were not expecting this, you can ignore it.`;
  await sendEmail(to, `${owner} invited you as an Admin on Steadwell`, html, text);
}

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
  const userId = u.user.id;
  const userEmail = String(u.user.email || "").toLowerCase();

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json(400, { error: "bad_request" }); }
  const action = String(b?.action ?? "");

  try {
    const ctx = await loadContext(userId, userEmail);
    const isOwner = ctx.owned.length > 0;
    const meta = (u.user.user_metadata || {}) as Record<string, unknown>;
    const inviterName = String(meta.full_name || meta.name || "").trim() || (isOwner ? ctx.nameOf.get(userId) : "") || userEmail.split("@")[0];

    const ownerEmails = new Map<string, string>();
    const emailOfOwner = async (ownerId: string) => {
      if (ownerId === userId) return userEmail;
      if (!ownerEmails.has(ownerId)) {
        const { data } = await admin.auth.admin.getUserById(ownerId);
        ownerEmails.set(ownerId, String(data?.user?.email || "").toLowerCase());
      }
      return ownerEmails.get(ownerId)!;
    };

    const parseEmail = (v: unknown) => String(v ?? "").trim().toLowerCase();
    const homesFrom = (v: unknown): Home[] => {
      const ids = Array.isArray(v) ? [...new Set((v as unknown[]).map(String))] : [];
      if (ids.length < 1 || ids.length > MAX_HOMES || !ids.every((x) => UUID_RE.test(x))) throw new Fail(400, "bad_request");
      return ids.map((id) => {
        const h = ctx.homes.get(id);
        if (!h) throw new Fail(403, "not_yours");
        return h;
      });
    };
    const needPro = (homes: Home[]) => { if (homes.some((h) => ctx.planOf.get(h.user_id) !== "pro")) throw new Fail(403, "plan_required"); };

    // ---------------------------------------------------------------- invite
    if (action === "invite") {
      const level = b.level === "admin" ? "admin" : b.level === "full" ? "full" : "limited";
      const raw = Array.isArray(b.emails) ? (b.emails as unknown[]).map(parseEmail) : [];
      const emails = [...new Set(raw.filter(Boolean))];
      if (emails.length < 1) throw new Fail(400, "bad_request");
      if (emails.length > MAX_EMAILS) throw new Fail(400, "too_many");

      const results: Record<string, unknown>[] = [];

      if (level === "admin") {
        if (!isOwner) throw new Fail(403, "owner_only");
        needPro(ctx.owned);
        let first = true;
        for (const email of emails) {
          if (!EMAIL_RE.test(email) || email.length > 254) { results.push({ email, status: "bad_email" }); continue; }
          if (email === userEmail) { results.push({ email, status: "self" }); continue; }
          const { data: ex, error: xErr } = await admin.from("account_admins").select("id, status").eq("owner_id", userId).eq("member_email", email).maybeSingle();
          if (xErr) throw new Error("lookup: " + xErr.message);
          if (ex?.status === "accepted") { results.push({ email, status: "already" }); continue; }
          if (!ex) {
            const { error: iErr } = await admin.from("account_admins").insert([{ owner_id: userId, member_email: email, status: "pending" }]);
            if (iErr) throw new Error("insert: " + iErr.message);
          }
          if (!first) await sleep(300);
          first = false;
          try { await sendAdminInvite(email, inviterName); results.push({ email, status: ex ? "resent" : "invited" }); }
          catch { results.push({ email, status: "email_failed" }); }
        }
        return json(200, { ok: true, results });
      }

      const homes = homesFrom(b.propertyIds);
      needPro(homes);
      let first = true;
      for (const email of emails) {
        if (!EMAIL_RE.test(email) || email.length > 254) { results.push({ email, status: "bad_email" }); continue; }
        if (email === userEmail) { results.push({ email, status: "self" }); continue; }
        const perHome: { propertyId: string; status: string }[] = [];
        const toEmail: string[] = [];
        for (const home of homes) {
          if (email === await emailOfOwner(home.user_id)) { perHome.push({ propertyId: home.id, status: "owner" }); continue; }
          const { data: adm } = await admin.from("account_admins").select("id").eq("owner_id", home.user_id).eq("member_email", email).maybeSingle();
          if (adm) { perHome.push({ propertyId: home.id, status: "already_admin" }); continue; }
          const { data: ex, error: eErr } = await admin.from("home_members").select("id, status").eq("property_id", home.id).eq("member_email", email).maybeSingle();
          if (eErr) throw new Error("lookup: " + eErr.message);
          if (ex) {
            if (ex.status === "accepted") { perHome.push({ propertyId: home.id, status: "already" }); continue; }
            const { error: upErr } = await admin.from("home_members").update({ role: level }).eq("id", ex.id);
            if (upErr) throw new Error("update: " + upErr.message);
            perHome.push({ propertyId: home.id, status: "resent" });
          } else {
            const { error: inErr } = await admin.from("home_members").insert([{ property_id: home.id, owner_id: home.user_id, member_email: email, role: level, status: "pending" }]);
            if (inErr) throw new Error("insert: " + inErr.message);
            perHome.push({ propertyId: home.id, status: "invited" });
          }
          toEmail.push(String(home.address || "a home"));
        }
        let sent = false;
        if (toEmail.length > 0) {
          if (!first) await sleep(300);
          first = false;
          try { await sendHomeInvite(email, inviterName, level, toEmail); sent = true; } catch { /* rows are kept; the owner can resend */ }
        }
        results.push({ email, status: toEmail.length === 0 ? "nothing_new" : sent ? "sent" : "email_failed", homes: perHome });
      }
      return json(200, { ok: true, results });
    }

    // ------------------------------------------------------------- set_level
    if (action === "set_level") {
      const email = parseEmail(b.memberEmail);
      const level = b.level === "full" ? "full" : b.level === "limited" ? "limited" : "";
      if (!EMAIL_RE.test(email) || !level) throw new Fail(400, "bad_request");
      const homes = homesFrom(b.propertyIds);
      const { data, error } = await admin.from("home_members").update({ role: level }).in("property_id", homes.map((h) => h.id)).eq("member_email", email).select("id");
      if (error) throw new Error("update: " + error.message);
      return json(200, { ok: true, changed: data?.length || 0 });
    }

    // ------------------------------------------------------------------ list
    // Everyone on the accounts the caller owns or administers, read here so the screen does not depend on
    // table read rules. Only the owner and Admins have homes in ctx, so nobody else gets anything back.
    if (action === "list") {
      const homeIds = [...ctx.homes.keys()];
      const ownerIds = [...new Set([...ctx.homes.values()].map((h) => h.user_id))];
      const [m, ad] = await Promise.all([
        homeIds.length ? admin.from("home_members").select("*").in("property_id", homeIds) : Promise.resolve({ data: [], error: null }),
        ownerIds.length ? admin.from("account_admins").select("*").in("owner_id", ownerIds) : Promise.resolve({ data: [], error: null }),
      ]);
      if (m.error) throw new Error("list members: " + m.error.message);
      if (ad.error) throw new Error("list admins: " + ad.error.message);
      return json(200, { ok: true, members: m.data || [], admins: ad.data || [] });
    }

    // ---------------------------------------------------------- change_level
    // Moves one person between Admin, Full access and Tasks & assets across the whole account.
    // Only the owner can do this, because it adds or removes an Admin.
    if (action === "change_level") {
      if (!isOwner) throw new Fail(403, "owner_only");
      const email = parseEmail(b.memberEmail);
      const level = b.level === "admin" ? "admin" : b.level === "full" ? "full" : b.level === "limited" ? "limited" : "";
      if (!EMAIL_RE.test(email) || !level) throw new Fail(400, "bad_request");
      needPro(ctx.owned);
      const ownerHomes = ctx.owned;
      const ownerHomeIds = ownerHomes.map((h) => h.id);
      const { data: adm, error: aErr } = await admin.from("account_admins").select("*").eq("owner_id", userId).eq("member_email", email).maybeSingle();
      if (aErr) throw new Error("lookup: " + aErr.message);
      const { data: rowsRaw, error: rErr } = await admin.from("home_members").select("*").in("property_id", ownerHomeIds).eq("member_email", email);
      if (rErr) throw new Error("lookup: " + rErr.message);
      const rows = rowsRaw || [];
      const nowIso = new Date().toISOString();

      // Person -> Admin. Their home rows stay, so tasks assigned to them stay assigned.
      if (level === "admin") {
        if (adm) return json(200, { ok: true, changed: 0 });
        if (rows.length === 0) throw new Fail(404, "not_found");
        const accepted = rows.find((r) => r.status === "accepted");
        const { error: iErr } = await admin.from("account_admins").insert([{
          owner_id: userId, member_email: email,
          member_id: accepted?.member_id ?? null,
          status: accepted ? "accepted" : "pending",
          accepted_at: accepted ? (accepted.accepted_at ?? nowIso) : null,
        }]);
        if (iErr) throw new Error("insert: " + iErr.message);
        if (!accepted) { try { await sendAdminInvite(email, inviterName); } catch { /* the owner can resend */ } }
        return json(200, { ok: true, changed: 1 });
      }

      // Admin -> Full access or Tasks & assets: they get a row for every home on the account.
      if (adm) {
        const active = adm.status === "accepted";
        const { error: dErr } = await admin.from("account_admins").delete().eq("id", adm.id);
        if (dErr) throw new Error("delete: " + dErr.message);
        const toEmail: string[] = [];
        for (const home of ownerHomes) {
          const ex = rows.find((r) => String(r.property_id) === home.id);
          if (ex) {
            const patch: Record<string, unknown> = { role: level };
            if (active && ex.status !== "accepted") Object.assign(patch, { status: "accepted", member_id: adm.member_id ?? ex.member_id ?? null, accepted_at: adm.accepted_at ?? nowIso });
            const { error: uErr } = await admin.from("home_members").update(patch).eq("id", ex.id);
            if (uErr) throw new Error("update: " + uErr.message);
            continue;
          }
          const { error: inErr } = await admin.from("home_members").insert([{
            property_id: home.id, owner_id: userId, member_email: email, role: level,
            member_id: active ? (adm.member_id ?? null) : null,
            status: active ? "accepted" : "pending",
            accepted_at: active ? (adm.accepted_at ?? nowIso) : null,
          }]);
          if (inErr) throw new Error("insert: " + inErr.message);
          if (!active) toEmail.push(String(home.address || "a home"));
        }
        if (toEmail.length > 0) { try { await sendHomeInvite(email, inviterName, level, toEmail); } catch { /* the owner can resend */ } }
        return json(200, { ok: true, changed: 1 });
      }

      // Person -> another person level
      if (rows.length === 0) throw new Fail(404, "not_found");
      const { error: upErr } = await admin.from("home_members").update({ role: level }).in("property_id", ownerHomeIds).eq("member_email", email);
      if (upErr) throw new Error("update: " + upErr.message);
      return json(200, { ok: true, changed: rows.length });
    }

    // ---------------------------------------------------------------- remove
    if (action === "remove") {
      const email = parseEmail(b.memberEmail);
      if (!EMAIL_RE.test(email)) throw new Fail(400, "bad_request");
      const homes = homesFrom(b.propertyIds);
      const { data, error } = await admin.from("home_members").delete().in("property_id", homes.map((h) => h.id)).eq("member_email", email).select("id");
      if (error) throw new Error("delete: " + error.message);
      return json(200, { ok: true, removed: data?.length || 0 });
    }

    // ---------------------------------------------------------- remove_admin
    if (action === "remove_admin") {
      if (!isOwner) throw new Fail(403, "owner_only");
      const email = parseEmail(b.memberEmail);
      if (!EMAIL_RE.test(email)) throw new Fail(400, "bad_request");
      const { data: row } = await admin.from("account_admins").select("id, member_id").eq("owner_id", userId).eq("member_email", email).maybeSingle();
      if (!row) return json(200, { ok: true, removed: 0 });
      const { error } = await admin.from("account_admins").delete().eq("id", row.id);
      if (error) throw new Error("delete: " + error.message);
      // someone who was promoted from a person level keeps home rows underneath; removing the Admin removes those too
      await admin.from("home_members").delete().in("property_id", ctx.owned.map((h) => h.id)).eq("member_email", email);
      if (row.member_id) {
        // Tasks assigned to someone who no longer has access go back to unassigned.
        await admin.from("tasks").update({ assigned_to: null }).eq("assigned_to", row.member_id).in("property_id", ctx.owned.map((h) => h.id));
      }
      return json(200, { ok: true, removed: 1 });
    }

    // ---------------------------------------------------------------- resend
    if (action === "resend") {
      const email = parseEmail(b.memberEmail);
      if (!EMAIL_RE.test(email)) throw new Fail(400, "bad_request");
      if (b.kind === "admin") {
        if (!isOwner) throw new Fail(403, "owner_only");
        needPro(ctx.owned);
        const { data: row } = await admin.from("account_admins").select("id, status").eq("owner_id", userId).eq("member_email", email).maybeSingle();
        if (!row || row.status !== "pending") throw new Fail(404, "nothing_pending");
        await sendAdminInvite(email, inviterName);
        return json(200, { ok: true, sent: true });
      }
      const ids = [...ctx.homes.keys()];
      const { data: rows, error } = await admin.from("home_members").select("property_id, role").in("property_id", ids).eq("member_email", email).eq("status", "pending");
      if (error) throw new Error("lookup: " + error.message);
      if (!rows || rows.length === 0) throw new Fail(404, "nothing_pending");
      needPro(rows.map((r) => ctx.homes.get(String(r.property_id))!).filter(Boolean));
      const addresses = rows.map((r) => String(ctx.homes.get(String(r.property_id))?.address || "a home"));
      await sendHomeInvite(email, inviterName, String(rows[0].role) === "full" ? "full" : "limited", addresses);
      return json(200, { ok: true, sent: true });
    }

    throw new Fail(400, "bad_request");
  } catch (e) {
    if (e instanceof Fail) return json(e.status, { error: e.code });
    console.error("[home-people] error:", (e as Error)?.message);
    return json(500, { error: "failed" });
  }
});
