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
async function sendConfirmation(
  toEmail: string,
  userName: string,
  summary: string,
  type: string,
  confidence: string,
) {
  const typeLabel: Record<string, string> = {
    warranty: "Warranty",
    expense:  "Expense",
    document: "Document",
    asset:    "Asset",
    unknown:  "Email",
  };
  const typeColor: Record<string, string> = {
    warranty: "#234A3D",
    expense:  "#B8861E",
    document: "#3B5EA6",
    asset:    "#C16140",
    unknown:  "#8A8178",
  };
  const label = typeLabel[type] || "Email";
  const color = typeColor[type] || "#8A8178";
  const confidenceNote = confidence === "low"
    ? "<p style='font-size:13px;color:#C16140;margin:0 0 16px;'>⚠ We weren't fully confident in our parsing — please review this in your Email Inbox.</p>"
    : "";

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ECE3D2;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#FBF7EE;border-radius:16px;overflow:hidden;">
    <div style="background:#234A3D;padding:26px 32px;display:flex;align-items:center;gap:12px;">
      <div style="width:34px;height:34px;background:#C16140;border-radius:9px;display:flex;align-items:center;justify-content:center;">
        <svg viewBox="0 0 48 48" fill="none" width="19" height="19">
          <path d="M15 33 L15 21 L24 13 L33 21 L33 33" stroke="#F4EDDF" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M21 34 L21 27.5 A3 3 0 0 1 27 27.5 L27 34" stroke="#F4EDDF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M11 34.5 L37 34.5" stroke="#F4EDDF" stroke-width="3" stroke-linecap="round"/>
          <circle cx="24" cy="18.3" r="1.5" fill="#D2876A"/>
        </svg>
      </div>
      <span style="color:#F4EDDF;font-size:19px;font-weight:700;">Steadwell</span>
    </div>
    <div style="padding:32px;">
      <div style="display:inline-block;background:${color};color:#fff;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:3px 10px;border-radius:20px;margin-bottom:16px;">${label} Captured</div>
      <h1 style="font-family:Georgia,serif;font-size:22px;color:#234A3D;font-weight:400;margin:0 0 8px;line-height:1.3;">
        Hi ${userName} — we captured your email
      </h1>
      <p style="font-size:14px;color:#5A534B;line-height:1.6;margin:0 0 20px;">${summary}</p>
      ${confidenceNote}
      <p style="font-size:13px;color:#8A8178;margin:0 0 24px;">Review and confirm this in your Steadwell Email Inbox. You can edit any details before saving it to your home records.</p>
      <div style="text-align:center;">
        <a href="https://www.trysteadwell.app" style="background:#C16140;color:#fff;text-decoration:none;padding:13px 28px;border-radius:40px;font-size:14px;font-weight:700;display:inline-block;">
          Review in Steadwell →
        </a>
      </div>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #E0D8C9;text-align:center;">
      <p style="font-size:11px;color:#A8A09A;margin:0;">Steadwell · <a href="https://www.trysteadwell.app" style="color:#A8A09A;">trysteadwell.app</a></p>
    </div>
  </div>
</body>
</html>`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [toEmail],
      subject: `✓ ${label} captured — review it in Steadwell`,
      html,
    }),
  });
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
    .select("id, user_id, name, inbound_email")
    .eq("inbound_email", captureEmail)
    .single();

  if (profileErr || !profile) {
    console.error("No profile found for:", captureEmail);
    return new Response(JSON.stringify({ ok: false, error: "Unknown capture address" }), { status: 200 });
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
