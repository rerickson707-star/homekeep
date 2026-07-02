import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-04-10",
});

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET   = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

// Map Stripe price IDs back to plan names
const PRICE_TO_PLAN: Record<string, { plan: string; interval: string }> = {
  "price_1ToVH5QLebP2eyKuQG7VfUzP": { plan: "plus",  interval: "monthly" },
  "price_1ToVHeQLebP2eyKuiqHcwInj": { plan: "plus",  interval: "annual"  },
  "price_1ToVLlQLebP2eyKubhBd2n4i": { plan: "pro",   interval: "monthly" },
  "price_1ToVMmQLebP2eyKuamqnD0iN": { plan: "pro",   interval: "annual"  },
};

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

        if (!userId) { console.error("[stripe-webhook] No user ID on session", session.id); break; }

        // Retrieve the subscription to get the price
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        const priceId      = subscription.items.data[0]?.price?.id;
        const planInfo     = priceId ? PRICE_TO_PLAN[priceId] : null;

        if (!planInfo) { console.error("[stripe-webhook] Unknown price ID:", priceId); break; }

        await supabase.from("profiles").update({
          plan:                   planInfo.plan,
          plan_interval:          planInfo.interval,
          stripe_subscription_id: subscription.id,
          plan_expires_at:        new Date(subscription.current_period_end * 1000).toISOString(),
        }).eq("id", userId);

        console.log(`[stripe-webhook] Upgraded user ${userId} to ${planInfo.plan} ${planInfo.interval}`);
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
          await supabase.from("profiles").update({
            plan:                   planInfo.plan,
            plan_interval:          planInfo.interval,
            plan_expires_at:        new Date(subscription.current_period_end * 1000).toISOString(),
          }).eq("id", userId);
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
        }).eq("id", userId);

        console.log(`[stripe-webhook] Downgraded user ${userId} to free`);
        break;
      }

      default:
        console.log(`[stripe-webhook] Unhandled event: ${event.type}`);
    }
  } catch (err) {
    console.error("[stripe-webhook] Handler error:", err);
    return new Response("Handler error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
