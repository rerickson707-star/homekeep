import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-04-10",
});

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Price ID map — update here if prices ever change
const PRICES: Record<string, string> = {
  "plus_monthly":  "price_1ToVH5QLebP2eyKuQG7VfUzP",
  "plus_annual":   "price_1ToVHeQLebP2eyKuiqHcwInj",
  "pro_monthly":   "price_1ToVLlQLebP2eyKubhBd2n4i",
  "pro_annual":    "price_1ToVMmQLebP2eyKuamqnD0iN",
};

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // Authenticate the user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });

    const { plan, interval } = await req.json();
    const priceKey = `${plan}_${interval}`; // e.g. "plus_monthly"
    const priceId  = PRICES[priceKey];
    if (!priceId) return new Response(JSON.stringify({ error: "Invalid plan" }), { status: 400, headers: CORS });

    // Look up or create Stripe customer tied to this user
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, email")
      .eq("id", user.id)
      .single();

    let customerId = profile?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    // Create the Checkout session
    const session = await stripe.checkout.sessions.create({
      customer:              customerId,
      mode:                  "subscription",
      payment_method_types:  ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: "https://www.trysteadwell.app/?upgraded=1",
      cancel_url:  "https://www.trysteadwell.app/?upgrade_cancelled=1",
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan,
          interval,
        },
      },
      // Branding — Stripe uses your dashboard logo/colors
      // Custom fields shown on checkout page
      custom_text: {
        submit: { message: "You can cancel anytime from your account settings." },
      },
      allow_promotion_codes: true,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[create-checkout-session]", err);
    return new Response(JSON.stringify({ error: err.message || "Server error" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
