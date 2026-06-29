import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase";
import type { DigitalTwinProfile } from "@/types/assessment";

type OnboardingStatus = "loading" | "unauthenticated" | "pending" | "complete" | "error";

export function useOnboardingStatus() {
  const [status, setStatus] = useState<OnboardingStatus>("loading");
  const [profile, setProfile] = useState<DigitalTwinProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      setError(null);
      setStatus("loading");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        if (!cancelled) {
          setStatus("unauthenticated");
          setProfile(null);
        }
        return;
      }

      const { data, error: profileError } = await supabase
        .from<DigitalTwinProfile>("digital_twin_profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (cancelled) return;

      if (profileError) {
        setError(profileError.message);
        setStatus("error");
        return;
      }

      setProfile(data ?? null);
      setStatus(data ? "complete" : "pending");
    }

    void fetchStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(
    () => ({
      status,
      isAuthenticated: status !== "unauthenticated" && status !== "loading" && status !== "error",
      isOnboarded: status === "complete",
      profile,
      error,
    }),
    [error, profile, status],
  );
}
