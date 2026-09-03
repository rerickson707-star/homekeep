Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record;

    if (!record || !record.email) {
      return new Response(JSON.stringify({ error: "No email in payload" }), { status: 400 });
    }

    const email = record.email;
    const createdAt = record.created_at || new Date().toISOString();

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + Deno.env.get("RESEND_API_KEY"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Steadwell <hello@trysteadwell.app>",
        to: ["hello@trysteadwell.app"],
        subject: "New Steadwell account: " + email,
        html:
          "<p><strong>New account created</strong></p>" +
          "<p>Email: " + email + "</p>" +
          "<p>Created at: " + createdAt + "</p>" +
          "<p>Note: this fires on account creation, before onboarding or email confirmation.</p>",
      }),
    });

    if (!resendResponse.ok) {
      const errText = await resendResponse.text();
      return new Response(JSON.stringify({ error: errText }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
