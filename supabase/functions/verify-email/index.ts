import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// GET-accessible via the link in the verification email. Validates the token
// against app_metadata (set only by send-verify-email, never by the client),
// marks the account verified, and redirects back into the app.
Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const uid = url.searchParams.get("uid");
    const token = url.searchParams.get("token");

    if (!uid || !token) {
      return new Response("Missing verification link parameters.", { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("DB_URL"),
      Deno.env.get("SERVICE_ROLE_KEY")
    );

    const { data: userData, error: getError } = await supabase.auth.admin.getUserById(uid);
    if (getError || !userData?.user) {
      return new Response("Could not find that account.", { status: 400 });
    }

    const storedToken = userData.user.app_metadata?.email_verify_token;
    const alreadyVerified = userData.user.app_metadata?.email_verified === true;

    if (alreadyVerified) {
      return Response.redirect("https://www.trysteadwell.app/?verified=already", 302);
    }

    if (!storedToken || storedToken !== token) {
      return new Response("This verification link is invalid or has expired.", { status: 400 });
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(uid, {
      app_metadata: {
        email_verified: true,
        email_verify_token: null,
      },
    });

    if (updateError) {
      return new Response("Something went wrong confirming your email.", { status: 500 });
    }

    return Response.redirect("https://www.trysteadwell.app/?verified=1", 302);
  } catch (err) {
    return new Response("Something went wrong: " + err.message, { status: 500 });
  }
});
