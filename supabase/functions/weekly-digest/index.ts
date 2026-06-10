// supabase/functions/weekly-digest/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("DB_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;
const FROM = "Steadwell <hello@trysteadwell.app>";

function localDate(daysFromNow = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: { users }, error: userErr } = await supabase.auth.admin.listUsers();
  if (userErr) return new Response(JSON.stringify({ error: userErr.message }), { status: 500 });

  // Build profile name map: user_id → first name
  const { data: profiles } = await supabase.from("profiles").select("user_id, name");
  const nameMap: Record<string, string> = {};
  for (const p of profiles || []) {
    if (p.name) nameMap[p.user_id] = p.name.split(" ")[0]; // first name only
  }

  const today = localDate(0);
  const in7 = localDate(7);
  const results: string[] = [];

  for (const user of users) {
    const email = user.email;
    if (!email) continue;
    const userId = user.id;
    const name = nameMap[userId] || email.split("@")[0];

    const { data: upcomingTasks } = await supabase
      .from("tasks").select("title, due_date, priority, status")
      .eq("user_id", userId).gte("due_date", today).lte("due_date", in7)
      .neq("status", "Completed").order("due_date");

    const { data: overdueTasks } = await supabase
      .from("tasks").select("title, due_date, priority")
      .eq("user_id", userId).lt("due_date", today)
      .neq("status", "Completed").order("due_date");

    const in30 = localDate(30);
    const { data: expiringWarranties } = await supabase
      .from("warranties").select("item, expiry_date, category")
      .eq("user_id", userId).gte("expiry_date", today).lte("expiry_date", in30)
      .order("expiry_date");

    const hasContent = (upcomingTasks?.length ?? 0) > 0 ||
                       (overdueTasks?.length ?? 0) > 0 ||
                       (expiringWarranties?.length ?? 0) > 0;
    if (!hasContent) { results.push(`${email}: skipped (nothing to report)`); continue; }

    const taskRows = (upcomingTasks ?? []).map(t => {
      const days = daysUntil(t.due_date);
      const when = days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`;
      const color = t.priority === "Urgent" || t.priority === "High" ? "#C16140" : "#234A3D";
      return `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #E0D8C9;font-size:14px;color:#2A2723;">${t.title}</td>
        <td style="padding:8px 0;border-bottom:1px solid #E0D8C9;font-size:13px;color:${color};font-weight:600;text-align:right;white-space:nowrap;">${when}</td>
      </tr>`;
    }).join("");

    const overdueRows = (overdueTasks ?? []).slice(0, 5).map(t => {
      const days = Math.abs(daysUntil(t.due_date));
      return `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #E0D8C9;font-size:14px;color:#C16140;">${t.title}</td>
        <td style="padding:8px 0;border-bottom:1px solid #E0D8C9;font-size:13px;color:#C16140;font-weight:600;text-align:right;">${days}d overdue</td>
      </tr>`;
    }).join("");

    const warrantyRows = (expiringWarranties ?? []).map(w => {
      const days = daysUntil(w.expiry_date);
      return `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #E0D8C9;font-size:14px;color:#2A2723;">${w.item}</td>
        <td style="padding:8px 0;border-bottom:1px solid #E0D8C9;font-size:13px;color:#B8861E;font-weight:600;text-align:right;">${days}d left</td>
      </tr>`;
    }).join("");

    const overdueSection = overdueRows ? `
      <div style="margin-bottom:28px;">
        <div style="font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#C16140;margin-bottom:12px;">⚠ Overdue</div>
        <table style="width:100%;border-collapse:collapse;">${overdueRows}</table>
      </div>` : "";

    const upcomingSection = taskRows ? `
      <div style="margin-bottom:28px;">
        <div style="font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#234A3D;margin-bottom:12px;">📋 This week</div>
        <table style="width:100%;border-collapse:collapse;">${taskRows}</table>
      </div>` : "";

    const warrantySection = warrantyRows ? `
      <div style="margin-bottom:28px;">
        <div style="font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#B8861E;margin-bottom:12px;">🔒 Expiring soon</div>
        <table style="width:100%;border-collapse:collapse;">${warrantyRows}</table>
      </div>` : "";

    const weekLabel = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" });

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ECE3D2;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:580px;margin:40px auto;background:#FBF7EE;border-radius:16px;overflow:hidden;">
    <div style="background:#234A3D;padding:28px 40px;display:flex;align-items:center;gap:12px;">
      <div style="width:36px;height:36px;background:#C16140;border-radius:9px;display:flex;align-items:center;justify-content:center;">
        <svg viewBox="0 0 48 48" fill="none" width="20" height="20">
          <path d="M12 34 L12 20 L24 10 L36 20 L36 34" stroke="#F4EDDF" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M8 35.5 L40 35.5" stroke="#F4EDDF" stroke-width="3" stroke-linecap="round"/>
        </svg>
      </div>
      <span style="color:#F4EDDF;font-size:20px;font-weight:700;">Steadwell</span>
      <span style="color:rgba(244,237,223,.5);font-size:14px;margin-left:auto;">Week of ${weekLabel}</span>
    </div>
    <div style="padding:36px 40px;">
      <h1 style="font-size:22px;color:#234A3D;font-weight:700;margin:0 0 6px;letter-spacing:-0.3px;">Your home this week, ${name}</h1>
      <p style="font-size:14px;color:#A8A09A;margin:0 0 28px;">Here's what needs your attention.</p>
      ${overdueSection}
      ${upcomingSection}
      ${warrantySection}
      <div style="text-align:center;margin-top:8px;">
        <a href="https://www.trysteadwell.app" style="background:#C16140;color:#fff;text-decoration:none;padding:13px 28px;border-radius:40px;font-size:14px;font-weight:700;display:inline-block;">View my home →</a>
      </div>
    </div>
    <div style="padding:20px 40px;border-top:1px solid #E0D8C9;text-align:center;">
      <p style="font-size:11px;color:#A8A09A;margin:0;">Steadwell · <a href="https://www.trysteadwell.app" style="color:#A8A09A;">trysteadwell.app</a></p>
    </div>
  </div>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [email], subject: `Your Steadwell digest — week of ${weekLabel}`, html }),
    });

    const result = await res.json();
    results.push(`${email}: ${res.ok ? "sent " + result.id : "failed " + JSON.stringify(result)}`);
  }

  return new Response(JSON.stringify({ results }), { status: 200 });
});
