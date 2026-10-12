import { createClient, type User } from "@supabase/supabase-js";

// Server-only Supabase client that acts AS the calling user: every query
// carries their JWT, so RLS applies exactly as it does in the browser.
export async function getUserClient(accessToken: string) {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el servidor.");
  }

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  // getUser() validates the token against Supabase Auth (getSession() would
  // trust it blindly).
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Sesión inválida o expirada.");

  return { client, user: data.user as User };
}
