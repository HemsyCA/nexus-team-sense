import { createClient, type SupabaseClientOptions } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el archivo .env",
  );
}

async function resolveClientOptions(): Promise<SupabaseClientOptions<"public">> {
  // Node.js < 22 (SSR/dev server) has no native WebSocket — use ws for Realtime.
  if (import.meta.env.SSR) {
    const { default: ws } = await import("ws");
    return {
      realtime: {
        transport: ws as never,
      },
    };
  }

  return {};
}

const clientOptions = await resolveClientOptions();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, clientOptions);
