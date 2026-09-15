import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Full account deletion: cleans up every known per-user table, then deletes the
// actual auth.users record. The existing "delete user" button only removed the
// profiles row -- the auth account itself (and all other tables' data) survived,
// meaning a "deleted" user could still log back in.
//
// Admin check: this function DOES verify the caller's JWT (not deployed with
// --no-verify-jwt), so Supabase already confirms *some* logged-in user is
// calling it. On top of that, this checks the caller's email specifically
// matches the established admin address, matching the same privilege pattern
// already used by guard_profile_plan and admin-agent elsewhere in this project.
const ADMIN_EMAIL = "hello@trysteadwell.app";

// Tables keyed by user_id, confirmed against the app's own per-user delete calls.
// home_members is keyed by owner_id instead and is handled separately below.
const USER_ID_TABLES = [
  "tasks", "warranties", "asset_service_log", "expenses",
  "projects", "utilities", "utility_bills", "home_documents", "contractors",
];

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const callerToken = authHeader.replace("Bearer ", "");

    const supabase = createClient(Deno.env.get("DB_URL"), Deno.env.get("SERVICE_ROLE_KEY"));

    // Verify the caller's own token identifies them, and that they're the admin
    const { data: callerData, error: callerError } = await supabase.auth.getUser(callerToken);
    if (callerError || !callerData?.user || callerData.user.email !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Not authorized" }), { status: 403 });
    }

    const { targetUserId } = await req.json();
    if (!targetUserId) {
      return new Response(JSON.stringify({ error: "Missing targetUserId" }), { status: 400 });
    }
    if (targetUserId === callerData.user.id) {
      return new Response(JSON.stringify({ error: "Cannot delete your own admin account through this tool" }), { status: 400 });
    }

    // Clean up every known per-user table before touching auth.users, so the
    // final account delete never fails on a leftover foreign-key reference
    // regardless of whether cascade constraints exist.
    for (const table of USER_ID_TABLES) {
      await supabase.from(table).delete().eq("user_id", targetUserId);
    }
    await supabase.from("home_members").delete().eq("owner_id", targetUserId);
    await supabase.from("profiles").delete().eq("user_id", targetUserId);

    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(targetUserId);
    if (authDeleteError) {
      return new Response(JSON.stringify({ error: "Data cleaned up, but auth account deletion failed: " + authDeleteError.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
