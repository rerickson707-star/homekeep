// supabase/functions/admin-agent/index.ts
// Handles all admin actions on agent applications
// Actions: approve | reject | deactivate | reactivate | delete
// Caller must be authenticated as hello@trysteadwell.app
// Deploy: npx supabase functions deploy admin-agent

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL          = Deno.env.get("DB_URL")!;
const SUPABASE_SERVICE_ROLE = Deno.env.get("SERVICE_ROLE_KEY")!;
const ADMIN_EMAIL           = "hello@trysteadwell.app";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // Verify caller is the admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user || user.email !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: CORS });
    }

    const { action, agent_id } = await req.json();
    if (!action || !agent_id) {
      return new Response(JSON.stringify({ error: "action and agent_id required" }), { status: 400, headers: CORS });
    }

    // Fetch the agent first so we have current state
    const { data: agent, error: fetchErr } = await supabase
      .from("agent_applications")
      .select("*")
      .eq("id", agent_id)
      .single();

    if (fetchErr || !agent) {
      return new Response(JSON.stringify({ error: "Agent not found" }), { status: 404, headers: CORS });
    }

    if (action === "approve") {
      // Generate gift code if not already set
      let giftCode = agent.gift_code;
      if (!giftCode) {
        const chars = "abcdefghjkmnpqrstuvwxyz23456789";
        giftCode = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
        await supabase.from("agent_applications")
          .update({ status: "approved", gift_code: giftCode })
          .eq("id", agent_id);
      } else {
        await supabase.from("agent_applications")
          .update({ status: "approved" })
          .eq("id", agent_id);
      }

      // Fire agent-welcome email
      const { error: welcomeErr } = await supabase.functions.invoke("agent-welcome", {
        body: { agent_id },
      });
      if (welcomeErr) console.error("[agent-welcome] error:", welcomeErr);

      return new Response(JSON.stringify({
        ok: true,
        gift_code: giftCode,
        welcome_email_sent: !welcomeErr,
      }), { headers: CORS });
    }

    if (action === "reject") {
      await supabase.from("agent_applications").update({ status: "rejected" }).eq("id", agent_id);
      return new Response(JSON.stringify({ ok: true }), { headers: CORS });
    }

    if (action === "deactivate") {
      await supabase.from("agent_applications")
        .update({ status: "inactive", gift_active: false })
        .eq("id", agent_id);
      return new Response(JSON.stringify({ ok: true }), { headers: CORS });
    }

    if (action === "reactivate") {
      await supabase.from("agent_applications")
        .update({ status: "approved", gift_active: true })
        .eq("id", agent_id);
      return new Response(JSON.stringify({ ok: true }), { headers: CORS });
    }

    if (action === "delete") {
      // Check for existing redemptions — soft delete if any exist
      const { data: redemptions } = await supabase
        .from("gift_redemptions")
        .select("id")
        .eq("agent_token", agent.token)
        .limit(1);

      if (redemptions && redemptions.length > 0) {
        // Soft delete: preserve attribution history
        await supabase.from("agent_applications")
          .update({ status: "deleted", gift_active: false })
          .eq("id", agent_id);
        return new Response(JSON.stringify({ ok: true, soft_delete: true }), { headers: CORS });
      }

      await supabase.from("agent_applications").delete().eq("id", agent_id);
      return new Response(JSON.stringify({ ok: true, soft_delete: false }), { headers: CORS });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: CORS });

  } catch (err) {
    console.error("admin-agent error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
