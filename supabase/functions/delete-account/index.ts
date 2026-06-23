// supabase/functions/delete-account/index.ts
// Deploy: copy to supabase/functions/delete-account/index.ts then:
//   supabase functions deploy delete-account --no-verify-jwt
//
// Soft-deletes the requesting user's auth account (sets deleted_at, does not
// immediately purge data) — matches the 30-day grace period promised in the
// Privacy Policy. A separate scheduled job (not built here) would handle the
// actual permanent purge after 30 days have elapsed.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("DB_URL")!;
const SERVICE_KEY  = Deno.env.get("SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const accessToken = authHeader.replace("Bearer ", "");
    if (!accessToken) {
      return new Response(JSON.stringify({ ok: false, error: "Missing auth token" }), { status: 401, headers: CORS });
    }

    const { userId } = await req.json();
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
