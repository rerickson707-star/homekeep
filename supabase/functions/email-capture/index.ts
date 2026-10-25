// supabase/functions/email-capture/index.ts
// Receives inbound emails from Resend, parses with Claude, stores in email_captures table
// Deploy: npx supabase functions deploy email-capture --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY        = Deno.env.get("RESEND_API_KEY")!;
const RESEND_WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET")!;
const ANTHROPIC_API_KEY     = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL          = "https://hjkyameroqufaojuerns.supabase.co";
const SERVICE_KEY           = Deno.env.get("SERVICE_ROLE_KEY")!;
const FROM                  = "Steadwell <hello@trysteadwell.app>";

// ── Verify Resend webhook signature ──────────────────────────────────────────
async function verifySignature(body: string, headers: Headers): Promise<boolean> {
  try {
    const svixId        = headers.get("svix-id") || "";
    const svixTimestamp = headers.get("svix-timestamp") || "";
    const svixSignature = headers.get("svix-signature") || "";
    if (!svixId || !svixTimestamp || !svixSignature) return false;

    const signedContent = `${svixId}.${svixTimestamp}.${body}`;
    const secret = RESEND_WEBHOOK_SECRET.replace("whsec_", "");
    const keyBytes = Uint8Array.from(atob(secret), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey(
      "raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const sig = await crypto.subtle.sign(
      "HMAC", key, new TextEncoder().encode(signedContent)
    );
    const computedSig = "v1," + btoa(String.fromCharCode(...new Uint8Array(sig)));
    const signatures = svixSignature.split(" ");
    return signatures.some(s => s === computedSig);
  } catch {
    return false;
  }
}

// ── Fetch full email content from Resend API ──────────────────────────────────
async function fetchEmailContent(emailId: string): Promise<{ text: string; html: string; subject: string; from: string }> {
  const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "User-Agent": "Steadwell/1.0",
    },
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error("fetchEmailContent failed:", res.status, errText);
    return { text: "", html: "", subject: "", from: "" };
  }
  const data = await res.json();
  console.log("fetchEmailContent response keys:", Object.keys(data));
  console.log("text length:", data.text?.length || 0, "html length:", data.html?.length || 0);

  // Extract plain text from HTML if text field is null (common with Outlook)
  let bodyText = data.text || "";
  if (!bodyText && data.html) {
    // Strip HTML tags to get plain text
    bodyText = data.html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ")
      .trim();
  }

  return {
    text:    bodyText,
    html:    data.html || "",
    subject: data.subject || "",
    from:    data.from || "",
  };
}

// Also fix attachments endpoint
async function fetchAttachmentsFixed(emailId: string): Promise<any[]> {
  const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}/attachments`, {
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "User-Agent": "Steadwell/1.0",
    },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

// ── Fetch attachments from Resend API ─────────────────────────────────────────
async function fetchAttachments(emailId: string): Promise<any[]> {
  const res = await fetch(`https://api.resend.com/emails/${emailId}/attachments`, {
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

// ── Claude extraction ─────────────────────────────────────────────────────────
async function extractWithClaude(subject: string, body: string, attachments: any[]): Promise<{
  type: string;
  confidence: string;
  data: Record<string, any>;
  summary: string;
}> {
  const attachmentNote = attachments.length > 0
    ? `\n\nAttachments: ${attachments.map(a => a.filename).join(", ")}`
    : "";

  const prompt = `You are parsing a forwarded email for a home management app called Steadwell. Extract structured data from this email.

Email Subject: ${subject}
Email Body:
${body.slice(0, 3000)}${attachmentNote}

Determine what type of home record this email represents and extract the relevant data.

Respond with ONLY valid JSON in this exact format:
{
  "type": "warranty" | "expense" | "document" | "asset" | "unknown",
  "confidence": "high" | "medium" | "low",
  "summary": "One sentence describing what this is",
  "data": {
    "item": "name of the item/product/service",
    "brand": "brand or manufacturer if present",
    "model": "model number if present",
    "amount": 0.00,
    "purchase_date": "YYYY-MM-DD or null",
    "expiry_date": "YYYY-MM-DD or null",
    "category": "HVAC | Appliance | Electronics | Vehicle | Tools | Roofing | Plumbing | Electrical | Structure | Safety | Landscaping | Jewelry & Valuables | Outdoor | Other",
    "notes": "any other relevant details",
    "vendor": "store or company name if present",
    "warranty_years": null
  }
}

Rules:
- type "warranty": receipt for a purchased item with warranty info, or warranty registration
- type "expense": contractor invoice, service bill, repair cost, utility bill
- type "document": inspection report, insurance policy, permit, manual, HOA document
- type "asset": notification about a new home system or appliance being installed
- type "unknown": cannot determine, save as-is
- Set confidence "high" if you are very sure, "medium" if somewhat sure, "low" if guessing
- If amount is not present set to null
- If dates are not present set to null`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    return { type: "unknown", confidence: "low", data: {}, summary: "Could not parse email" };
  }

  const result = await res.json();
  const text = result.content?.[0]?.text || "{}";
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return {
      type:       parsed.type       || "unknown",
      confidence: parsed.confidence || "low",
      data:       parsed.data       || {},
      summary:    parsed.summary    || "Email captured",
    };
  } catch {
    return { type: "unknown", confidence: "low", data: {}, summary: "Could not parse email" };
  }
}

// ── Send confirmation email to user ──────────────────────────────────────────
// v419: same look as the other Steadwell emails (real logo image, tables and inline styles only).
// ── Send confirmation email to user ──────────────────────────────────────────
// v419: same look as the other Steadwell emails (real logo image, tables and inline styles only).
async function sendConfirmation(
  toEmail: string,
  userName: string,
  summary: string,
  type: string,
  confidence: string,
) {
  const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const typeLabel: Record<string, string> = {
    warranty: "Warranty", expense: "Expense", document: "Document", asset: "Item", utility_bill: "Utility bill", unknown: "Email",
  };
  const label = typeLabel[type] || "Email";
  const C = { cream: "#F4EDDF", pine: "#234A3D", clay: "#C16140", ink: "#2A2723", body: "#4A443E", muted: "#7A7168", panel: "#F7F2E8", line: "#E8E0D0" };
  const FONT = "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
  const SERIF = "Georgia,'Times New Roman',serif";
  const LINK = "https://www.trysteadwell.app/?open=inbox";
  const first = esc(userName || "there");
  const low = confidence === "low";
  const intro = `We read the email you forwarded to your Steadwell capture address and filled in what we could. Nothing is saved to your records until you confirm it.`;
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>We captured your email</title></head>
<body style="margin:0;padding:0;background:${C.cream}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.cream}">${esc(summary)}&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.cream}" style="background:${C.cream}"><tr><td align="center" style="padding:32px 14px">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
    <tr><td align="center" bgcolor="${C.pine}" style="background:${C.pine};padding:24px 24px 22px">
      <a href="https://www.trysteadwell.app" style="text-decoration:none"><img src="https://www.trysteadwell.app/icon-192.png" width="48" height="48" alt="Steadwell" style="display:block;margin:0 auto 10px;width:48px;height:48px;border-radius:12px;border:0;color:${C.cream};font:700 14px/48px ${FONT}"></a>
      <span style="font:700 22px/1 ${SERIF};color:${C.cream};letter-spacing:.2px">Steadwell</span>
    </td></tr>
    <tr><td style="padding:32px 36px 8px">
      <h1 style="margin:0 0 12px;font:700 24px/1.25 ${SERIF};color:${C.ink}">Hi ${first}, we captured your email</h1>
      <p style="margin:0 0 22px;font:16px/1.6 ${FONT};color:${C.body}">${intro}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.panel}" style="background:${C.panel};border-radius:12px"><tr><td style="padding:18px 22px">
        <div style="font:13px/1.4 ${FONT};color:${C.muted};margin:0 0 3px">Looks like</div>
        <div style="font:16px/1.45 ${FONT};color:${C.ink};font-weight:700;margin:0 0 14px">${esc(label)}</div>
        <div style="font:13px/1.4 ${FONT};color:${C.muted};margin:0 0 3px">What we found</div>
        <div style="font:16px/1.45 ${FONT};color:${C.ink}">${esc(summary)}</div>
      </td></tr></table>
      ${low ? `<p style="margin:16px 0 0;font:14px/1.5 ${FONT};color:${C.clay}">We weren't fully sure about this one, so please check the details before you save it.</p>` : ""}
      <p style="margin:18px 0 0;font:14px/1.6 ${FONT};color:${C.muted}">In your Email Inbox you can fix any detail, choose how to file it (expense, item you own, document or utility bill), and add an expense to a project.</p>
    </td></tr>
    <tr><td style="padding:24px 36px 28px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td align="center" bgcolor="${C.clay}" style="background:${C.clay};border-radius:10px">
          <a href="${LINK}" style="display:block;padding:15px 24px;font:700 16px/1.2 ${FONT};color:#ffffff !important;text-decoration:none"><span style="color:#ffffff">Review in Steadwell</span></a>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:18px 36px 24px;border-top:1px solid ${C.line}">
      <p style="margin:0;font:12px/1.6 ${FONT};color:${C.muted};text-align:center">You got this because an email was sent to your Steadwell capture address.<br>Steadwell &middot; <a href="https://www.trysteadwell.app" style="color:${C.muted};text-decoration:underline">trysteadwell.app</a></p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
  const text = `Hi ${userName || "there"},\n\nWe captured the email you forwarded to your Steadwell capture address.\n\nLooks like: ${label}\nWhat we found: ${summary}\n${low ? "We weren't fully sure about this one, so please check the details before you save it.\n" : ""}\nReview and save it here: ${LINK}\n\nSteadwell · trysteadwell.app`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [toEmail], subject: `We captured your ${label.toLowerCase()}. Review it in Steadwell`, html, text }),
  });
  if (!res.ok) console.error("sendConfirmation: Resend status", res.status);
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const body = await req.text();

  // Verify webhook signature
  const valid = await verifySignature(body, req.headers);
  if (!valid) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
  }

  const event = JSON.parse(body);
  if (event.type !== "email.received") {
    return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 });
  }

  const { email_id, to, from: fromAddress, subject: rawSubject } = event.data;

  // Extract the capture address from the to field
  const toAddress = Array.isArray(to) ? to[0] : to;
  const captureEmail = toAddress?.toLowerCase().trim();

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Look up which property this email belongs to
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, user_id, name, inbound_email, deletion_requested_at")
    .eq("inbound_email", captureEmail)
    .single();

  if (profileErr || !profile) {
    console.error("No profile found for:", captureEmail);
    return new Response(JSON.stringify({ ok: false, error: "Unknown capture address" }), { status: 200 });
  }

  // The owner closed their account: nothing more is read or paid for on this address.
  if (profile.deletion_requested_at) {
    console.log("Capture address belongs to a closed account, ignoring:", captureEmail);
    return new Response(JSON.stringify({ ok: true, ignored: "account_closed" }), { status: 200 });
  }

  // Get user email for confirmation — guard against null user_id
  let userEmail: string | undefined;
  const userName = profile.name?.split(" ")[0] || "there";
  if (profile.user_id) {
    const { data: { user } } = await supabase.auth.admin.getUserById(profile.user_id);
    userEmail = user?.email;
  }

  // Fetch full email content from Resend
  const { text, subject } = await fetchEmailContent(email_id);
  const attachments = await fetchAttachmentsFixed(email_id);

  // Parse with Claude
  const extracted = await extractWithClaude(subject || rawSubject || "", text, attachments);

  // Store in email_captures table
  const { error: insertErr } = await supabase.from("email_captures").insert({
    user_id:        profile.user_id,
    property_id:    profile.id,
    from_address:   fromAddress,
    subject:        subject || rawSubject || "(no subject)",
    body_text:      text.slice(0, 5000),
    attachment_urls: attachments.map(a => ({ filename: a.filename, url: a.download_url })),
    extracted_type: extracted.type,
    extracted_data: extracted.data,
    confidence:     extracted.confidence,
    status:         "pending",
  });

  if (insertErr) {
    console.error("Insert error:", insertErr.message);
    return new Response(JSON.stringify({ ok: false, error: insertErr.message }), { status: 500 });
  }

  // Send confirmation email
  if (userEmail) {
    await sendConfirmation(userEmail, userName, extracted.summary, extracted.type, extracted.confidence);
  }

  return new Response(JSON.stringify({ ok: true, type: extracted.type, confidence: extracted.confidence }), { status: 200 });
});
