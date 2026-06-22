import { redirect } from "@tanstack/react-router";

import { supabase } from "./supabase";

export async function requireAuth() {
  if (import.meta.env.SSR) return;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw redirect({ to: "/" });
  }

  return { session, user: session.user };
}

export async function redirectIfAuthenticated() {
  if (import.meta.env.SSR) return;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    throw redirect({ to: "/home" });
  }
}
