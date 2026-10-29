import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronDown, Lock, MessageSquare, Send, ShieldCheck } from "lucide-react";
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

const ALL_AREAS = "__all__";
const MAX_LENGTH = 1000;

const TONE_FILTERS = [
  { value: "all", label: "Todos los tonos" },
  { value: "positive", label: "Positivo" },
  { value: "neutral", label: "Neutral" },
  { value: "negative", label: "Negativo" },
] as const;

type ToneFilter = (typeof TONE_FILTERS)[number]["value"];

function FeedPage() {
  const [areaFilter, setAreaFilter] = useState<string>(ALL_AREAS);
  const [toneFilter, setToneFilter] = useState<ToneFilter>("all");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [draft, setDraft] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    // daily_feeds is no longer readable by other users (anonymity), so
    // Realtime can't announce their posts — poll the anonymous view instead.
    const interval = window.setInterval(() => void loadPosts(), 30_000);

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

  const filteredPosts = posts.filter(
    (post) =>
      (areaFilter === ALL_AREAS || post.department_name === areaFilter) &&
      (toneFilter === "all" || post.sentiment === toneFilter),
  );
  const hasFilters = areaFilter !== ALL_AREAS || toneFilter !== "all";

  return (
    <AppLayout
      title="Feed de opinión"
      subtitle="Comentarios anónimos del equipo sobre su experiencia laboral"
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="lg:col-span-8">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/[0.02]">
            {/* Encabezado + filtros */}
            <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold">Comentarios recientes</h2>
                <p className="text-xs text-muted-foreground">
                  {filteredPosts.length} {filteredPosts.length === 1 ? "comentario" : "comentarios"}
                  {hasFilters ? " con los filtros aplicados" : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <FilterSelect
                  label="Área"
                  value={areaFilter}
                  onChange={setAreaFilter}
                  options={[
                    { value: ALL_AREAS, label: "Todas las áreas" },
                    ...areas.map((area) => ({ value: area, label: area })),
                  ]}
                />
                <FilterSelect
                  label="Tono"
                  value={toneFilter}
                  onChange={(value) => setToneFilter(value as ToneFilter)}
                  options={TONE_FILTERS}
                />
              </div>
            </div>

            {/* Redacción */}
            <div className="border-b border-border bg-muted/30 px-5 py-4">
              <label htmlFor="feed-draft" className="text-xs font-medium text-foreground">
                Nuevo comentario anónimo
              </label>
              <textarea
                id="feed-draft"
                value={draft}
                onChange={(event) => setDraft(event.target.value.slice(0, MAX_LENGTH))}
                className="mt-2 w-full resize-none rounded-md border border-input bg-card px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
                rows={3}
                placeholder="¿Cómo fue tu jornada? Comparte lo que funciona y lo que se puede mejorar."
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Lock className="size-3 shrink-0" />
                  Tu nombre no se muestra. Solo se publica el área y la fecha.
                </p>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="hidden text-[11px] tabular-nums text-muted-foreground sm:inline">
                    {draft.length}/{MAX_LENGTH}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handlePublish()}
                    disabled={isPosting || !draft.trim()}
                    className="inline-flex items-center gap-2 rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-navy/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send className="size-3.5" />
                    {isPosting ? "Enviando…" : "Enviar"}
                  </button>
                </div>
              </div>
            </div>

            {error ? (
              <div className="border-b border-brand-red/20 bg-brand-red/5 px-5 py-3 text-sm text-brand-red">
                {error}
              </div>
            ) : null}

            {/* Listado */}
            {filteredPosts.length > 0 ? (
              <ul className="divide-y divide-border">
                {filteredPosts.map((post) => (
                  <PostRow key={post.id} post={post} />
                ))}
              </ul>
            ) : (
              <div className="px-5 py-12 text-center">
                <MessageSquare className="mx-auto size-6 text-muted-foreground/60" />
                <p className="mt-3 text-sm font-medium">
                  {hasFilters ? "Sin resultados" : "Aún no hay comentarios"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {hasFilters
                    ? "No hay comentarios que coincidan con los filtros seleccionados."
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
              </div>
            )}
          </div>
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
              Política de confidencialidad
            </div>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
              <li>· Los comentarios no muestran nombre ni correo.</li>
              <li>· Los líderes solo ven indicadores agregados por área.</li>
              <li>· Las áreas con menos de 3 personas no se reportan por separado.</li>
            </ul>
          </div>
        </aside>
      </div>
    </AppLayout>
  );
}

const TONE_META: Record<string, { label: string; dot: string; text: string; bar: string }> = {
  positive: { label: "Positivo", dot: "bg-brand-emerald", text: "text-brand-emerald", bar: "bg-brand-emerald" },
  neutral: { label: "Neutral", dot: "bg-slate-400", text: "text-muted-foreground", bar: "bg-slate-300" },
  negative: { label: "Negativo", dot: "bg-brand-red", text: "text-brand-red", bar: "bg-brand-red" },
};

function toneOf(sentiment: string | null) {
  return TONE_META[sentiment ?? "neutral"] ?? TONE_META.neutral;
}

function formatDate(value: string | null) {
  if (!value) return "Ahora";
  return new Date(value).toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isWithinDays(value: string | null, days: number) {
  return value !== null && Date.now() - new Date(value).getTime() <= days * 24 * 60 * 60 * 1000;
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 appearance-none rounded-md border border-input bg-card pl-3 pr-8 text-xs font-medium text-foreground outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </label>
  );
}

function PostRow({ post }: { post: FeedPost }) {
  const tone = toneOf(post.sentiment);

  return (
    <li className="px-5 py-4 transition hover:bg-muted/30">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate font-medium text-foreground">{post.department_name ?? "General"}</span>
          <span aria-hidden="true">·</span>
          <time className="shrink-0" dateTime={post.created_at ?? undefined}>
            {formatDate(post.created_at)}
          </time>
        </div>
        <span className={cn("inline-flex shrink-0 items-center gap-1.5 text-xs font-medium", tone.text)}>
          <span className={cn("size-1.5 rounded-full", tone.dot)} />
          {tone.label}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-foreground">{post.content}</p>
    </li>
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
      <p className="text-xs text-muted-foreground">{total === 1 ? "comentario recibido" : "comentarios recibidos"}</p>

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
            <th className="pb-2 text-right font-medium">Comentarios</th>
            <th className="pb-2 text-right font-medium">Negativos</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map(([area, { total, negative }]) => (
            <tr key={area}>
              <td className="py-2 font-medium">{area}</td>
              <td className="py-2 text-right tabular-nums">{total}</td>
              <td className={cn("py-2 text-right tabular-nums", negative > 0 ? "text-brand-red" : "text-muted-foreground")}>
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
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-left text-xs font-medium text-foreground transition hover:border-brand-navy hover:bg-muted/40"
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
                <div
                  className={cn("h-full", isMine ? "bg-brand-navy" : "bg-slate-300")}
                  style={{ width: `${pct}%` }}
                />
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
