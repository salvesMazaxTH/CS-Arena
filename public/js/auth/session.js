import { createClient } from "@supabase/supabase-js";

const config = window.CSA_CONFIG || {};

export const supabase =
  config.supabaseUrl && config.supabaseAnonKey
    ? createClient(config.supabaseUrl, config.supabaseAnonKey)
    : null;

export const DISPLAY_NAME_MIN = 3;
export const DISPLAY_NAME_MAX = 20;

const UNIQUE_VIOLATION = "23505";

/** Returns an error code ("too_short" | "too_long") or null when the name is fine. */
export function validateDisplayName(name) {
  const trimmed = String(name ?? "").trim();
  if (trimmed.length < DISPLAY_NAME_MIN) return "too_short";
  if (trimmed.length > DISPLAY_NAME_MAX) return "too_long";
  return null;
}

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

export function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/` },
  });
}

export async function signOut() {
  await supabase?.auth.signOut();
}

/** The signed-in account's profile, or null when none exists yet. */
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, selected_team_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** True when no other account already uses this name (case-insensitive). */
export async function isDisplayNameAvailable(name, ownUserId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .ilike("display_name", name.trim().replace(/[\\%_]/g, "\\$&"))
    .limit(1);
  if (error) throw error;
  return data.length === 0 || data[0].id === ownUserId;
}

/**
 * Creates the profile or renames it. Returns { ok: true, profile } or
 * { ok: false, reason: "too_short" | "too_long" | "taken" | "error" }.
 * The unique index is the real guard; the availability check is only a courtesy.
 */
export async function saveDisplayName(userId, name) {
  const invalid = validateDisplayName(name);
  if (invalid) return { ok: false, reason: invalid };

  const displayName = name.trim();
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      { id: userId, display_name: displayName, updated_at: new Date().toISOString() },
      { onConflict: "id" },
    )
    .select("id, display_name, selected_team_id")
    .single();

  if (error) {
    return { ok: false, reason: error.code === UNIQUE_VIOLATION ? "taken" : "error" };
  }
  return { ok: true, profile: data };
}
