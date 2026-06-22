import { createFileRoute } from "@tanstack/react-router";

import { AppLayout, Card } from "@/components/AppLayout";
import { NexusChat } from "@/components/NexusChat";
import { requireAuth } from "@/lib/auth-guard";

export const Route = createFileRoute("/chat")({
  beforeLoad: requireAuth,
  head: () => ({
    meta: [
      { title: "Chat IA · NEXUS LEAD IA" },
      {
        name: "description",
        content: "Conversa con Nexus IA, tu asistente predictivo de clima laboral.",
      },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  return (
    <AppLayout
      title="Chat con Nexus IA"
      subtitle="Tu asistente predictivo de bienestar organizacional"
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <NexusChat className="h-[calc(100dvh-14rem)] lg:h-[calc(100vh-13rem)]" />
        </div>

        <aside className="hidden space-y-5 lg:col-span-4 lg:block">
          <Card className="bg-brand-navy text-white">
            <div className="text-xs font-semibold uppercase tracking-wider text-brand-blue">
              Modelo Nexus IA · Gemini
            </div>
            <p className="mt-3 text-sm leading-relaxed text-white/80">
              Tono profesional, breve y empático. Las respuestas se basan en
              comentarios anónimos del equipo y datos agregados — nunca
              identifica personas.
            </p>
          </Card>
        </aside>
      </div>
    </AppLayout>
  );
}
