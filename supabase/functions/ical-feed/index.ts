// supabase/functions/ical-feed/index.ts
// Generates a valid iCal (.ics) feed from the user's tasks and warranty expiries
// URL: /functions/v1/ical-feed?token=CALENDAR_TOKEN
// Deploy: npx supabase functions deploy ical-feed --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL          = Deno.env.get("DB_URL")!;
const SUPABASE_SERVICE_ROLE = Deno.env.get("SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

// ── iCal helpers ──────────────────────────────────────────────────────────────

// Fold long lines per RFC 5545 (max 75 octets per line)
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const chunks: string[] = [];
  let pos = 0;
  let first = true;
  while (pos < line.length) {
    const prefix = first ? "" : " ";
    const available = first ? 75 : 74;
    // Approximate: take chars until we'd exceed byte limit
    let end = pos + available;
    if (end > line.length) end = line.length;
    chunks.push(prefix + line.slice(pos, end));
    pos = end;
    first = false;
  }
  return chunks.join("\r\n");
}

// Format a date-only string (YYYY-MM-DD) as iCal DATE value
function icalDate(dateStr: string): string {
  return dateStr.replace(/-/g, "");
}

// Current UTC timestamp for DTSTAMP
function icalNow(): string {
  return new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
}

// Escape special chars in iCal text fields
function icalEscape(str: string): string {
  return (str || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function buildEvent(params: {
  uid: string;
  summary: string;
  description?: string;
  dateStr: string;    // YYYY-MM-DD
  alarmDaysBefore?: number;
  categories?: string;
}): string {
  const { uid, summary, description, dateStr, alarmDaysBefore, categories } = params;
  const dtStamp = icalNow();
  const dtStart = icalDate(dateStr);

  const lines = [
    "BEGIN:VEVENT",
    fold(`UID:${uid}@steadwell`),
    `DTSTAMP:${dtStamp}`,
    `DTSTART;VALUE=DATE:${dtStart}`,
    `DTEND;VALUE=DATE:${dtStart}`,
    fold(`SUMMARY:${icalEscape(summary)}`),
  ];

  if (description) {
    lines.push(fold(`DESCRIPTION:${icalEscape(description)}`));
  }
  if (categories) {
    lines.push(fold(`CATEGORIES:${icalEscape(categories)}`));
  }

  // Add alarm if requested
  if (alarmDaysBefore && alarmDaysBefore > 0) {
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      fold(`DESCRIPTION:${icalEscape(summary)}`),
      `TRIGGER:-P${alarmDaysBefore}D`,
      "END:VALARM"
    );
  }

  lines.push("END:VEVENT");
  return lines.join("\r\n");
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  const url   = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response("Missing token", { status: 400 });
  }

  // Look up user by calendar_token
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("user_id, address")
    .eq("calendar_token", token)
    .single();

  if (profileErr || !profile) {
    return new Response("Invalid token", { status: 401 });
  }

  const userId = profile.user_id;
  const calendarName = profile.address
    ? `Steadwell — ${profile.address.split(",")[0]}`
    : "Steadwell Home";

  // Fetch tasks with due dates and open warranties with expiry dates in parallel
  const [tasksRes, warrantiesRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, due_date, category, priority, notes, status")
      .eq("user_id", userId)
      .not("due_date", "is", null)
      .neq("status", "done"),

    supabase
      .from("warranties")
      .select("id, item, expiry_date, category, notes")
      .eq("user_id", userId)
      .not("expiry_date", "is", null)
      .is("retired_at", null),
  ]);

  const tasks     = tasksRes.data     || [];
  const warranties = warrantiesRes.data || [];

  // Build events
  const events: string[] = [];

  for (const task of tasks) {
    if (!task.due_date) continue;

    const priority = task.priority === "high" ? "🔴 " : task.priority === "medium" ? "🟡 " : "";
    const summary  = `${priority}${task.title}`;
    const descParts = [
      task.category && `Category: ${task.category}`,
      task.notes    && `Notes: ${task.notes}`,
      "— Steadwell Home Maintenance",
    ].filter(Boolean);

    events.push(buildEvent({
      uid:              `task-${task.id}`,
      summary,
      description:      descParts.join("\\n"),
      dateStr:          task.due_date,
      alarmDaysBefore:  task.priority === "high" ? 3 : 1,
      categories:       "Home Maintenance",
    }));
  }

  for (const warranty of warranties) {
    if (!warranty.expiry_date) continue;

    events.push(buildEvent({
      uid:              `warranty-expiry-${warranty.id}`,
      summary:          `${warranty.item} warranty expires`,
      description:      [
        warranty.category && `Category: ${warranty.category}`,
        warranty.notes    && `Notes: ${warranty.notes}`,
        "— Steadwell Warranty Tracker",
      ].filter(Boolean).join("\\n"),
      dateStr:          warranty.expiry_date,
      alarmDaysBefore:  30,
      categories:       "Warranty",
    }));

    // 30-day advance warning event
    const expDate  = new Date(warranty.expiry_date + "T00:00:00");
    expDate.setDate(expDate.getDate() - 30);
    const warnDate = expDate.toISOString().split("T")[0];

    events.push(buildEvent({
      uid:         `warranty-warn-${warranty.id}`,
      summary:     `${warranty.item} warranty expires in 30 days`,
      description: `Expiry date: ${warranty.expiry_date}\\n— Steadwell Warranty Tracker`,
      dateStr:     warnDate,
      categories:  "Warranty",
    }));
  }

  // Assemble the full iCal document
  const ical = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Steadwell//Home Management//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    fold(`X-WR-CALNAME:${calendarName}`),
    "X-WR-TIMEZONE:America/New_York",
    "X-PUBLISHED-TTL:PT1H",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ical, {
    headers: {
      "Content-Type":        "text/calendar;charset=utf-8",
      "Content-Disposition": `attachment; filename="steadwell.ics"`,
      "Cache-Control":       "no-cache, no-store",
    },
  });
});
