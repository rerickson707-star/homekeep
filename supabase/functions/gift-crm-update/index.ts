// supabase/functions/gift-crm-update/index.ts
// Lets an agent update the CRM notes/status on a gift_sends row they own, from
// the "Notes" panel on the Sent Gifts tab of the agent portal.
// Ownership check: the row's agent_token must match the agent_token supplied,
// consistent with how send-gift-email already trusts this token (no session
// JWT involved -- the agent_token itself is the credential).
// Deploy: npx supabase functions deploy gift-crm-update --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL          = Deno.env.get("DB_URL")!;
const SUPABASE_SERVICE_ROLE = Deno.env.get("SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_STATUSES = ["new", "contacted", "follow_up", "closed"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { agent_token, send_id, notes, crm_status } = await req.json();

    if (!agent_token || !send_id) {
      return new Response(JSON.stringify({ error: "agent_token and send_id required" }), { status: 400, headers: CORS });
    }
    if (crm_status !== undefined && !VALID_STATUSES.includes(crm_status)) {
      return new Response(JSON.stringify({ error: "Invalid status" }), { status: 400, headers: CORS });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    // Confirm the row exists and belongs to this agent before writing anything.
    const { data: existing, error: fetchErr } = await supabase
      .from("gift_sends")
      .select("id, agent_token")
      .eq("id", send_id)
      .single();

    if (fetchErr || !existing) {
      return new Response(JSON.stringify({ error: "Gift record not found" }), { status: 404, headers: CORS });
    }
    if (existing.agent_token !== agent_token) {
      return new Response(JSON.stringify({ error: "Not authorized to edit this record" }), { status: 403, headers: CORS });
    }

    const updates: Record<string, unknown> = {};
    if (notes !== undefined) updates.notes = notes;
    if (crm_status !== undefined) updates.crm_status = crm_status;

    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ error: "Nothing to update" }), { status: 400, headers: CORS });
    }

    const { error: updateErr } = await supabase
      .from("gift_sends")
      .update(updates)
      .eq("id", send_id);

    if (updateErr) {
      return new Response(JSON.stringify({ error: updateErr.message }), { status: 500, headers: CORS });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: CORS });

  } catch (err) {
    console.error("gift-crm-update error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
