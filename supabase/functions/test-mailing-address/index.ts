// supabase/functions/test-mailing-address/index.ts
//
// Throwaway diagnostic -- NOT part of the app. Sends one email to a fixed
// test address so you can see exactly what COMPANY_MAILING_ADDRESS resolves
// to inside the real Supabase edge function runtime, same as
// send-price-change-notice.ts, renewal-reminder.ts, and send-gift-email.ts
// all read it. If the secret is missing or wrong, this email will show the
// same placeholder or bad value those three would silently be sending.
//
// Deploy:  npx supabase functions deploy test-mailing-address --no-verify-jwt
// Trigger: curl -X POST https://hjkyameroqufaojuerns.supabase.co/functions/v1/test-mailing-address
//
// Delete when done (it has no reason to exist once you've confirmed the value):
//   npx supabase functions delete test-mailing-address

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM           = "Steadwell <hello@trysteadwell.app>";
const TO             = "rerickson707@gmail.com";

const MAILING_ADDRESS = Deno.env.get("COMPANY_MAILING_ADDRESS")
  || "Steadwell, LLC - mailing address pending, see hello@trysteadwell.app";

serve(async (_req) => {
  const html = `<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;padding:24px;">
  <h2>COMPANY_MAILING_ADDRESS diagnostic</h2>
  <p>This is what the secret resolves to inside a real edge function right now:</p>
  <p style="padding:12px;background:#f4f4f4;border-left:4px solid #C16140;"><strong>${MAILING_ADDRESS}</strong></p>
  <p>If that says "mailing address pending", the secret is not being read correctly.
  If it shows the real St. Petersburg address, the same value is going out in
  send-price-change-notice, renewal-reminder, and send-gift-email footers.</p>
</body></html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to: [TO], subject: "MAILING_ADDRESS diagnostic", html }),
  });

  const result = await res.json();
  return new Response(JSON.stringify({ sent: res.ok, resendResult: result, resolvedAddress: MAILING_ADDRESS }), {
    status: res.ok ? 200 : 500,
    headers: { "Content-Type": "application/json" },
  });
});
