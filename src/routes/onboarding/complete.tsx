import { createFileRoute } from "@tanstack/react-router";
import { DigitalTwinReady } from "@/components/onboarding/DigitalTwinReady";
import { requireAuth } from "@/lib/auth-guard";

export const Route = createFileRoute("/onboarding/complete")({
  beforeLoad: requireAuth,
  head: () => ({
    meta: [
      { title: "Gemelo Digital listo · NEXUS LEAD IA" },
      {
        name: "description",
        content: "Tu Gemelo Digital ha sido elaborado y está listo para el dashboard.",
      },
    ],
  }),
  component: DigitalTwinReady,
});
