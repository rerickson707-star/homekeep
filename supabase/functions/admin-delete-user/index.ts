// supabase/functions/admin-delete-user/index.ts
// Deploy: npx supabase functions deploy admin-delete-user --project-ref hjkyameroqufaojuerns
// (JWT verification stays ON; the function also checks the caller is the admin address.)
//
// Admin tool: erases one person right now (no grace period).
//   - Their own homes go, with everything in them. What they added to other people's homes stays there.
//   - Their access to other people's homes ends.
//   - Uploaded files are removed with them, except files still used by a record that stays.
// The database does the cleanup itself when the login is deleted (sw_departed_user_cleanup, from
// steadwell-account-deletion.sql), in one step: if anything fails, nothing is half-deleted.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ADMIN_EMAIL = "hello@trysteadwell.app";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_ORIGINS = [
  /^https:\/\/(www\.)?trysteadwell\.app$/,
  /^https:\/\/homekeep-[a-z0-9-]+-rerickson707-star1\.vercel\.app$/,
  /^http:\/\/localhost:\d+$/,
];
function corsFor(origin: string): Record<string, string> {
  const h: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (ALLOWED_ORIGINS.some((re) => re.test(origin))) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

Deno.serve(async (req) => {
  const cors = corsFor(req.headers.get("origin") || "");
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  try {
    const callerToken = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const supabase = createClient(Deno.env.get("DB_URL")!, Deno.env.get("SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: callerData, error: callerError } = await supabase.auth.getUser(callerToken);
    if (callerError || !callerData?.user || callerData.user.email !== ADMIN_EMAIL) return json(403, { error: "Not authorized" });

    const { targetUserId } = await req.json();
    if (!targetUserId || !UUID.test(String(targetUserId))) return json(400, { error: "Missing or invalid targetUserId" });
    if (targetUserId === callerData.user.id) return json(400, { error: "Cannot delete your own admin account through this tool" });

    const warnings: string[] = [];

    // A paid plan that is not set to cancel keeps billing after the login is gone.
    const { data: profs } = await supabase.from("profiles").select("plan, plan_cancel_at").eq("user_id", targetUserId);
    if ((profs || []).some((p: any) => p.plan && p.plan !== "free" && !p.plan_cancel_at)) {
      warnings.push("This person is on a paid plan that was not cancelled. Cancel it in Stripe so they are not billed.");
    }

    // Which files go. Read BEFORE the login is deleted, because it depends on the records that are still there.
    const { data: files, error: pathErr } = await supabase.rpc("sw_account_storage_paths", { p_user: targetUserId });
    if (pathErr) return json(500, { error: "Could not list files, nothing was deleted: " + pathErr.message });

    // Deleting the login runs the database cleanup first. If it cannot finish, the whole delete is rolled back.
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(targetUserId);
    if (authDeleteError) return json(500, { error: "Nothing was deleted: " + authDeleteError.message });

    // Files last. A failure here leaves stray files, never stray data, and is reported.
    let failed = 0;
    const byBucket = new Map<string, string[]>();
    for (const f of (files || []) as Array<{ bucket: string; path: string }>) {
      if (!byBucket.has(f.bucket)) byBucket.set(f.bucket, []);
      byBucket.get(f.bucket)!.push(f.path);
    }
    for (const [bucket, paths] of byBucket) {
      for (let i = 0; i < paths.length; i += 100) {
        const { error } = await supabase.storage.from(bucket).remove(paths.slice(i, i + 100));
        if (error) { failed += paths.slice(i, i + 100).length; console.error("[admin-delete-user] storage:", bucket, error.message); }
      }
    }
    if (failed) warnings.push(`${failed} uploaded file(s) could not be removed from storage.`);

    return json(200, { success: true, warnings });
  } catch (err) {
    return json(500, { error: (err as Error).message });
  }
});
