// supabase/functions/delete-account/index.ts
// Deploy: copy to supabase/functions/delete-account/index.ts then:
//   supabase functions deploy delete-account --no-verify-jwt
//
// Soft-deletes the requesting user's auth account (sets deleted_at, does not
// immediately purge data) — matches the 30-day grace period promised in the
// Privacy Policy. A separate scheduled job (not built here) would handle the
// actual permanent purge after 30 days have elapsed.
//
// Also accepts an optional exit-survey { reason, details } from the client,
// saves it to cancellation_feedback (no FK to the user — survives deletion),
// and emails a notification to hello@trysteadwell.app.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL   = Deno.env.get("DB_URL")!;
const SERVICE_KEY    = Deno.env.get("SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendCancellationNotification(opts: {
  email: string;
  name: string | null;
  plan: string;
  reason: string;
  details: string | null;
  accountCreated: string | null;
}) {
  const { email, name, plan, reason, details, accountCreated } = opts;

  const ageLine = accountCreated
    ? (() => {
        const days = Math.floor((Date.now() - new Date(accountCreated).getTime()) / 86400000);
        return `${days} day${days === 1 ? "" : "s"}`;
      })()
    : "unknown";

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><style>:root{color-scheme:light;supported-color-schemes:light;}</style></head>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;background:#ECE3D2;margin:0;padding:0;">
  <div style="max-width:560px;margin:40px auto;background:#FBF7EE;border-radius:16px;overflow:hidden;">
    <div style="background:#234A3D;padding:24px 32px;display:flex;align-items:center;gap:12px;">
      <div style="width:32px;height:32px;background:#234A3D;border:1.5px solid rgba(244,237,223,.15);border-radius:8px;display:flex;align-items:center;justify-content:center;">
        <svg viewBox="0 0 48 48" fill="none" width="20" height="20">
          <path d="M15 33 L15 21 L24 13 L33 21 L33 33" stroke="#F4EDDF" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M21 33 L21 27 A3 3 0 0 1 27 27 L27 33" stroke="#F4EDDF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M11 34 L37 34" stroke="#F4EDDF" stroke-width="3" stroke-linecap="round"/>
          <circle cx="24" cy="18.5" r="1.8" fill="#C16140"/>
        </svg>
      </div>
      <span style="color:#F4EDDF;font-size:18px;font-weight:700;font-family:Georgia,serif;">Account Deleted</span>
    </div>
    <div style="padding:28px 32px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr style="border-bottom:1px solid #E6DECF;">
          <td style="padding:10px 0;font-size:13px;font-weight:700;color:#9A9088;width:120px;text-transform:uppercase;letter-spacing:.06em;">Email</td>
          <td style="padding:10px 0;font-size:15px;color:#2A2723;">${email}</td>
        </tr>
        ${name ? `<tr style="border-bottom:1px solid #E6DECF;">
          <td style="padding:10px 0;font-size:13px;font-weight:700;color:#9A9088;text-transform:uppercase;letter-spacing:.06em;">Name</td>
          <td style="padding:10px 0;font-size:15px;color:#2A2723;">${name}</td>
        </tr>` : ""}
        <tr style="border-bottom:1px solid #E6DECF;">
          <td style="padding:10px 0;font-size:13px;font-weight:700;color:#9A9088;text-transform:uppercase;letter-spacing:.06em;">Plan</td>
          <td style="padding:10px 0;font-size:15px;color:#2A2723;text-transform:capitalize;">${plan}</td>
        </tr>
        <tr style="border-bottom:1px solid #E6DECF;">
          <td style="padding:10px 0;font-size:13px;font-weight:700;color:#9A9088;text-transform:uppercase;letter-spacing:.06em;">Account age</td>
          <td style="padding:10px 0;font-size:15px;color:#2A2723;">${ageLine}</td>
        </tr>
      </table>
      <div style="margin-top:20px;padding:16px 18px;background:#F7E0DA;border-radius:10px;border-left:3px solid #C16140;">
        <div style="font-size:13px;font-weight:700;color:#B0432B;margin-bottom:6px;">Reason given</div>
        <div style="font-size:14px;color:#2A2723;line-height:1.5;">${reason}</div>
        ${details ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid #E3B2A6;font-size:13px;color:#5A534B;line-height:1.6;white-space:pre-wrap;">${details.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>` : ""}
      </div>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #E0D8C9;text-align:center;">
      <p style="font-size:11px;color:#A8A09A;margin:0;">Steadwell &middot; Account deletion, 30-day grace period applies</p>
    </div>
  </div>
</body>
</html>`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Steadwell <hello@trysteadwell.app>",
      to: ["hello@trysteadwell.app"],
      subject: `Account deleted — ${email} (${reason})`,
      html,
    }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const accessToken = authHeader.replace("Bearer ", "");
    if (!accessToken) {
      return new Response(JSON.stringify({ ok: false, error: "Missing auth token" }), { status: 401, headers: CORS });
    }

    const { userId, reason, details } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ ok: false, error: "userId required" }), { status: 400, headers: CORS });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify the access token actually belongs to the userId being deleted —
    // prevents one user from deleting another account by guessing an ID.
    const { data: tokenUser, error: tokenErr } = await supabase.auth.getUser(accessToken);
    if (tokenErr || !tokenUser?.user || tokenUser.user.id !== userId) {
      return new Response(JSON.stringify({ ok: false, error: "Not authorized to delete this account" }), { status: 403, headers: CORS });
    }

    const email = tokenUser.user.email || "unknown";
    const accountCreated = tokenUser.user.created_at || null;

    // Fetch profile for name/plan — before deletion, while it's still queryable
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, plan")
      .eq("user_id", userId)
      .single();

    const name = profile?.name || null;
    const plan = profile?.plan || "free";

    // Save exit-survey feedback + notify — best-effort, never blocks the actual deletion
    try {
      await supabase.from("cancellation_feedback").insert({
        user_id: userId,
        email,
        plan,
        reason:  reason  || "Not provided",
        details: details || null,
      });
    } catch (_) { /* non-blocking */ }

    try {
      await sendCancellationNotification({
        email,
        name,
        plan,
        reason: reason || "Not provided",
        details: details || null,
        accountCreated,
      });
    } catch (_) { /* non-blocking */ }

    // Soft delete — sets deleted_at on the auth user, does not immediately purge data.
    // shouldSoftDelete: true is the Supabase-native way to do this.
    const { error: deleteErr } = await supabase.auth.admin.deleteUser(userId, true);
    if (deleteErr) throw new Error(deleteErr.message);

    // Mark the profile too, so the rest of the app can recognize a pending-deletion
    // account even before the auth row is actually purged.
    await supabase.from("profiles").update({
      deletion_requested_at: new Date().toISOString(),
    }).eq("user_id", userId);

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: CORS });
  }
});
