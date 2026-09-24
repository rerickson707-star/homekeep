// ─── PROPERTY LOOKUP SERVICE ─────────────────────────────────────────────────
// v2: thin client wrapper only. The real APIllow key and all submit/poll/parse
// logic now live server-side in the property-lookup Supabase Edge Function.
//
// Why this changed: this file used to hold the key directly via
// `import.meta.env.VITE_APILLOW_KEY`. Vite inlines any VITE_-prefixed env var
// straight into the public JS bundle at build time -- that's what the VITE_
// prefix is *for* -- so the key was sitting in plain text in index-*.js for
// anyone to copy. It also logged every step (including the key prefix, job
// IDs, and the full parsed response) to the browser console on every lookup.
// Moving the whole flow into an edge function fixes both: the key becomes a
// normal Supabase secret that never reaches the browser, and all the
// diagnostic logging moves to the (private, server-side) edge function logs.
//
// Same function signature and return shape as before, so every existing
// caller keeps working with no changes on their end: resolves to the parsed
// property object, resolves to null when APIllow found no match, or throws
// an Error on failure -- exactly as before.

import { supabase } from "../supabase";

export async function lookupProperty(address) {
  const { data, error } = await supabase.functions.invoke("property-lookup", {
    body: { address },
  });

  if (error) {
    // supabase-js wraps a non-2xx edge function response in a generic
    // FunctionsHttpError whose own .message isn't useful ("Edge Function
    // returned a non-2xx status code") -- the real reason is in the response
    // body the function returned, so pull that out when it's there.
    let message = error.message;
    try {
      const body = await error.context?.json?.();
      if (body?.error) message = body.error;
    } catch {
      // fall back to the generic message above
    }
    throw new Error(message);
  }

  return data?.result ?? null;
}
