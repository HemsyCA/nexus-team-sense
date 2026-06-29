import { createFileRoute } from "@tanstack/react-router";
import { AssessmentFlow } from "@/components/onboarding/AssessmentFlow";
import { requireAuth, redirectIfOnboarded } from "@/lib/auth-guard";

export const Route = createFileRoute("/onboarding")({
  beforeLoad: redirectIfOnboarded,
  head: () => ({
    meta: [
      { title: "Onboarding · NEXUS LEAD IA" },
      {
        name: "description",
        content: "Completa los tests para crear tu Gemelo Digital en Nexus Lead IA.",
      },
    ],
  }),
  component: AssessmentFlow,
});
