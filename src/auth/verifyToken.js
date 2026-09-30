import { createClient } from "@supabase/supabase-js";

let client = null;

function getClient() {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

/**
 * Resolves a Supabase access token into the account behind it.
 * Returns { userId, displayName } or null when the token is invalid or the
 * account has not picked a display name yet.
 */
export async function getPlayerFromToken(token) {
  const supabase = getClient();
  if (!supabase || typeof token !== "string" || !token) return null;

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError || !profile) return null;

  return { userId: authData.user.id, displayName: profile.display_name };
}
