import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

import { supabase } from "../supabase";
import { getUserClient } from "./supabase-user.server";

// Attach to any server fn that must only run for a signed-in user.
// Client side: forwards the Supabase access token as a Bearer header.
// Server side: validates it and exposes { user, supabase } in context, where
// `supabase` queries as that user (RLS enforced).
export const requireUser = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return next({
      headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
    });
  })
  .server(async ({ next }) => {
    const token = getRequestHeader("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) throw new Error("Debes iniciar sesión para usar Nexus IA.");

    const { client, user } = await getUserClient(token);
    return next({ context: { user, supabase: client } });
  });
