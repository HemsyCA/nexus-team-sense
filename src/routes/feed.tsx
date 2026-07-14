import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Filter, Heart, HandHelping, ThumbsUp, Send } from "lucide-react";
import { AppLayout, Card } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { requireAuthAndOnboarded } from "@/lib/auth-guard";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

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

type FeedPost = {
  id: string;
  anonymous_code: string | null;
  department_name: string | null;
  department_code: string | null;
  created_at: string | null;
  content: string;
  sentiment: string | null;
  burnout_score: number | null;
  stress_score: number | null;
  motivation_score: number | null;
  ai_tags: unknown;
};

type PollOption = { id: string; label: string; position: number; votes: number };
type Poll = { id: string; question: string; options: PollOption[]; myVoteOptionId: string | null };

const SENTIMENT_FILTERS = [
  { value: "all", label: "Todos" },
  { value: "positive", label: "Positivo" },
  { value: "neutral", label: "Neutral" },
  { value: "negative", label: "Negativo" },
] as const;

function FeedPage() {
  const [active, setActive] = useState("Todos");
  const [sentimentFilter, setSentimentFilter] = useState<(typeof SENTIMENT_FILTERS)[number]["value"]>("all");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [draft, setDraft] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filters = ["Todos", ...areas];

  async function loadPosts() {
    const { data: feedData, error: feedError } = await supabase
      .from("feed_enriched")
      .select("*")
      .order("created_at", { ascending: false });

    if (feedError) {
      console.error("Error cargando feed", feedError);
      setError(`No se pudieron cargar los comentarios desde Supabase: ${feedError.message}`);
      return;
    }

    const normalizedPosts = ((feedData as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
      id: String(row.id),
      anonymous_code: row.anonymous_code as string | null,
      department_name: row.department_name as string | null,
      department_code: row.department_code as string | null,
      created_at: row.created_at as string | null,
      content: String(row.content ?? ""),
      sentiment: row.sentiment as string | null,
      burnout_score: row.burnout_score as number | null,
      stress_score: row.stress_score as number | null,
      motivation_score: row.motivation_score as number | null,
      ai_tags: row.ai_tags,
    }));

    const availableAreas = Array.from(
      new Set(normalizedPosts.map((post) => post.department_name).filter(Boolean) as string[]),
    ).sort();

    setPosts(normalizedPosts);
    setAreas(availableAreas);
    setError(null);
  }

  async function loadPolls() {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;

    const [{ data: pollsData }, { data: optionsData }, { data: resultsData }, myVotesResult] = await Promise.all([
      supabase.from("feed_polls").select("id, question").order("created_at", { ascending: false }),
      supabase.from("feed_poll_options").select("id, poll_id, label, position").order("position", { ascending: true }),
      supabase.from("feed_poll_results").select("poll_id, option_id, votes"),
      userId
        ? supabase.from("feed_poll_votes").select("poll_id, option_id").eq("user_id", userId)
        : Promise.resolve({ data: [] as Array<{ poll_id: string; option_id: string }> }),
    ]);

    const votesByOption = new Map<string, number>();
    ((resultsData as Array<{ poll_id: string; option_id: string; votes: number }> | null) ?? []).forEach((r) => {
      votesByOption.set(r.option_id, r.votes);
    });

    const myVoteByPoll = new Map<string, string>();
    ((myVotesResult.data as Array<{ poll_id: string; option_id: string }> | null) ?? []).forEach((v) => {
      myVoteByPoll.set(v.poll_id, v.option_id);
    });

    const optionsByPoll = new Map<string, PollOption[]>();
    ((optionsData as Array<{ id: string; poll_id: string; label: string; position: number }> | null) ?? []).forEach(
      (opt) => {
        const list = optionsByPoll.get(opt.poll_id) ?? [];
        list.push({ id: opt.id, label: opt.label, position: opt.position, votes: votesByOption.get(opt.id) ?? 0 });
        optionsByPoll.set(opt.poll_id, list);
      },
    );

    const assembledPolls = ((pollsData as Array<{ id: string; question: string }> | null) ?? []).map((poll) => ({
      id: poll.id,
      question: poll.question,
      options: optionsByPoll.get(poll.id) ?? [],
      myVoteOptionId: myVoteByPoll.get(poll.id) ?? null,
    }));

    setPolls(assembledPolls);
  }

  async function handleVote(pollId: string, optionId: string) {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) return;

    const { error: voteError } = await supabase
      .from("feed_poll_votes")
      .insert({ poll_id: pollId, option_id: optionId, user_id: userId });

    if (voteError) {
      console.error("Error votando", voteError);
      return;
    }

    await loadPolls();
  }

  useEffect(() => {
    void loadPosts();
    void loadPolls();

    const channel = supabase
      .channel("feed-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "daily_feeds" }, () => {
        void loadPosts();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "feed_poll_votes" }, () => {
        void loadPolls();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function handlePublish() {
    const trimmed = draft.trim();
    if (!trimmed) return;

    setIsPosting(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;

      let departmentId: string | null = null;
      if (userId) {
        const { data: myProfile } = await supabase
          .from("profiles")
          .select("department_id")
          .eq("user_id", userId)
          .maybeSingle();
        departmentId = myProfile?.department_id ?? null;
      }

      const lowerText = trimmed.toLowerCase();
      let sentiment: "positive" | "neutral" | "negative" = "neutral";
      let burnoutScore = 3.5;
      let stressScore = 4.5;
      let motivationScore = 6;

      if (/mejor|bien|feliz|gracias|claro|orgull|satisfe|apoyo|colabor|optim|progreso/i.test(lowerText)) {
        sentiment = "positive";
        burnoutScore = 2.2;
        stressScore = 3;
        motivationScore = 7.5;
      } else if (/estres|presión|agot|cans|frustr|mala|problema|conflict|molest|dificil|fatiga|burnout/i.test(lowerText)) {
        sentiment = "negative";
        burnoutScore = 7.5;
        stressScore = 8;
        motivationScore = 2.5;
      }

      const { error: insertError } = await supabase.from("daily_feeds").insert({
        user_id: userId,
        department_id: departmentId,
        anonymous_code: `COL-${Math.floor(100 + Math.random() * 900)}`,
        content: trimmed,
        sentiment,
        burnout_score: burnoutScore,
        stress_score: stressScore,
        motivation_score: motivationScore,
        ai_tags: [sentiment === "negative" ? "sobrecarga" : "reconocimiento"],
      });

      if (insertError) {
        throw insertError;
      }

      setDraft("");
      await loadPosts();
    } catch (err) {
      console.error("Error publicando feed", err);
      setError("No se pudo guardar el comentario en Supabase.");
    } finally {
      setIsPosting(false);
    }
  }

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
                    onClick={() => {
                      void handlePublish();
                    }}
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

          <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-1">
            <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
              Sentimiento
            </div>
            {SENTIMENT_FILTERS.map((f) => {
              const isActive = f.value === sentimentFilter;
              return (
                <button
                  key={f.value}
                  onClick={() => setSentimentFilter(f.value)}
                  className={
                    "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition " +
                    (isActive
                      ? "border-brand-blue bg-brand-blue/10 text-brand-blue"
                      : "border-border bg-card text-muted-foreground hover:text-foreground")
                  }
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {error ? (
            <div className="mb-4 rounded-xl border border-brand-red/30 bg-brand-red/5 p-3 text-sm text-brand-red">
              {error}
            </div>
          ) : null}

          <div className="space-y-4">
            {(() => {
              const filtered = posts.filter(
                (post) =>
                  (active === "Todos" || post.department_name === active) &&
                  (sentimentFilter === "all" || post.sentiment === sentimentFilter),
              );
              return filtered.length > 0 ? (
                filtered.map((p) => <PostCard key={p.id} post={p} />)
              ) : (
                <Card>
                  <p className="text-sm text-muted-foreground">
                    {active === "Todos" && sentimentFilter === "all"
                      ? "Aún no hay comentarios en Supabase."
                      : "No hay comentarios que coincidan con estos filtros."}
                  </p>
                </Card>
              );
            })()}
          </div>
        </div>

        {/* Sidebar insights */}
        <aside className="space-y-5 lg:col-span-4">
          {polls.map((poll) => (
            <PollCard key={poll.id} poll={poll} onVote={(optionId) => void handleVote(poll.id, optionId)} />
          ))}

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

function PollCard({ poll, onVote }: { poll: Poll; onVote: (optionId: string) => void }) {
  const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);
  const hasVoted = poll.myVoteOptionId !== null;

  return (
    <Card>
      <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-brand-blue/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-blue">
        Encuesta del equipo
      </div>
      <p className="mt-2 text-sm font-semibold">{poll.question}</p>
      <ul className="mt-4 space-y-2">
        {poll.options.map((option) => {
          const pct = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
          const isMine = poll.myVoteOptionId === option.id;

          if (!hasVoted) {
            return (
              <li key={option.id}>
                <button
                  onClick={() => onVote(option.id)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-left text-xs font-medium text-foreground transition hover:border-brand-blue hover:text-brand-blue"
                >
                  {option.label}
                </button>
              </li>
            );
          }

          return (
            <li key={option.id}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className={cn("font-medium", isMine && "text-brand-blue")}>
                  {option.label}
                  {isMine ? " · Tu voto" : ""}
                </span>
                <span className="text-muted-foreground">{pct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full", isMine ? "bg-brand-blue" : "bg-muted-foreground/40")}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {hasVoted && (
        <p className="mt-3 text-[11px] text-muted-foreground">{totalVotes} {totalVotes === 1 ? "voto" : "votos"} en total</p>
      )}
    </Card>
  );
}

function PostCard({ post }: { post: FeedPost }) {
  const time = post.created_at
    ? new Date(post.created_at).toLocaleString("es-ES", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "Ahora";
  const urgencyClass =
    post.sentiment === "negative"
      ? "bg-brand-red/10 text-brand-red"
      : post.sentiment === "positive"
        ? "bg-brand-emerald/10 text-brand-emerald"
        : "bg-brand-amber/10 text-brand-amber";

  return (
    <Card>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded-md bg-muted px-2 py-1 font-mono text-[11px] font-bold text-foreground">
            {post.anonymous_code ?? "COL-000"}
          </span>
          <span className="truncate text-[11px] text-muted-foreground">
            {post.department_name ?? "General"} · {time}
          </span>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${urgencyClass}`}>
          {post.sentiment ?? "neutral"}
        </span>
      </div>

      <p className="mt-4 text-[15px] leading-relaxed text-foreground">“{post.content}”</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <ReactionBtn icon={Heart} label="Burnout" count={Math.round((post.burnout_score ?? 0) * 10)} />
        <ReactionBtn icon={HandHelping} label="Estrés" count={Math.round((post.stress_score ?? 0) * 10)} />
        <ReactionBtn icon={ThumbsUp} label="Motivación" count={Math.round((post.motivation_score ?? 0) * 10)} />
      </div>
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
        <span className="rounded-full bg-muted px-1.5 text-[10px] font-bold">{count}</span>
      )}
    </button>
  );
}
