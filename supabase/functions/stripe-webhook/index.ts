import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-04-10",
});

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET   = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const RESEND_API_KEY   = Deno.env.get("RESEND_API_KEY") ?? "";

// Map Stripe price IDs back to plan names
const PRICE_TO_PLAN: Record<string, { plan: string; interval: string }> = {
  "price_1ToVH5QLebP2eyKuQG7VfUzP": { plan: "plus",  interval: "monthly" },
  "price_1ToVHeQLebP2eyKuiqHcwInj": { plan: "plus",  interval: "annual"  },
  "price_1ToVLlQLebP2eyKubhBd2n4i": { plan: "pro",   interval: "monthly" },
  "price_1ToVMmQLebP2eyKuamqnD0iN": { plan: "pro",   interval: "annual"  },
};

// As of the API version this Stripe account is now sending events on,
// `current_period_end`/`current_period_start` live on each subscription ITEM,
// not on the subscription object itself (that top-level field is gone). Read
// from the first item, with a fallback to the old top-level field in case an
// older API version or a differently-shaped object still has it there, and
// return null instead of crashing if genuinely neither is present.
function getPeriodEnd(subscription: Stripe.Subscription): number | null {
  const fromItem = (subscription.items?.data?.[0] as any)?.current_period_end;
  const fromTop  = (subscription as any).current_period_end;
  return fromItem ?? fromTop ?? null;
}

// ── Heads-up email to hello@ for billing events. Best effort: a failure here is logged and
// never changes what the webhook does for the customer, and never makes Stripe retry the event.
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as Record<string, string>)[c]);
async function notifyOwner(subject: string, rows: Array<[string, string]>, attention = false): Promise<void> {
  try {
    if (!RESEND_API_KEY) { console.error("[stripe-webhook] RESEND_API_KEY not set; owner email skipped"); return; }
    const accent = attention ? "#B0432B" : "#234A3D";
    const html = `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#F4EDDF;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#FFFDF8;border-radius:12px;overflow:hidden;border:1px solid #E0D8C9;">
    <div style="padding:20px 28px;background:${accent};color:#fff;font-size:17px;font-weight:700;">${esc(subject)}</div>
    <div style="padding:20px 28px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#2A2723;">
        ${rows.filter(([, v]) => v !== "").map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#7A7370;vertical-align:top;white-space:nowrap;">${esc(k)}</td><td style="padding:6px 0;font-weight:600;word-break:break-word;">${esc(v)}</td></tr>`).join("")}
      </table>
    </div>
    <div style="padding:12px 28px;border-top:1px solid #E0D8C9;text-align:center;font-size:11px;color:#A8A09A;">Steadwell billing alert</div>
  </div></body></html>`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Steadwell <hello@trysteadwell.app>", to: ["hello@trysteadwell.app"], subject, html }),
    });
    if (!res.ok) console.error(`[stripe-webhook] owner email failed: Resend ${res.status}`, (await res.text().catch(() => "")).slice(0, 300));
  } catch (e) {
    console.error("[stripe-webhook] owner email failed:", (e as Error).message);
  }
}
const money = (cents: number | null | undefined, cur: string | null | undefined) =>
  cents == null ? "" : `${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${String(cur || "").toUpperCase()}`;

serve(async (req) => {
  const body      = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, WEBHOOK_SECRET);
  } catch (err) {
    console.error("[stripe-webhook] Signature verification failed:", err.message);
    return new Response(`Webhook error: ${err.message}`, { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  try {
    switch (event.type) {

      // ── Payment succeeded — upgrade the user
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const userId = session.subscription_data?.metadata?.supabase_user_id
          ?? (await stripe.customers.retrieve(session.customer as string) as Stripe.Customer).metadata?.supabase_user_id;

        if (!userId) {
          console.error("[stripe-webhook] No user ID on session", session.id);
          await notifyOwner("CHECK BILLING: payment received but no account matched", [
            ["Customer", session.customer_details?.email ?? ""], ["Checkout session", session.id],
            ["What to do", "Open this payment in Stripe and set the plan by hand. The customer has paid but was not upgraded."],
          ], true);
          break;
        }

        // Retrieve the subscription to get the price
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        const priceId      = subscription.items.data[0]?.price?.id;
        const planInfo     = priceId ? PRICE_TO_PLAN[priceId] : null;

        if (!planInfo) {
          console.error("[stripe-webhook] Unknown price ID:", priceId);
          await notifyOwner("CHECK BILLING: payment received for an unrecognized price", [
            ["Customer", session.customer_details?.email ?? ""], ["Price ID", String(priceId ?? "")], ["Checkout session", session.id],
            ["What to do", "Add this price to PRICE_TO_PLAN in stripe-webhook, then set the customer's plan by hand. They have paid but were not upgraded."],
          ], true);
          break;
        }

        const periodEnd = getPeriodEnd(subscription);
        if (periodEnd == null) console.error("[stripe-webhook] No current_period_end found on subscription", subscription.id);

        await supabase.from("profiles").update({
          plan:                   planInfo.plan,
          plan_interval:          planInfo.interval,
          stripe_subscription_id: subscription.id,
          plan_expires_at:        periodEnd != null ? new Date(periodEnd * 1000).toISOString() : null,
          // Anchor date for the renewal-reminder function: this is a brand new
          // checkout, so it's the true start of this subscription. Used as the
          // once-a-year "recurring charge" reminder date for monthly plans,
          // which don't otherwise have a single yearly date to count down to.
          // Also reset the dedup markers so a resubscribe after cancellation
          // starts its own reminder cycle instead of inheriting the old one's.
          plan_started_at:                    new Date().toISOString(),
          last_renewal_reminder_sent_at:       null,
          last_annual_charge_reminder_sent_at: null,
        }).eq("user_id", userId);

        console.log(`[stripe-webhook] Upgraded user ${userId} to ${planInfo.plan} ${planInfo.interval}`);
        const unit = subscription.items.data[0]?.price;
        await notifyOwner(`New ${planInfo.plan === "pro" ? "Pro" : "Plus"} subscriber (${planInfo.interval})`, [
          ["Customer", session.customer_details?.email ?? ""],
          ["Name", session.customer_details?.name ?? ""],
          ["Country", session.customer_details?.address?.country ?? ""],
          ["Plan", `${planInfo.plan} ${planInfo.interval}`],
          ["List price", money(unit?.unit_amount, unit?.currency)],
          ["Charged", money(session.amount_total, session.currency)],
          ["Renews", periodEnd != null ? new Date(periodEnd * 1000).toISOString().slice(0, 10) : ""],
          ["Subscription", subscription.id],
        ]);
        break;
      }

      // ── Subscription renewed — refresh expiry date
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId       = subscription.metadata?.supabase_user_id;
        if (!userId) break;

        const priceId  = subscription.items.data[0]?.price?.id;
        const planInfo = priceId ? PRICE_TO_PLAN[priceId] : null;

        if (subscription.status === "active" && planInfo) {
          const periodEnd = getPeriodEnd(subscription);
          if (periodEnd == null) console.error("[stripe-webhook] No current_period_end found on subscription", subscription.id);

          await supabase.from("profiles").update({
            plan:                   planInfo.plan,
            plan_interval:          planInfo.interval,
            plan_expires_at:        periodEnd != null ? new Date(periodEnd * 1000).toISOString() : null,
          }).eq("user_id", userId);
        }
        break;
      }

      // ── Subscription cancelled or payment failed — downgrade to free
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId       = subscription.metadata?.supabase_user_id;
        if (!userId) break;

        await supabase.from("profiles").update({
          plan:                   "free",
          plan_interval:          null,
          stripe_subscription_id: null,
          plan_expires_at:        null,
        }).eq("user_id", userId);

        console.log(`[stripe-webhook] Downgraded user ${userId} to free`);
        const gone = subscription.items.data[0]?.price;
        let who = "";
        try { who = ((await stripe.customers.retrieve(subscription.customer as string)) as Stripe.Customer).email ?? ""; } catch { /* best effort */ }
        await notifyOwner("Subscription ended", [
          ["Customer", who],
          ["Plan", (gone?.id && PRICE_TO_PLAN[gone.id]) ? `${PRICE_TO_PLAN[gone.id].plan} ${PRICE_TO_PLAN[gone.id].interval}` : ""],
          ["Reason", subscription.cancellation_details?.reason ?? ""],
          ["Feedback", subscription.cancellation_details?.feedback ?? ""],
          ["Subscription", subscription.id],
        ]);
        break;
      }

      // ── A renewal was paid. The first payment is covered by the "New subscriber" email, so only renewals come through here.
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.billing_reason !== "subscription_cycle") break;
        await notifyOwner("Subscription renewed", [
          ["Customer", invoice.customer_email ?? ""],
          ["Amount", money(invoice.amount_paid, invoice.currency)],
          ["Invoice", invoice.number ?? invoice.id ?? ""],
          ["Invoice link", invoice.hosted_invoice_url ?? ""],
        ]);
        break;
      }

      // ── A renewal or first charge failed. Stripe retries on its own; this is only a heads-up.
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await notifyOwner("Payment failed", [
          ["Customer", invoice.customer_email ?? ""],
          ["Amount", money(invoice.amount_due, invoice.currency)],
          ["Attempt", String(invoice.attempt_count ?? "")],
          ["Invoice", invoice.id ?? ""],
          ["Note", "Stripe retries automatically. If every retry fails the subscription ends and the plan drops to Free."],
        ], true);
        break;
      }

      default:
        console.log(`[stripe-webhook] Unhandled event: ${event.type}`);
    }
  } catch (err) {
    console.error("[stripe-webhook] Handler error:", err);

    // Surface this in /admin -- best-effort: if the alert insert itself fails,
    // don't let that mask the original error or crash the response.
    try {
      await supabase.from("system_alerts").insert([{
        source:  "stripe-webhook",
        message: `Handler error on ${event.type} (event ${event.id}): ${err?.message || String(err)}`,
      }]);
    } catch (alertErr) {
      console.error("[stripe-webhook] Also failed to write system_alerts:", alertErr);
    }

    return new Response("Handler error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
