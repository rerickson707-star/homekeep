// supabase/functions/redeem-agent-gift/index.ts
// Called after a new user signs up via an agent gift link
// Sets plan = 'plus', gift_expires_at = 90 days, records redemption
// Deploy: npx supabase functions deploy redeem-agent-gift --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL          = Deno.env.get("DB_URL")!;
const SUPABASE_SERVICE_ROLE = Deno.env.get("SERVICE_ROLE_KEY")!;
const RESEND_API_KEY        = Deno.env.get("RESEND_API_KEY")!;
const FROM                  = "Steadwell <hello@trysteadwell.app>";
const ADMIN_EMAIL           = "hello@trysteadwell.app";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { agent_token } = await req.json();
    if (!agent_token) {
      return new Response(JSON.stringify({ error: "agent_token required" }), { status: 400, headers: CORS });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    // Derive and verify user_id from the Authorization JWT
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or missing auth token" }), { status: 401, headers: CORS });
    }
    const user_id = user.id;

    // 1. Fetch the agent application by token
    const { data: agent, error: agentErr } = await supabase
      .from("agent_applications")
      .select("*")
      .eq("token", agent_token)
      .eq("status", "approved")
      .single();

    if (agentErr || !agent) {
      return new Response(JSON.stringify({ error: "Agent not found or not approved" }), { status: 404, headers: CORS });
    }

    // 2. Check this user hasn't already redeemed a gift
    const { data: existing } = await supabase
      .from("gift_redemptions")
      .select("id")
      .eq("user_id", user_id)
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ error: "Gift already redeemed", already_redeemed: true }), { status: 409, headers: CORS });
    }

    // 3. Set plan = 'plus' and gift_expires_at = 90 days from now
    const giftExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    const { error: profileErr } = await supabase
      .from("profiles")
      .update({
        plan:             "plus",
        gift_expires_at:  giftExpiresAt,
        gift_agent_token: agent_token,
      })
      .eq("user_id", user_id);

    if (profileErr) {
      console.error("Profile update error:", profileErr);
      return new Response(JSON.stringify({ error: "Failed to activate gift" }), { status: 500, headers: CORS });
    }

    // 4. Record the redemption
    await supabase.from("gift_redemptions").insert([{
      agent_token,
      user_id,
    }]);

    // 5. Notify admin
    const agentName = agent.display_name || agent.name || "Unknown agent";
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [ADMIN_EMAIL],
        subject: `🎁 Gift redeemed — via ${agentName}`,
        html: `<p>A new user redeemed a Steadwell Plus gift via <strong>${agentName}</strong> (${agent.email}).</p><p>User ID: ${user_id}</p><p>Gift expires: ${new Date(giftExpiresAt).toLocaleDateString()}</p>`,
      }),
    });

    return new Response(JSON.stringify({ ok: true, gift_expires_at: giftExpiresAt, agent_name: agentName }), { headers: CORS });

  } catch (err) {
    console.error("redeem-agent-gift error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
