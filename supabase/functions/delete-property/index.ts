// supabase/functions/delete-property/index.ts
// Removes one home (and everything attached to it) for the signed-in owner.
//
// Rules this function keeps:
//  - The user is read from the login token. The browser sends only a propertyId; it never
//    sends a user id, plan or tier.
//  - Only the owner of the home can remove it. Shared members cannot.
//  - The oldest home (it carries the plan) and the last remaining home are never removed.
//  - The database part is one transaction (public.delete_property). Files in storage are
//    removed afterwards, best effort, so a storage hiccup never leaves a half-deleted home.
//
// Run steadwell-delete-property.sql FIRST.
// Deploy: npx supabase functions deploy delete-property --project-ref hjkyameroqufaojuerns
// (JWT verification stays ON.)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://hjkyameroqufaojuerns.supabase.co";
const SERVICE_KEY  = Deno.env.get("SERVICE_ROLE_KEY")!;
const BUCKET       = "expense-files";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const ALLOWED_ORIGINS = [
  /^https:\/\/(www\.)?trysteadwell\.app$/,
  /^https:\/\/homekeep-git-[a-z0-9-]+\.vercel\.app$/,
  /^http:\/\/localhost:\d+$/,
];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function corsFor(origin: string): Record<string, string> {
  const h: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (ALLOWED_ORIGINS.some((re) => re.test(origin))) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

// Tables whose rows can point at files in the expense-files bucket.
const FILE_TABLES = ["expenses", "warranties", "projects", "asset_service_log", "asset_assessments", "tasks"];
const URL_RE = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/expense-files\/([^"?#\\\s]+)/g;

async function collectFilePaths(userId: string, propertyId: string): Promise<string[]> {
  const paths = new Set<string>();
  const warrantyIds: string[] = [];
  for (const table of FILE_TABLES) {
    const { data, error } = await admin.from(table).select("*").eq("property_id", propertyId).limit(5000);
    if (error || !data) continue;
    const blob = JSON.stringify(data);
    for (const m of blob.matchAll(URL_RE)) {
      try { paths.add(decodeURIComponent(m[1])); } catch { paths.add(m[1]); }
    }
    if (table === "warranties") for (const r of data) if (r?.id) warrantyIds.push(String(r.id));
  }
  // Condition-assessment photos live under <user>/assessments/<asset id>/
  for (const id of warrantyIds) {
    const folder = `${userId}/assessments/${id}`;
    const { data } = await admin.storage.from(BUCKET).list(folder, { limit: 200 });
    for (const f of data || []) if (f?.name) paths.add(`${folder}/${f.name}`);
  }
  // Only ever touch this user's own folder.
  return [...paths].filter((p) => p.startsWith(`${userId}/`));
}

serve(async (req) => {
  const cors = corsFor(req.headers.get("origin") || "");
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "not_signed_in" });
  const { data: u, error: uErr } = await admin.auth.getUser(token);
  if (uErr || !u?.user) return json(401, { error: "not_signed_in" });
  const userId = u.user.id;

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json(400, { error: "bad_request" }); }
  const propertyId = String(b?.propertyId ?? "");
  if (!UUID_RE.test(propertyId)) return json(400, { error: "bad_request" });

  try {
    // Gather file paths BEFORE the rows disappear.
    const filePaths = await collectFilePaths(userId, propertyId);

    const { data, error } = await admin.rpc("delete_property", { p_user: userId, p_property: propertyId });
    if (error) {
      const msg = String(error.message || "");
      for (const code of ["not_owner", "last_home", "primary_home"]) {
        if (msg.includes(code)) return json(code === "not_owner" ? 403 : 409, { error: code });
      }
      console.error("[delete-property] rpc failed:", msg);
      return json(500, { error: "delete_failed" });
    }

    // Files: best effort, in batches.
    let removed = 0;
    for (let i = 0; i < filePaths.length; i += 100) {
      const batch = filePaths.slice(i, i + 100);
      const { error: rmErr } = await admin.storage.from(BUCKET).remove(batch);
      if (rmErr) console.error("[delete-property] storage cleanup:", rmErr.message);
      else removed += batch.length;
    }

    return json(200, { ok: true, deleted: data?.deleted ?? {}, filesRemoved: removed });
  } catch (e) {
    console.error("[delete-property] error:", (e as Error)?.message);
    return json(500, { error: "delete_failed" });
  }
});
