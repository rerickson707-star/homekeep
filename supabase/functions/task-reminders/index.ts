// supabase/functions/task-reminders/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("DB_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;
const FROM = "Steadwell <hello@trysteadwell.app>";

serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const target = new Date();
  target.setDate(target.getDate() + 3);
  const targetDate = target.toISOString().slice(0, 10);

  const { data: tasks, error } = await supabase
    .from("tasks").select("id, title, due_date, priority, category, notes, user_id")
    .eq("due_date", targetDate).neq("status", "Completed").neq("status", "In Progress");

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  if (!tasks || tasks.length === 0) return new Response(JSON.stringify({ sent: 0 }), { status: 200 });

  const byUser: Record<string, typeof tasks> = {};
  for (const t of tasks) {
    if (!byUser[t.user_id]) byUser[t.user_id] = [];
    byUser[t.user_id].push(t);
  }

  const { data: { users } } = await supabase.auth.admin.listUsers();
  const emailMap: Record<string, string> = {};
  for (const u of users) { if (u.email) emailMap[u.id] = u.email; }

  // Build profile name map
  const { data: profiles } = await supabase.from("profiles").select("user_id, name").neq("email_digest", false);
  const nameMap: Record<string, string> = {};
  for (const p of profiles || []) {
    if (p.name) nameMap[p.user_id] = p.name.split(" ")[0];
  }

  const results: string[] = [];
  const dueDateFmt = target.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  for (const [userId, userTasks] of Object.entries(byUser)) {
    const email = emailMap[userId];
    if (!email) continue;
    const name = nameMap[userId] || email.split("@")[0];

    const taskItems = userTasks.map(t => {
      const priorityColor = t.priority === "Urgent" ? "#C16140" : t.priority === "High" ? "#B8861E" : "#234A3D";
      return `
        <div style="background:#F4EDDF;border-radius:12px;padding:16px 18px;margin-bottom:10px;border-left:3px solid ${priorityColor};">
          <div style="font-size:15px;font-weight:600;color:#2A2723;margin-bottom:4px;">${t.title}</div>
          <div style="font-size:12px;color:#A8A09A;">${t.category || "General"} · Due ${dueDateFmt}</div>
          ${t.notes ? `<div style="font-size:13px;color:#5A534B;margin-top:6px;">${t.notes}</div>` : ""}
        </div>`;
    }).join("");

    const subject = userTasks.length === 1
      ? `Reminder: "${userTasks[0].title}" is due in 3 days`
      : `${userTasks.length} tasks due in 3 days`;

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><style>:root{color-scheme:light;supported-color-schemes:light;}</style></head>
<body style="margin:0;padding:0;background:#ECE3D2;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#FBF7EE;border-radius:16px;overflow:hidden;">
    <div style="background:#234A3D;padding:26px 36px;display:flex;align-items:center;gap:12px;">
      <div style="width:34px;height:34px;background:#234A3D;border:1.5px solid rgba(244,237,223,.15);border-radius:9px;display:flex;align-items:center;justify-content:center;">
        <svg viewBox="0 0 48 48" fill="none" width="19" height="19">
          <path d="M15 33 L15 21 L24 13 L33 21 L33 33" stroke="#F4EDDF" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M21 33 L21 27 A3 3 0 0 1 27 27 L27 33" stroke="#F4EDDF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M11 34 L37 34" stroke="#F4EDDF" stroke-width="3" stroke-linecap="round"/>
          <circle cx="24" cy="18.5" r="1.8" fill="#C16140"/>
        </svg>
      </div>
      <span style="color:#F4EDDF;font-size:19px;font-weight:700;">Steadwell</span>
    </div>
    <div style="padding:34px 36px;">
      <p style="font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#C16140;margin:0 0 10px;">⏰ Due in 3 days</p>
      <h1 style="font-size:22px;color:#234A3D;font-weight:700;margin:0 0 6px;letter-spacing:-0.3px;">
        Hi ${name} — ${userTasks.length === 1 ? "a task needs your attention" : `${userTasks.length} tasks need your attention`}
      </h1>
      <p style="font-size:14px;color:#A8A09A;margin:0 0 24px;">Due ${dueDateFmt}</p>
      ${taskItems}
      <div style="text-align:center;margin-top:24px;">
        <a href="https://www.trysteadwell.app" style="background:#C16140;color:#fff;text-decoration:none;padding:13px 28px;border-radius:40px;font-size:14px;font-weight:700;display:inline-block;">View in Steadwell →</a>
      </div>
    </div>
    <div style="padding:18px 36px;border-top:1px solid #E0D8C9;text-align:center;">
      <p style="font-size:11px;color:#A8A09A;margin:0;">Steadwell · <a href="https://www.trysteadwell.app" style="color:#A8A09A;">trysteadwell.app</a> · <a href="https://www.trysteadwell.app/unsubscribe?token=${userId}" style="color:#A8A09A;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [email], subject, html }),
    });

    const result = await res.json();
    results.push(`${email}: ${res.ok ? "sent " + result.id : "failed " + JSON.stringify(result)}`);
  }

  return new Response(JSON.stringify({ sent: results.length, results }), { status: 200 });
});
