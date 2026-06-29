import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Filter, Heart, HandHelping, ThumbsUp, Send } from "lucide-react";
import { AppLayout, Card } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { requireAuthAndOnboarded } from "@/lib/auth-guard";

export const Route = createFileRoute("/feed")({
  beforeLoad: requireAuthAndOnboarded,
  head: () => ({
    meta: [
      { title: "Feed Anónimo · NEXUS LEAD IA" },
      {
        name: "description",
        content: "Comentarios diarios anónimos del equipo analizados por IA.",
      },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <FeedPage />
    </ProtectedRoute>
  ),
});

type Post =
  | {
      type: "text";
      id: string;
      code: string;
      area: string;
      time: string;
      text: string;
      reactions: { id: number; identify: number; support: number };
      urgency?: "Alta" | "Media" | "Baja";
    }
  | {
      type: "poll";
      id: string;
      code: string;
      area: string;
      time: string;
      question: string;
      options: { label: string; pct: number }[];
    }
  | {
      type: "open";
      id: string;
      code: string;
      area: string;
      time: string;
      question: string;
      responses: number;
    };

const initialPosts: Post[] = [
  {
    type: "text",
    id: "1",
    code: "COL-047",
    area: "Operaciones",
    time: "Hace 12 min",
    text:
      "Hoy sentí mucha presión por los cambios de último momento. Siento que la planificación está fallando y eso afecta nuestra salud mental.",
    reactions: { id: 0, identify: 12, support: 4 },
    urgency: "Alta",
  },
  {
    type: "poll",
    id: "2",
    code: "COL-112",
    area: "Marketing",
    time: "Hace 2 h",
    question: "¿Cómo calificas el clima del equipo hoy?",
    options: [
      { label: "Excelente", pct: 15 },
      { label: "Bueno", pct: 22 },
      { label: "Regular", pct: 48 },
      { label: "Bajo", pct: 15 },
    ],
  },
  {
    type: "open",
    id: "3",
    code: "COL-083",
    area: "Recursos Humanos",
    time: "Hoy",
    question: "¿Qué situación afectó más tu jornada laboral?",
    responses: 27,
  },
  {
    type: "text",
    id: "4",
    code: "COL-129",
    area: "Ingeniería",
    time: "Ayer",
    text:
      "El nuevo flujo de revisiones de código me parece más claro. Creo que mejorará la calidad de las entregas.",
    reactions: { id: 0, identify: 21, support: 0 },
  },
];

const filters = ["Todos", "Operaciones", "Marketing", "Ingeniería", "RR. HH."];

function FeedPage() {
  const [active, setActive] = useState("Todos");
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [draft, setDraft] = useState("");
  const [isPosting, setIsPosting] = useState(false);

  const handlePublish = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;

    setIsPosting(true);
    window.setTimeout(() => {
      setPosts((current) => [
        {
          type: "text",
          id: `${Date.now()}`,
          code: `COL-${Math.floor(100 + Math.random() * 900)}`,
          area: "General",
          time: "Hace unos segundos",
          text: trimmed,
          reactions: { id: 0, identify: 0, support: 0 },
        },
        ...current,
      ]);
      setDraft("");
      setIsPosting(false);
    }, 500);
  };

  return (
    <AppLayout
      title="Feed Anónimo"
      subtitle="Voces reales del equipo, identidades protegidas por código COL-###"
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          {/* Composer */}
          <Card className="mb-5">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-navy text-xs font-mono font-bold text-brand-blue">
                COL-•••
              </div>
              <div className="flex-1">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15"
                  rows={3}
                  placeholder="Comparte cómo te sentiste hoy en el trabajo… (publicación 100% anónima)"
                />
                <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
                  <p className="truncate text-[11px] text-muted-foreground">
                    Tu identidad queda cifrada. Solo se mostrará un código anónimo.
                  </p>
                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={isPosting || !draft.trim()}
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-navy px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-navy/90 disabled:cursor-not-allowed disabled:bg-muted/80"
                  >
                    <Send className="size-3.5" />
                    {isPosting ? "Publicando…" : "Publicar"}
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {/* Filters */}
          <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-1">
            <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <Filter className="size-3" /> Filtros
            </div>
            {filters.map((f) => {
              const isActive = f === active;
              return (
                <button
                  key={f}
                  onClick={() => setActive(f)}
                  className={
                    "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition " +
                    (isActive
                      ? "border-brand-navy bg-brand-navy text-white"
                      : "border-border bg-card text-muted-foreground hover:text-foreground")
                  }
                >
                  {f}
                </button>
              );
            })}
          </div>

          {/* Posts */}
          <div className="space-y-4">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </div>

        {/* Sidebar insights */}
        <aside className="space-y-5 lg:col-span-4">
          <Card>
            <h3 className="text-sm font-bold">Emociones predominantes</h3>
            <p className="mb-4 text-[11px] text-muted-foreground">Hoy · 124 respuestas</p>
            <ul className="space-y-3">
              {[
                { label: "Cansancio", pct: 38, color: "bg-brand-red" },
                { label: "Motivación", pct: 27, color: "bg-brand-emerald" },
                { label: "Ansiedad", pct: 18, color: "bg-brand-amber" },
                { label: "Calma", pct: 17, color: "bg-brand-blue" },
              ].map((e) => (
                <li key={e.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium">{e.label}</span>
                    <span className="text-muted-foreground">{e.pct}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full ${e.color}`} style={{ width: `${e.pct}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="bg-brand-purple/5">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-purple/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-purple">
              IA · Tema emergente
            </div>
            <p className="text-sm leading-relaxed">
              Detecté que <strong>“cambios de último momento”</strong> aparece en
              7 publicaciones hoy. Considera revisar la planificación semanal.
            </p>
          </Card>
        </aside>
      </div>
    </AppLayout>
  );
}

function PostCard({ post }: { post: Post }) {
  return (
    <Card>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded-md bg-muted px-2 py-1 font-mono text-[11px] font-bold text-foreground">
            {post.code}
          </span>
          <span className="truncate text-[11px] text-muted-foreground">
            {post.area} · {post.time}
          </span>
        </div>
        {post.type === "text" && post.urgency && (
          <span
            className={
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold " +
              (post.urgency === "Alta"
                ? "bg-brand-red/10 text-brand-red"
                : "bg-brand-amber/10 text-brand-amber")
            }
          >
            Urgencia {post.urgency}
          </span>
        )}
      </div>

      {post.type === "text" && (
        <>
          <p className="mt-4 text-[15px] leading-relaxed text-foreground">
            “{post.text}”
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <ReactionBtn icon={Heart} label="Me identifico" count={post.reactions.identify} />
            <ReactionBtn icon={HandHelping} label="Necesito apoyo" count={post.reactions.support} />
            <ReactionBtn icon={ThumbsUp} label="Buen punto" />
          </div>
        </>
      )}

      {post.type === "poll" && (
        <>
          <p className="mt-4 text-[15px] font-medium">{post.question}</p>
          <div className="mt-4 space-y-2">
            {post.options.map((o) => (
              <button
                key={o.label}
                className="relative block w-full overflow-hidden rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-left text-xs font-medium transition hover:border-brand-blue"
              >
                <span
                  className="absolute inset-y-0 left-0 bg-brand-blue/10"
                  style={{ width: `${o.pct}%` }}
                />
                <span className="relative flex items-center justify-between">
                  {o.label}
                  <span className="text-muted-foreground">{o.pct}%</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {post.type === "open" && (
        <>
          <p className="mt-4 text-[15px] font-medium">{post.question}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {post.responses} respuestas anónimas
          </p>
          <input
            placeholder="Escribir respuesta anónima…"
            className="mt-4 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15"
          />
        </>
      )}
    </Card>
  );
}

function ReactionBtn({
  icon: Icon,
  label,
  count,
}: {
  icon: typeof Heart;
  label: string;
  count?: number;
}) {
  return (
    <button className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:border-brand-blue hover:text-brand-blue">
      <Icon className="size-3.5" />
      {label}
      {count !== undefined && count > 0 && (
        <span className="rounded-full bg-muted px-1.5 text-[10px] font-bold">
          {count}
        </span>
      )}
    </button>
  );
}
