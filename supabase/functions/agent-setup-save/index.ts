// supabase/functions/agent-setup-save/index.ts
// Called from /agent-setup on form submission
// Validates agent by token, writes profile fields server-side
// File uploads happen client-side to agent-assets storage before this is called
// Deploy: npx supabase functions deploy agent-setup-save --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL          = Deno.env.get("DB_URL")!;
const SUPABASE_SERVICE_ROLE = Deno.env.get("SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Only these fields can be written by the agent — everything else is admin-only
const ALLOWED_FIELDS = ["display_name", "title", "phone", "agent_email", "license", "headshot_url", "logo_url", "onboarded_at"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // GET: public agent lookup — used by /agent-setup (by token) and /gift (by gift_code or token)
    if (req.method === "GET") {
      const url = new URL(req.url);
      const token    = url.searchParams.get("token");
      const giftCode = url.searchParams.get("gift_code");

      if (!token && !giftCode) {
        return new Response(JSON.stringify({ error: "token or gift_code required" }), { status: 400, headers: CORS });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

      let query = supabase
        .from("agent_applications")
        .select("token, display_name, name, title, brokerage, phone, agent_email, license, headshot_url, logo_url, gift_code")
        .eq("status", "approved");

      if (giftCode) query = query.eq("gift_code", giftCode);
      else          query = query.eq("token", token);

      const { data, error } = await query.single();
      if (error || !data) {
        return new Response(JSON.stringify({ error: "Agent not found" }), { status: 404, headers: CORS });
      }
      return new Response(JSON.stringify({ data }), { headers: CORS });
    }

    const { token, updates } = await req.json();

    if (!token || !updates || typeof updates !== "object") {
      return new Response(JSON.stringify({ error: "token and updates required" }), { status: 400, headers: CORS });
    }

    // Strip any fields the agent shouldn't be able to set
    const safeUpdates: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (key in updates) safeUpdates[key] = updates[key];
    }

    if (Object.keys(safeUpdates).length === 0) {
      return new Response(JSON.stringify({ error: "No valid fields to update" }), { status: 400, headers: CORS });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    // Validate the token belongs to an approved agent
    const { data: agent, error: agentErr } = await supabase
      .from("agent_applications")
      .select("id, status, token")
      .eq("token", token)
      .eq("status", "approved")
      .single();

    if (agentErr || !agent) {
      return new Response(JSON.stringify({ error: "Invalid or unauthorized token" }), { status: 401, headers: CORS });
    }

    // Write with service role — bypasses RLS safely since we've validated the token
    const { error: updateErr } = await supabase
      .from("agent_applications")
      .update(safeUpdates)
      .eq("token", token);

    if (updateErr) {
      console.error("agent-setup-save update error:", updateErr);
      return new Response(JSON.stringify({ error: "Failed to save profile" }), { status: 500, headers: CORS });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: CORS });

  } catch (err) {
    console.error("agent-setup-save error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
