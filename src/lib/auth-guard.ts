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

export async function redirectIfOnboarded() {
  if (import.meta.env.SSR) return;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw redirect({ to: "/" });
  }

  const { data: profile, error } = await supabase
    .from("digital_twin_profiles")
    .select("user_id")
    .eq("user_id", session.user.id)
    .single();

  if (!error && profile) {
    throw redirect({ to: "/dashboard" });
  }

  return { session, user: session.user };
}
