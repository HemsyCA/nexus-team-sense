import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HandHeart, Lock, MessageSquare, Send, ShieldCheck, ThumbsUp, UserRound } from "lucide-react";
import { AppLayout, Card } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { requireAuthAndOnboarded } from "@/lib/auth-guard";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/feed")({
  beforeLoad: requireAuthAndOnboarded,
  head: () => ({
    meta: [
      { title: "Feed de opinión · NEXUS LEAD IA" },
      {
        name: "description",
        content: "Comentarios anónimos del equipo sobre su experiencia laboral.",
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
  department_name: string | null;
  created_at: string | null;
  content: string;
  sentiment: string | null;
};

type PollOption = { id: string; label: string; position: number; votes: number };
type Poll = { id: string; question: string; options: PollOption[]; myVoteOptionId: string | null };

type ReactionType = "support" | "relate";
type ReactionState = Record<string, { counts: Record<ReactionType, number>; mine: ReactionType[] }>;

const ALL_AREAS = "__all__";
const MAX_LENGTH = 1000;

const TONE_FILTERS = [
  { value: "all", label: "Todos los tonos" },
  { value: "positive", label: "Positivo" },
  { value: "neutral", label: "Neutral" },
  { value: "negative", label: "Negativo" },
] as const;

type ToneFilter = (typeof TONE_FILTERS)[number]["value"];

const REACTIONS: Array<{ type: ReactionType; label: string; icon: typeof ThumbsUp }> = [
  { type: "support", label: "Apoyo", icon: ThumbsUp },
  { type: "relate", label: "Me identifico", icon: HandHeart },
];

function FeedPage() {
  const [areaFilter, setAreaFilter] = useState<string>(ALL_AREAS);
  const [toneFilter, setToneFilter] = useState<ToneFilter>("all");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [reactions, setReactions] = useState<ReactionState>({});
  const [reactionsEnabled, setReactionsEnabled] = useState(true);
  const [myArea, setMyArea] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function getUserId() {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  }

  async function loadPosts() {
    const { data: feedData, error: feedError } = await supabase
      .from("feed_enriched")
      .select("id, department_name, created_at, content, sentiment")
      .order("created_at", { ascending: false });

    if (feedError) {
      console.error("Error cargando feed", feedError);
      setError("No se pudieron cargar las publicaciones. Inténtalo de nuevo en unos minutos.");
      return;
    }

    const normalizedPosts = ((feedData as FeedPost[] | null) ?? []).map((row) => ({
      ...row,
      id: String(row.id),
      content: String(row.content ?? ""),
    }));

    setPosts(normalizedPosts);
    setAreas(
      Array.from(new Set(normalizedPosts.map((post) => post.department_name).filter(Boolean) as string[])).sort(),
    );
    setError(null);
  }

  // Reactions live in feed_reactions (see supabase-feed-reactions.sql). Only
  // aggregated counts are readable by others; if the table isn't installed
  // yet the reaction bar is simply hidden.
  async function loadReactions() {
    const userId = await getUserId();
    const [countsResult, mineResult] = await Promise.all([
      supabase.from("feed_reaction_counts").select("feed_id, reaction, votes"),
      userId
        ? supabase.from("feed_reactions").select("feed_id, reaction").eq("user_id", userId)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (countsResult.error || mineResult.error) {
      setReactionsEnabled(false);
      return;
    }

    const next: ReactionState = {};
    const entry = (feedId: string) =>
      (next[feedId] ??= { counts: { support: 0, relate: 0 }, mine: [] });

    ((countsResult.data as Array<{ feed_id: string; reaction: ReactionType; votes: number }> | null) ?? []).forEach(
      (row) => {
        entry(row.feed_id).counts[row.reaction] = Number(row.votes);
      },
    );
    ((mineResult.data as Array<{ feed_id: string; reaction: ReactionType }> | null) ?? []).forEach((row) => {
      entry(row.feed_id).mine.push(row.reaction);
    });

    setReactions(next);
    setReactionsEnabled(true);
  }

  async function toggleReaction(feedId: string, type: ReactionType) {
    const userId = await getUserId();
    if (!userId) return;

    const current = reactions[feedId] ?? { counts: { support: 0, relate: 0 }, mine: [] };
    const isActive = current.mine.includes(type);

    // Optimistic update; reload from the server afterwards.
    setReactions((prev) => ({
      ...prev,
      [feedId]: {
        counts: { ...current.counts, [type]: Math.max(0, current.counts[type] + (isActive ? -1 : 1)) },
        mine: isActive ? current.mine.filter((r) => r !== type) : [...current.mine, type],
      },
    }));

    const { error: reactionError } = isActive
      ? await supabase.from("feed_reactions").delete().match({ feed_id: feedId, user_id: userId, reaction: type })
      : await supabase.from("feed_reactions").insert({ feed_id: feedId, user_id: userId, reaction: type });

    if (reactionError) console.error("Error registrando reacción", reactionError);
    await loadReactions();
  }

  async function loadPolls() {
    const userId = await getUserId();

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

    setPolls(
      ((pollsData as Array<{ id: string; question: string }> | null) ?? []).map((poll) => ({
        id: poll.id,
        question: poll.question,
        options: optionsByPoll.get(poll.id) ?? [],
        myVoteOptionId: myVoteByPoll.get(poll.id) ?? null,
      })),
    );
  }

  async function handleVote(pollId: string, optionId: string) {
    const userId = await getUserId();
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

  async function getMyDepartmentId(userId: string) {
    const { data } = await supabase.from("profiles").select("department_id").eq("user_id", userId).maybeSingle();
    return (data?.department_id as string | null | undefined) ?? null;
  }

  useEffect(() => {
    void loadPosts();
    void loadPolls();
    void loadReactions();

    void (async () => {
      const userId = await getUserId();
      if (!userId) return;
      const departmentId = await getMyDepartmentId(userId);
      if (!departmentId) return;
      const { data } = await supabase.from("departments").select("name").eq("id", departmentId).maybeSingle();
      setMyArea((data?.name as string | undefined) ?? null);
    })();

    // daily_feeds is no longer readable by other users (anonymity), so
    // Realtime can't announce their posts — poll the anonymous view instead.
    const interval = window.setInterval(() => {
      void loadPosts();
      void loadReactions();
    }, 30_000);

    const channel = supabase
      .channel("feed-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "feed_poll_votes" }, () => {
        void loadPolls();
      })
      .subscribe();

    return () => {
      window.clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  async function handlePublish() {
    const trimmed = draft.trim();
    if (!trimmed) return;

    setIsPosting(true);
    setError(null);

    try {
      const userId = await getUserId();
      const departmentId = userId ? await getMyDepartmentId(userId) : null;

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

      if (insertError) throw insertError;

      setDraft("");
      await loadPosts();
    } catch (err) {
      console.error("Error publicando feed", err);
      setError("No se pudo publicar tu comentario. Inténtalo de nuevo.");
    } finally {
      setIsPosting(false);
    }
  }

  const filteredPosts = posts.filter(
    (post) =>
      (areaFilter === ALL_AREAS || post.department_name === areaFilter) &&
      (toneFilter === "all" || post.sentiment === toneFilter),
  );
  const hasFilters = areaFilter !== ALL_AREAS || toneFilter !== "all";

  return (
    <AppLayout title="Feed de opinión" subtitle="La voz del equipo, de forma anónima y respetuosa">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="space-y-4 lg:col-span-8">
          {/* Publicar */}
          <Card className="p-5">
            <div className="flex gap-3">
              <AnonymousAvatar />
              <div className="min-w-0 flex-1">
                <textarea
                  aria-label="Escribe una publicación anónima"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value.slice(0, MAX_LENGTH))}
                  className="w-full resize-none rounded-lg border border-input bg-muted/30 px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-brand-navy focus:bg-card focus:ring-2 focus:ring-brand-navy/10"
                  rows={draft ? 4 : 2}
                  placeholder="¿Qué quieres compartir con tu equipo hoy?"
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <Lock className="size-3 shrink-0" />
                    <span className="truncate">
                      Publicarás como <strong className="font-medium text-foreground">Colaborador anónimo</strong>
                      {myArea ? ` · ${myArea}` : ""}
                    </span>
                  </p>
                  <div className="flex shrink-0 items-center gap-3">
                    {draft ? (
                      <span className="hidden text-[11px] tabular-nums text-muted-foreground sm:inline">
                        {draft.length}/{MAX_LENGTH}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void handlePublish()}
                      disabled={isPosting || !draft.trim()}
                      className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-navy/90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Send className="size-3.5" />
                      {isPosting ? "Publicando…" : "Publicar"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Filtros */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {[ALL_AREAS, ...areas].map((area) => {
                const isActive = area === areaFilter;
                return (
                  <button
                    key={area}
                    type="button"
                    onClick={() => setAreaFilter(area)}
                    className={cn(
                      "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
                      isActive
                        ? "border-brand-navy bg-brand-navy text-white"
                        : "border-border bg-card text-muted-foreground hover:border-brand-navy/40 hover:text-foreground",
                    )}
                  >
                    {area === ALL_AREAS ? "Todas las áreas" : area}
                  </button>
                );
              })}
            </div>
            <select
              aria-label="Filtrar por tono"
              value={toneFilter}
              onChange={(event) => setToneFilter(event.target.value as ToneFilter)}
              className="h-8 shrink-0 rounded-full border border-border bg-card px-3 text-xs font-medium text-foreground outline-none focus:border-brand-navy"
            >
              {TONE_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {error ? (
            <div className="rounded-xl border border-brand-red/30 bg-brand-red/5 px-4 py-3 text-sm text-brand-red">
              {error}
            </div>
          ) : null}

          {/* Publicaciones */}
          {filteredPosts.length > 0 ? (
            filteredPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                reactions={reactionsEnabled ? reactions[post.id] : undefined}
                showReactions={reactionsEnabled}
                onReact={(type) => void toggleReaction(post.id, type)}
              />
            ))
          ) : (
            <Card className="py-12 text-center">
              <MessageSquare className="mx-auto size-6 text-muted-foreground/60" />
              <p className="mt-3 text-sm font-medium">{hasFilters ? "Sin resultados" : "Aún no hay publicaciones"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {hasFilters
                  ? "No hay publicaciones que coincidan con los filtros seleccionados."
                  : "Sé la primera persona en compartir cómo va tu semana."}
              </p>
              {hasFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    setAreaFilter(ALL_AREAS);
                    setToneFilter("all");
                  }}
                  className="mt-4 text-xs font-medium text-brand-navy underline-offset-4 hover:underline"
                >
                  Limpiar filtros
                </button>
              ) : null}
            </Card>
          )}
        </section>

        {/* Lateral */}
        <aside className="space-y-5 lg:col-span-4">
          <SummaryCard posts={posts} />
          <AreaCard posts={posts} />

          {polls.map((poll) => (
            <PollCard key={poll.id} poll={poll} onVote={(optionId) => void handleVote(poll.id, optionId)} />
          ))}

          <div className="rounded-2xl border border-border bg-muted/40 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-4 text-brand-emerald" />
              Normas de la comunidad
            </div>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
              <li>· Las publicaciones no muestran nombre ni correo.</li>
              <li>· Las reacciones son anónimas; solo se ven los totales.</li>
              <li>· Comenta situaciones, no personas. Mantén un tono respetuoso.</li>
            </ul>
          </div>
        </aside>
      </div>
    </AppLayout>
  );
}

const TONE_META: Record<string, { label: string; dot: string; badge: string; bar: string }> = {
  positive: {
    label: "Positivo",
    dot: "bg-brand-emerald",
    badge: "bg-brand-emerald/10 text-brand-emerald",
    bar: "bg-brand-emerald",
  },
  neutral: {
    label: "Neutral",
    dot: "bg-slate-400",
    badge: "bg-muted text-muted-foreground",
    bar: "bg-slate-300 dark:bg-slate-500",
  },
  negative: { label: "Negativo", dot: "bg-brand-red", badge: "bg-brand-red/10 text-brand-red", bar: "bg-brand-red" },
};

const AVATAR_COLORS = [
  "bg-brand-navy text-white",
  "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
  "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
  "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200",
  "bg-slate-200 text-slate-700 dark:bg-slate-500/25 dark:text-slate-200",
];

function toneOf(sentiment: string | null) {
  return TONE_META[sentiment ?? "neutral"] ?? TONE_META.neutral;
}

function areaInitials(area: string | null) {
  if (!area) return "G";
  return area
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function areaColor(area: string | null) {
  const key = area ?? "General";
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function timeAgo(value: string | null) {
  if (!value) return "ahora";
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60_000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return days === 1 ? "ayer" : `hace ${days} días`;
  return new Date(value).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function isWithinDays(value: string | null, days: number) {
  return value !== null && Date.now() - new Date(value).getTime() <= days * 24 * 60 * 60 * 1000;
}

function AnonymousAvatar() {
  return (
    <div className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
      <UserRound className="size-5" />
    </div>
  );
}

function PostCard({
  post,
  reactions,
  showReactions,
  onReact,
}: {
  post: FeedPost;
  reactions?: { counts: Record<ReactionType, number>; mine: ReactionType[] };
  showReactions: boolean;
  onReact: (type: ReactionType) => void;
}) {
  const tone = toneOf(post.sentiment);
  const totalReactions = (reactions?.counts.support ?? 0) + (reactions?.counts.relate ?? 0);

  return (
    <article className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/[0.02]">
      <div className="px-5 pt-5">
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-full text-xs font-semibold",
                areaColor(post.department_name),
              )}
              aria-hidden="true"
            >
              {areaInitials(post.department_name)}
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold">Colaborador anónimo</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {post.department_name ?? "General"} ·{" "}
                <time dateTime={post.created_at ?? undefined}>{timeAgo(post.created_at)}</time>
              </p>
            </div>
          </div>
          <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium", tone.badge)}>
            {tone.label}
          </span>
        </header>

        <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-foreground">{post.content}</p>

        {showReactions && totalReactions > 0 ? (
          <p className="mt-4 text-xs text-muted-foreground">
            {totalReactions} {totalReactions === 1 ? "reacción" : "reacciones"}
          </p>
        ) : null}
      </div>

      {showReactions ? (
        <footer className="mt-4 grid grid-cols-2 border-t border-border">
          {REACTIONS.map(({ type, label, icon: Icon }) => {
            const isMine = reactions?.mine.includes(type) ?? false;
            const count = reactions?.counts[type] ?? 0;
            return (
              <button
                key={type}
                type="button"
                aria-pressed={isMine}
                onClick={() => onReact(type)}
                className={cn(
                  "flex items-center justify-center gap-2 py-3 text-xs font-medium transition first:border-r first:border-border hover:bg-muted/40",
                  isMine ? "text-brand-navy" : "text-muted-foreground",
                )}
              >
                <Icon className={cn("size-4", isMine && "fill-brand-navy/15")} />
                {label}
                {count > 0 ? <span className="tabular-nums">· {count}</span> : null}
              </button>
            );
          })}
        </footer>
      ) : (
        <div className="pb-5" />
      )}
    </article>
  );
}

function SummaryCard({ posts }: { posts: FeedPost[] }) {
  const recent = posts.filter((post) => isWithinDays(post.created_at, 7));
  const total = recent.length;
  const counts = (["positive", "neutral", "negative"] as const).map((key) => ({
    key,
    count: recent.filter((post) => (post.sentiment ?? "neutral") === key).length,
  }));

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold">Resumen de la semana</h3>
      <p className="text-xs text-muted-foreground">Últimos 7 días</p>

      <p className="mt-4 text-3xl font-semibold tabular-nums">{total}</p>
      <p className="text-xs text-muted-foreground">{total === 1 ? "publicación" : "publicaciones"}</p>

      {total > 0 ? (
        <>
          <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-muted">
            {counts.map(({ key, count }) =>
              count > 0 ? (
                <div key={key} className={TONE_META[key].bar} style={{ width: `${(count / total) * 100}%` }} />
              ) : null,
            )}
          </div>
          <ul className="mt-3 space-y-1.5">
            {counts.map(({ key, count }) => (
              <li key={key} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <span className={cn("size-2 rounded-full", TONE_META[key].dot)} />
                  {TONE_META[key].label}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {count} · {Math.round((count / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </Card>
  );
}

function AreaCard({ posts }: { posts: FeedPost[] }) {
  const recent = posts.filter((post) => isWithinDays(post.created_at, 7));
  const byArea = new Map<string, { total: number; negative: number }>();
  recent.forEach((post) => {
    const area = post.department_name ?? "General";
    const entry = byArea.get(area) ?? { total: 0, negative: 0 };
    entry.total += 1;
    if (post.sentiment === "negative") entry.negative += 1;
    byArea.set(area, entry);
  });
  const rows = Array.from(byArea.entries()).sort((a, b) => b[1].total - a[1].total);

  if (rows.length === 0) return null;

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold">Participación por área</h3>
      <p className="text-xs text-muted-foreground">Últimos 7 días</p>
      <table className="mt-4 w-full text-xs">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="pb-2 font-medium">Área</th>
            <th className="pb-2 text-right font-medium">Publicaciones</th>
            <th className="pb-2 text-right font-medium">Negativas</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map(([area, { total, negative }]) => (
            <tr key={area}>
              <td className="py-2 font-medium">{area}</td>
              <td className="py-2 text-right tabular-nums">{total}</td>
              <td
                className={cn("py-2 text-right tabular-nums", negative > 0 ? "text-brand-red" : "text-muted-foreground")}
              >
                {Math.round((negative / total) * 100)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function PollCard({ poll, onVote }: { poll: Poll; onVote: (optionId: string) => void }) {
  const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);
  const hasVoted = poll.myVoteOptionId !== null;

  return (
    <Card className="p-5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Encuesta</p>
      <p className="mt-1 text-sm font-semibold">{poll.question}</p>
      <ul className="mt-4 space-y-2">
        {poll.options.map((option) => {
          const pct = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
          const isMine = poll.myVoteOptionId === option.id;

          if (!hasVoted) {
            return (
              <li key={option.id}>
                <button
                  onClick={() => onVote(option.id)}
                  className="w-full rounded-full border border-input bg-card px-4 py-2 text-left text-xs font-medium text-foreground transition hover:border-brand-navy hover:bg-muted/40"
                >
                  {option.label}
                </button>
              </li>
            );
          }

          return (
            <li key={option.id}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className={cn("font-medium", isMine && "text-brand-navy")}>
                  {option.label}
                  {isMine ? " · Tu voto" : ""}
                </span>
                <span className="tabular-nums text-muted-foreground">{pct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full", isMine ? "bg-brand-navy" : "bg-slate-300 dark:bg-slate-500")} style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] text-muted-foreground">
        {hasVoted
          ? `${totalVotes} ${totalVotes === 1 ? "voto" : "votos"} en total · respuesta anónima`
          : "Tu respuesta es anónima."}
      </p>
    </Card>
  );
}
