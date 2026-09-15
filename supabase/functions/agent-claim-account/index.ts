import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Called by AgentPortalPage once an agent is signed in via magic link.
// Looks up their agent_applications row by user_id first (fast path for
// returning agents); on first-ever login, falls back to matching the
// authenticated email against the ORIGINAL application email (not the
// editable agent_email field agents can change later, which would be a
// weaker match to claim an identity against) and links it permanently.
//
// Deployed WITHOUT --no-verify-jwt: this is called by a real logged-in
// agent, so Supabase's own JWT check applies, same as admin-delete-user.
Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const callerToken = authHeader.replace("Bearer ", "");

    const supabase = createClient(Deno.env.get("DB_URL"), Deno.env.get("SERVICE_ROLE_KEY"));

    const { data: callerData, error: callerError } = await supabase.auth.getUser(callerToken);
    if (callerError || !callerData?.user) {
      return new Response(JSON.stringify({ error: "Not authorized" }), { status: 401 });
    }
    const uid = callerData.user.id;
    const email = callerData.user.email;

    // Fast path: already claimed
    const { data: existing } = await supabase
      .from("agent_applications")
      .select("*")
      .eq("user_id", uid)
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ data: existing }), { status: 200 });
    }

    // First login: match by the original application email, approved only,
    // and not already claimed by someone else.
    const { data: match, error: matchError } = await supabase
      .from("agent_applications")
      .select("*")
      .ilike("email", email)
      .eq("status", "approved")
      .is("user_id", null)
      .maybeSingle();

    if (matchError || !match) {
      return new Response(JSON.stringify({ error: "no_matching_application" }), { status: 404 });
    }

    const { data: claimed, error: claimError } = await supabase
      .from("agent_applications")
      .update({ user_id: uid })
      .eq("id", match.id)
      .is("user_id", null) // guards against a race if two requests land at once
      .select()
      .single();

    if (claimError || !claimed) {
      return new Response(JSON.stringify({ error: "claim_failed" }), { status: 409 });
    }

    return new Response(JSON.stringify({ data: claimed }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
