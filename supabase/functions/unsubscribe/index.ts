// supabase/functions/unsubscribe/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("DB_URL")!;
const SERVICE_KEY  = Deno.env.get("SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { user_id } = await req.json();
    if (!user_id) return new Response(JSON.stringify({ ok: false, error: "Missing user_id" }), { status: 400, headers: CORS });

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error } = await supabase
      .from("profiles")
      .update({ email_digest: false })
      .eq("user_id", user_id);

    if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500, headers: CORS });

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: CORS });
  }
});
