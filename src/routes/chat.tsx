import { createFileRoute } from "@tanstack/react-router";

import React from "react";
import { AppLayout } from "@/components/AppLayout";
import { NexusChat } from "@/components/NexusChat";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { requireAuthAndOnboarded } from "@/lib/auth-guard";

export const Route = createFileRoute("/chat")({
  beforeLoad: requireAuthAndOnboarded,
  head: () => ({
    meta: [
      { title: "Chat IA · NEXUS LEAD IA" },
      {
        name: "description",
        content: "Conversa con Nexus IA, tu asistente predictivo de clima laboral.",
      },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <ChatPage />
    </ProtectedRoute>
  ),
});

function ChatPage() {
  // Render NexusChat full-screen on mobile, inside AppLayout on desktop
  const [isDesktop, setIsDesktop] = React.useState<boolean>(() => typeof window !== 'undefined' ? window.innerWidth >= 1024 : false);

  React.useEffect(() => {
    const m = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    m.addEventListener('change', handler);
    setIsDesktop(m.matches);
    return () => m.removeEventListener('change', handler);
  }, []);

  if (!isDesktop) {
    return <div className="h-[100dvh] w-full"><NexusChat className="h-full" /></div>;
  }

  return (
    <AppLayout title="Chat con Nexus IA" subtitle="Tu asistente predictivo de bienestar organizacional">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-12">
          <NexusChat className="h-[calc(100vh-13rem)]" />
        </div>
      </div>
    </AppLayout>
  );
}
