// supabase/functions/send-notifications/index.ts
// Sends the emails that database triggers queued in notification_outbox:
//   invite accepted, task assigned to you, task completed, someone left or was removed,
//   access changed, and the owner of a home you were on closed their account.
//
// How it is used: the app calls this right after something happens, and a scheduled job on the server calls it
// every 5 minutes (see steadwell-notify-schedule.sql), so emails go out within seconds or minutes without any
// browser having to be open. The recipient and the content come only from the database rows the triggers wrote.
// The browser sends nothing but its login token, so it cannot make this email anyone.
// Each person's choices live in notification_prefs (no row = everything on).
//
// Run steadwell-notifications.sql FIRST.
// Needs the secrets DB_URL, SERVICE_ROLE_KEY and RESEND_API_KEY (already set).
// Also needs the secret CRON_SECRET (any long random string; the schedule sends the same string).
// Deploy: npx supabase functions deploy send-notifications --no-verify-jwt --project-ref hjkyameroqufaojuerns
// (--no-verify-jwt because the scheduled job has no login. The function still checks every call itself:
//  it needs either a signed-in person's token or the CRON_SECRET.)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("DB_URL")!;
const SERVICE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;
const FROM = "Steadwell <hello@trysteadwell.app>";
const APP_URL = "https://www.trysteadwell.app/";
const BATCH = 25;
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const ALLOWED_ORIGINS = [
  /^https:\/\/(www\.)?trysteadwell\.app$/,
  /^https:\/\/homekeep-[a-z0-9-]+-rerickson707-star1\.vercel\.app$/,
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

// ---- Email layout (tables and inline styles only, so Gmail, Outlook and Apple Mail agree) ----
const C = { cream: "#F4EDDF", pine: "#234A3D", clay: "#C16140", ink: "#2A2723", body: "#4A443E", muted: "#7A7168", panel: "#F7F2E8", line: "#E8E0D0" };
const FONT = "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";
const plainLink = (href: string, text: string, extra = "") =>
  `<a href="${esc(href)}" style="color:${C.ink};text-decoration:none;${extra}">${text}</a>`;
const mapLink = (addr: string) => plainLink(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`, esc(addr), "font-weight:700;");
const field = (label: string, valueHtml: string, last = false) =>
  `<tr><td style="padding:0 0 ${last ? 0 : 16}px"><div style="font:13px/1.4 ${FONT};color:${C.muted};margin:0 0 3px">${label}</div><div style="font:16px/1.45 ${FONT};color:${C.ink}">${valueHtml}</div></td></tr>`;

function wrap(o: { title: string; intro: string; fields: string; button: string; preheader: string }) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(o.title)}</title></head>
<body style="margin:0;padding:0;background:${C.cream}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.cream}">${esc(o.preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.cream}" style="background:${C.cream}"><tr><td align="center" style="padding:32px 14px">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
    <tr><td align="center" bgcolor="${C.pine}" style="background:${C.pine};padding:24px 24px 22px">
      <a href="https://www.trysteadwell.app" style="text-decoration:none"><img src="https://www.trysteadwell.app/icon-192.png" width="48" height="48" alt="Steadwell" style="display:block;margin:0 auto 10px;width:48px;height:48px;border-radius:12px;border:0;color:${C.cream};font:700 14px/48px ${FONT}"></a>
      <span style="font:700 22px/1 ${SERIF};color:${C.cream};letter-spacing:.2px">Steadwell</span>
    </td></tr>
    <tr><td style="padding:32px 36px 8px">
      <h1 style="margin:0 0 12px;font:700 24px/1.25 ${SERIF};color:${C.ink}">${o.title}</h1>
      <p style="margin:0 0 22px;font:16px/1.6 ${FONT};color:${C.body}">${o.intro}</p>
      ${o.fields ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.panel}" style="background:${C.panel};border-radius:12px"><tr><td style="padding:18px 22px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${o.fields}</table>
      </td></tr></table>` : ""}
    </td></tr>
    <tr><td style="padding:24px 36px 28px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td align="center" bgcolor="${C.clay}" style="background:${C.clay};border-radius:10px">
          <a href="${APP_URL}" style="display:block;padding:15px 24px;font:700 16px/1.2 ${FONT};color:#ffffff !important;text-decoration:none"><span style="color:#ffffff">${esc(o.button)}</span></a>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:18px 36px 24px;border-top:1px solid ${C.line}">
      <p style="margin:0;font:12px/1.6 ${FONT};color:${C.muted};text-align:center">You can turn these emails off in Steadwell under Account &rarr; Notifications.<br>Steadwell &middot; ${plainLink("https://www.trysteadwell.app", "trysteadwell.app", `color:${C.muted};text-decoration:underline`)}</p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

async function sendEmail(to: string, subject: string, html: string, text: string) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY missing");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, text }),
  });
  if (!res.ok) { console.error("[send-notifications] Resend status:", res.status); throw new Error("email_failed"); }
}

// ---- Build one email from one outbox row ----------------------------------------------------
type Row = { id: string; kind: string; recipient_id: string; property_id: string | null; actor_id: string | null; ref: string | null; payload: Record<string, any> };
type Mail = { subject: string; html: string; text: string };

const ROLE_LABEL: Record<string, string> = { admin: "Admin", full: "Full access", limited: "Tasks & assets", member: "Tasks & assets" };
const ROLE_DESC: Record<string, string> = {
  admin: "Full access to every home, plus inviting and managing people.",
  full: "Tasks, assets, service history, contractors, expenses and projects.",
  limited: "Tasks, assets, service history and contractors. Expenses and projects stay private.",
  member: "Tasks, assets, service history and contractors. Expenses and projects stay private.",
};
const fmtDate = (d: unknown) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d ?? ""));
  if (!m) return "";
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
};

function build(r: Row, who: string, home: string, whoEmail = ""): Mail {
  const p = r.payload || {};
  // "Maria Lopez" with her address underneath; just the address when there is no name.
  const personHtml = (name: string, email: string) => {
    const e = email && email.toLowerCase() !== name.toLowerCase() ? `<div style="font:14px/1.5 ${FONT};color:${C.body};margin-top:2px">${esc(email)}</div>` : "";
    return `<strong>${esc(name)}</strong>${e}`;
  };
  const personText = (name: string, email: string) => (email && email.toLowerCase() !== name.toLowerCase() ? `${name} (${email})` : name);
  const rows = (list: Array<[string, string]>) =>
    list.filter((x) => x[1]).map((x, i, arr) => field(x[0], x[1], i === arr.length - 1)).join("");
  const homeHtml = home ? mapLink(home) : "";
  const homeText = home ? `\nHome: ${home}` : "";

  if (r.kind === "task_assigned") {
    const title = String(p.title || "A task");
    const due = fmtDate(p.due_date);
    return {
      subject: `${who} assigned you a task: ${title}`,
      html: wrap({
        title: `${esc(who)} assigned you a task`,
        intro: `A task was added to your list on Steadwell.`,
        fields: rows([["Task", `<strong>${esc(title)}</strong>`], ["Home", homeHtml], ["Due", esc(due)], ["Priority", esc(p.priority || "")], ["Assigned by", personHtml(who, whoEmail)]]),
        button: "Open your tasks", preheader: `${title}${due ? " \u00b7 due " + due : ""}`,
      }),
      text: `${who} assigned you a task on Steadwell.\n\nTask: ${title}${homeText}${due ? `\nDue: ${due}` : ""}${p.priority ? `\nPriority: ${p.priority}` : ""}\nAssigned by: ${personText(who, whoEmail)}\n\nOpen Steadwell: ${APP_URL}`,
    };
  }
  if (r.kind === "task_completed") {
    const title = String(p.title || "A task");
    return {
      subject: `${who} completed: ${title}`,
      html: wrap({
        title: `${esc(who)} completed a task`,
        intro: `A task you created is marked Completed.`,
        fields: rows([["Task", `<strong>${esc(title)}</strong>`], ["Home", homeHtml], ["Completed by", personHtml(who, whoEmail)]]),
        button: "Open Steadwell", preheader: `${title} is done`,
      }),
      text: `${who} completed a task you created on Steadwell.\n\nTask: ${title}${homeText}\nCompleted by: ${personText(who, whoEmail)}\n\nOpen Steadwell: ${APP_URL}`,
    };
  }
  if (r.kind === "invite_accepted") {
    const level = ROLE_LABEL[String(p.role || "limited")] || "Tasks & assets";
    const homes: string[] = Array.isArray(p.homes) ? p.homes.map(String).filter(Boolean) : (home ? [home] : []);
    const homesHtml = String(p.role) === "admin" ? "Every home on your account" : homes.map((h) => `<div style="margin:0 0 4px">${mapLink(h)}</div>`).join("");
    const homesText = String(p.role) === "admin" ? "Every home on your account" : homes.join("; ");
    return {
      subject: `${who} accepted your Steadwell invitation`,
      html: wrap({
        title: `${esc(who)} accepted your invitation`,
        intro: `${esc(personText(who, whoEmail))} has created or signed in to their Steadwell account and now has access.`,
        fields: rows([["Person", personHtml(who, whoEmail)], ["Access", `<strong>${esc(level)}</strong><div style="font:14px/1.5 ${FONT};color:${C.body};margin-top:2px">${esc(ROLE_DESC[String(p.role || "limited")] || "")}</div>`], [homes.length > 1 ? "Homes" : "Home", homesHtml]]),
        button: "Open Steadwell", preheader: `${personText(who, whoEmail)} now has ${level} access`,
      }),
      text: `${personText(who, whoEmail)} accepted your invitation on Steadwell and now has access.\n\nAccess: ${level}. ${ROLE_DESC[String(p.role || "limited")] || ""}${homesText ? `\nHome${homes.length > 1 ? "s" : ""}: ${homesText}` : ""}\n\nOpen Steadwell: ${APP_URL}`,
    };
  }
  if (r.kind === "role_changed") {
    const to = String(p.to || "limited");
    const from = p.from ? String(p.from) : "";
    const toLabel = ROLE_LABEL[to] || "Tasks & assets";
    const fromLabel = from ? (ROLE_LABEL[from] || "") : "";
    const owner = String(p.owner_name || "The account owner");
    const ownerEmail = String(p.owner_email || "");
    return {
      subject: `Your Steadwell access changed to ${toLabel}`,
      html: wrap({
        title: `Your access is now ${esc(toLabel)}`,
        intro: `${esc(ownerEmail && ownerEmail.toLowerCase() !== owner.toLowerCase() ? owner + " (" + ownerEmail + ")" : owner)} changed your access on their Steadwell account.`,
        fields: rows([["Before", esc(fromLabel)], ["Now", `<strong>${esc(toLabel)}</strong><div style="font:14px/1.5 ${FONT};color:${C.body};margin-top:2px">${esc(ROLE_DESC[to] || "")}</div>`]]),
        button: "Open Steadwell", preheader: `You now have ${toLabel} access`,
      }),
      text: `${owner} changed your access on their Steadwell account.\n\n${fromLabel ? `Before: ${fromLabel}\n` : ""}Now: ${toLabel}. ${ROLE_DESC[to] || ""}\n\nOpen Steadwell: ${APP_URL}`,
    };
  }
  if (r.kind === "home_closed") {
    const owner = String(p.owner_name || "").trim() || String(p.owner_email || "") || "The account owner";
    const list: string[] = Array.isArray(p.homes) ? p.homes.map((h: unknown) => String(h)).filter(Boolean) : [];
    const homesHtmlList = list.length ? list.map((h) => mapLink(h)).join("<br>") : "";
    const many = list.length > 1;
    return {
      subject: "You no longer have access to a Steadwell home",
      html: wrap({
        title: "Your access has ended",
        intro: `${esc(owner)} closed their Steadwell account, so you no longer have access to ${many ? "the homes" : "the home"} they shared with you. ${many ? "Those homes belong" : "That home belongs"} to ${esc(owner)}, so what is stored in ${many ? "them" : "it"}, including anything you added, is removed with the account.`,
        fields: rows([[many ? "Homes" : "Home", homesHtmlList]]),
        button: "Open Steadwell", preheader: `${owner} closed their account`,
      }),
      text: `${owner} closed their Steadwell account, so you no longer have access to the ${many ? "homes" : "home"} they shared with you. ${many ? "Those homes belong" : "That home belongs"} to ${owner}, so what is stored in ${many ? "them" : "it"}, including anything you added, is removed with the account.${list.length ? `\n\n${many ? "Homes" : "Home"}: ${list.join("; ")}` : ""}\n\nOpen Steadwell: ${APP_URL}`,
    };
  }
  // member_left
  const own = !!p.left_on_own;
  const addr = String(p.email || "");
  return {
    subject: own ? `${who} left your Steadwell account` : `${who} was removed from your Steadwell account`,
    html: wrap({
      title: own ? `${esc(who)} left` : `${esc(who)} was removed`,
      intro: own ? `${esc(personText(who, addr))} chose to leave and no longer has access.` : `${esc(personText(who, addr))} no longer has access.`,
      fields: rows([["Person", personHtml(who, addr)], ["Home", homeHtml]]),
      button: "Review who has access", preheader: own ? `${personText(who, addr)} left` : `${personText(who, addr)} was removed`,
    }),
    text: `${personText(who, addr)} ${own ? "left" : "was removed from"} your Steadwell account and no longer has access.${homeText}\n\nReview who has access: ${APP_URL}`,
  };
}

serve(async (req) => {
  const cors = corsFor(req.headers.get("origin") || "");
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  // Two ways in: the scheduled job (shared secret), or a signed-in person (their login token).
  const fromSchedule = CRON_SECRET.length >= 16 && (req.headers.get("x-cron-secret") || "") === CRON_SECRET;
  if (!fromSchedule) {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json(401, { error: "not_signed_in" });
    const { data: u, error: uErr } = await admin.auth.getUser(token);
    if (uErr || !u?.user) return json(401, { error: "not_signed_in" });
  }

  try {
    const { data: claimed, error: cErr } = await admin.rpc("sw_notify_claim", { p_limit: BATCH });
    if (cErr) throw new Error("claim: " + cErr.message);
    const rows = (claimed || []) as Row[];
    if (rows.length === 0) return json(200, { ok: true, sent: 0, skipped: 0 });

    const userCache = new Map<string, any>();
    const getUser = async (id: string) => {
      if (!userCache.has(id)) {
        const { data } = await admin.auth.admin.getUserById(id);
        userCache.set(id, data?.user || null);
      }
      return userCache.get(id);
    };
    const nameOf = (usr: any) => {
      const m = usr?.user_metadata || {};
      return String(m.full_name || m.name || m.first_name || "").trim() || String(usr?.email || "") || "Someone";
    };

    const { data: prefRows } = await admin.from("notification_prefs").select("*").in("user_id", [...new Set(rows.map((r) => r.recipient_id))]);
    const prefs = new Map<string, any>((prefRows || []).map((p: any) => [p.user_id, p]));

    const propIds = [...new Set(rows.map((r) => r.property_id).filter(Boolean))] as string[];
    const homes = new Map<string, string>();
    if (propIds.length) {
      const { data: ps } = await admin.from("profiles").select("id, address, name").in("id", propIds);
      (ps || []).forEach((p: any) => homes.set(p.id, String(p.address || p.name || "").trim()));
    }

    let sent = 0, skipped = 0;
    for (const r of rows) {
      const done = async (error: string | null, ok: boolean) => {
        await admin.from("notification_outbox").update({ sent_at: ok || error ? new Date().toISOString() : null, error }).eq("id", r.id);
      };
      try {
        const pref = prefs.get(r.recipient_id);
        if (r.kind !== "role_changed" && r.kind !== "home_closed" && pref && pref[r.kind] === false) { await done("opted_out", false); skipped++; continue; }   // access changes are always sent

        // "Left" rows queued by a change of level (Admin <-> person) are not removals: the person still has access.
        if (r.kind === "member_left") {
          const email = String(r.payload?.email || "").toLowerCase();
          const ownerId = String(r.payload?.owner_id || "");
          let stillHere = false;
          if (email && ownerId) {
            const { data: owned } = await admin.from("profiles").select("id").eq("user_id", ownerId);
            const ownedIds = (owned || []).map((h: any) => h.id);
            if (r.payload?.admin) {
              if (ownedIds.length) {
                const { count } = await admin.from("home_members").select("id", { count: "exact", head: true }).in("property_id", ownedIds).eq("member_email", email).eq("status", "accepted");
                stillHere = (count || 0) > 0;
              }
            } else {
              const { count: c1 } = r.property_id
                ? await admin.from("home_members").select("id", { count: "exact", head: true }).eq("property_id", r.property_id).eq("member_email", email).eq("status", "accepted")
                : { count: 0 };
              const { count: c2 } = await admin.from("account_admins").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).eq("member_email", email).eq("status", "accepted");
              stillHere = (c1 || 0) > 0 || (c2 || 0) > 0;
            }
          }
          if (stillHere) { await done("still_has_access", false); skipped++; continue; }
        }

        // Access changes: work out the level they have now, and who changed it.
        if (r.kind === "role_changed") {
          const ownerId = String(r.payload?.owner_id || "");
          const target = await getUser(r.recipient_id);
          const tEmail = String(target?.email || "").toLowerCase();
          const { data: adm } = await admin.from("account_admins").select("id").eq("owner_id", ownerId).eq("member_email", tEmail).eq("status", "accepted").limit(1);
          let to = adm && adm.length ? "admin" : "";
          if (!to) {
            const { data: owned } = await admin.from("profiles").select("id").eq("user_id", ownerId);
            const ids = (owned || []).map((h: any) => h.id);
            if (ids.length) {
              const { data: hm } = await admin.from("home_members").select("role").in("property_id", ids).eq("member_email", tEmail).eq("status", "accepted").limit(1);
              if (hm && hm.length) to = hm[0].role === "full" ? "full" : "limited";
            }
          }
          const fromRole = r.payload?.from ? (r.payload.from === "admin" ? "admin" : r.payload.from === "full" ? "full" : "limited") : "";
          if (!to || to === fromRole) { await done("no_visible_change", false); skipped++; continue; }
          const ownerUser = await getUser(ownerId);
          r.payload = { ...r.payload, to, from: fromRole, owner_name: ownerUser ? nameOf(ownerUser) : "", owner_email: String(ownerUser?.email || "") };
        }

        const to = await getUser(r.recipient_id);
        const meta = (to?.app_metadata || {}) as Record<string, unknown>;
        if (!to?.email || meta.email_verified === false || meta.email_bounced === true) { await done("no_deliverable_address", false); skipped++; continue; }

        const actor = r.actor_id ? await getUser(r.actor_id) : null;

        // One "joined" email lists every home the person was given, not one email per home.
        if (r.kind === "invite_accepted" && r.payload?.role !== "admin" && r.payload?.owner_id && r.payload?.email) {
          const { data: hm } = await admin.from("home_members").select("property_id").eq("owner_id", String(r.payload.owner_id)).eq("member_email", String(r.payload.email).toLowerCase()).eq("status", "accepted");
          const ids = [...new Set((hm || []).map((x: any) => x.property_id))];
          if (ids.length) {
            const { data: ps } = await admin.from("profiles").select("id, address, name").in("id", ids);
            r.payload = { ...r.payload, homes: (ps || []).map((x: any) => String(x.address || x.name || "").trim()).filter(Boolean) };
          }
        }
        const who = r.kind === "role_changed" || r.kind === "home_closed" ? "" : r.kind === "member_left" && !r.payload?.left_on_own
          ? String(r.payload?.email || "Someone")
          : (actor ? nameOf(actor) : String(r.payload?.email || "Someone"));

        const mail = build(r, who, r.property_id ? (homes.get(r.property_id) || "") : "", actor ? String(actor.email || "") : "");
        await sendEmail(String(to.email), mail.subject, mail.html, mail.text);
        await done(null, true);
        sent++;
      } catch (e) {
        console.error("[send-notifications] row failed:", r.kind, (e as Error).message);
        await admin.from("notification_outbox").update({ error: (e as Error).message }).eq("id", r.id);   // stays unsent: retried after 5 minutes
      }
    }
    return json(200, { ok: true, sent, skipped });
  } catch (e) {
    console.error("[send-notifications]", (e as Error).message);
    return json(500, { error: "server_error" });
  }
});
