// supabase/functions/shared-access/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL   = Deno.env.get("DB_URL")!;
const SERVICE_KEY    = Deno.env.get("SERVICE_ROLE_KEY")!;
const FROM           = "Steadwell <hello@trysteadwell.app>";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { ownerName, ownerEmail, memberEmail, propertyAddress, propertyId, ownerId } = await req.json();

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check if invite already exists — maybeSingle() returns null on no match
    // instead of throwing, which is the normal case for a first-time invite.
    const { data: existing, error: selectErr } = await supabase
      .from("home_members")
      .select("id, status")
      .eq("property_id", propertyId)
      .eq("member_email", memberEmail)
      .maybeSingle();

    if (selectErr) throw new Error(`Lookup failed: ${selectErr.message}`);

    if (existing) {
      if (existing.status === "accepted") {
        return new Response(JSON.stringify({ ok: false, error: "This person already has access." }), { status: 200, headers: CORS });
      }
      // Re-send invite if pending
    } else {
      // Create invite record
      const { error: insertErr } = await supabase.from("home_members").insert([{
        property_id: propertyId,
        owner_id: ownerId,
        member_email: memberEmail,
        role: "member",
        status: "pending",
      }]);
      if (insertErr) throw new Error(`Insert failed: ${insertErr.message}`);
    }

    const acceptUrl = `https://www.trysteadwell.app?shared_invite=${propertyId}&email=${encodeURIComponent(memberEmail)}`;

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
  body{font-family:'Helvetica Neue',Arial,sans-serif;background:#F4EDDF;margin:0;padding:40px 20px}
  .card{background:#fff;max-width:520px;margin:0 auto;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.08)}
  .header{background:#234A3D;padding:32px;text-align:center}
  .logo{color:#F4EDDF;font-size:22px;font-weight:600;letter-spacing:-.3px}
  .body{padding:32px}
  .title{font-size:22px;font-weight:600;color:#2A2723;margin:0 0 12px}
  .text{font-size:15px;color:#5A534B;line-height:1.6;margin:0 0 24px}
  .btn{display:block;background:#C16140;color:#fff;text-decoration:none;text-align:center;padding:14px 28px;border-radius:10px;font-size:16px;font-weight:600}
  .footer{padding:20px 32px;border-top:1px solid #E8E0D0;font-size:12px;color:#A8A09A;text-align:center}
</style></head>
<body>
  <div class="card">
    <div class="header"><div class="logo">Steadwell</div></div>
    <div class="body">
      <div class="title">${ownerName || ownerEmail} invited you to their home</div>
      <div class="text">
        You've been invited to access <strong>${propertyAddress}</strong> on Steadwell &mdash;
        home management software that tracks systems, maintenance, warranties, and costs.
        <br><br>
        Click below to accept the invitation and view the property.
      </div>
      <a href="${acceptUrl}" class="btn">Accept Invitation &#8594;</a>
    </div>
    <div class="footer">
      Invited to ${memberEmail} &middot; <a href="https://www.trysteadwell.app" style="color:#A8A09A">trysteadwell.app</a>
    </div>
  </div>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [memberEmail], subject: `${ownerName || "Someone"} invited you to their home on Steadwell`, html }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: CORS });
  }
});
