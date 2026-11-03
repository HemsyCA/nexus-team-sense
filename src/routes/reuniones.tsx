import { createFileRoute } from "@tanstack/react-router";
import { AudioLines, Download, FileText, Mic, Save, ShieldCheck, Square, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppLayout, Card } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useMeetingRecorder } from "@/hooks/useMeetingRecorder";
import { requireAuthAndOnboarded } from "@/lib/auth-guard";
import { timeAgo } from "@/lib/indicators";
import { analyzeTranscript, type VoiceSummary } from "@/lib/meeting-analysis";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reuniones")({
  beforeLoad: requireAuthAndOnboarded,
  head: () => ({
    meta: [
      { title: "Reuniones · NEXUS LEAD IA" },
      { name: "description", content: "Graba y transcribe reuniones, y analiza el tono y las palabras más usadas." },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <MeetingsPage />
    </ProtectedRoute>
  ),
});

type SavedMeeting = {
  id: string;
  title: string;
  duration_seconds: number | null;
  transcript: string;
  voice: VoiceSummary | null;
  created_at: string | null;
};

const EXAMPLE_TRANSCRIPT = `Gracias por venir. Primero quiero decir que estoy orgullosa del equipo, el lanzamiento salió excelente y el cliente quedó contento.
Sí, pero estamos agotados. El cierre fue muy pesado y sigo preocupado por la sobrecarga de la próxima semana.
A mí me frustra que las prioridades cambien cada dos días, es molesto rehacer el trabajo del sprint.
Entiendo. Revisemos las prioridades del sprint juntos y definamos quién apoya el cierre. No quiero que el equipo siga con esta presión.
Me parece genial, con prioridades claras el equipo puede organizar mejor el trabajo.`;

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function MeetingsPage() {
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [consent, setConsent] = useState(false);
  const [isExample, setIsExample] = useState(false);
  const [loadedVoice, setLoadedVoice] = useState<{ voice: VoiceSummary | null; duration: number | null } | null>(null);
  const [saved, setSaved] = useState<SavedMeeting[]>([]);
  const [historyAvailable, setHistoryAvailable] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const recorder = useMeetingRecorder({
    onTranscript: (text) => {
      if (text) setTranscript((prev) => (prev ? `${prev}\n${text}` : text));
    },
  });

  const voice = loadedVoice ? loadedVoice.voice : recorder.voice;
  const duration = loadedVoice ? loadedVoice.duration : recorder.duration;
  const analysis = useMemo(() => analyzeTranscript(transcript, duration), [transcript, duration]);
  const hasContent = transcript.trim().length > 0;
  const maxEmotion = Math.max(1, ...analysis.emotions.map((emotion) => emotion.count));
  const maxWord = Math.max(1, ...analysis.topWords.map((word) => word.count));

  async function loadHistory() {
    const { data, error } = await supabase
      .from("meetings")
      .select("id, title, duration_seconds, transcript, voice, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) {
      console.error("Error cargando reuniones", error);
      setHistoryAvailable(false);
      return;
    }
    setHistoryAvailable(true);
    setSaved((data as SavedMeeting[] | null) ?? []);
  }

  useEffect(() => {
    void loadHistory();
  }, []);

  function clearForm() {
    recorder.reset();
    setTranscript("");
    setTitle("");
    setIsExample(false);
    setLoadedVoice(null);
    setNotice(null);
    setSaveError(null);
  }

  async function startRecording() {
    clearForm();
    await recorder.start();
  }

  function loadExample() {
    clearForm();
    setIsExample(true);
    setTitle("Reunión de ejemplo");
    setTranscript(EXAMPLE_TRANSCRIPT);
  }

  function openSaved(meeting: SavedMeeting) {
    clearForm();
    setTitle(meeting.title);
    setTranscript(meeting.transcript);
    setLoadedVoice({ voice: meeting.voice, duration: meeting.duration_seconds });
  }

  async function handleSave() {
    setIsSaving(true);
    setNotice(null);
    setSaveError(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setSaveError("Tu sesión expiró. Vuelve a iniciar sesión para guardar.");
      setIsSaving(false);
      return;
    }

    const { error } = await supabase.from("meetings").insert({
      user_id: session.user.id,
      title: title.trim() || "Reunión sin título",
      duration_seconds: duration,
      transcript,
      voice,
      analysis: { topWords: analysis.topWords, emotions: analysis.emotions },
    });
    setIsSaving(false);

    if (error) {
      console.error("Error guardando reunión", error);
      setSaveError(`No se pudo guardar la reunión. Detalle: ${error.message}`);
      return;
    }
    setNotice("Reunión guardada. Solo tú puedes verla.");
    await loadHistory();
  }

  async function handleDelete(meeting: SavedMeeting) {
    if (!window.confirm(`¿Eliminar "${meeting.title}"? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from("meetings").delete().eq("id", meeting.id);
    if (error) {
      console.error("Error eliminando reunión", error);
      setSaveError(`No se pudo eliminar la reunión. Detalle: ${error.message}`);
      return;
    }
    await loadHistory();
  }

  return (
    <AppLayout title="Reuniones" subtitle="Graba, transcribe y analiza el tono de tus reuniones">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          {/* Grabación */}
          <Card className="p-5">
            <label htmlFor="meeting-title" className="text-xs font-medium">
              Título de la reunión
            </label>
            <input
              id="meeting-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ej.: Seguimiento semanal de Operaciones"
              className="mt-1.5 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
            />

            <label className="mt-4 flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                disabled={recorder.isRecording}
                className="mt-0.5 accent-brand-navy"
              />
              <span>
                Confirmo que <strong>todas las personas presentes saben y aceptan</strong> que esta reunión se grabe y se
                analice. Para transcribir, el navegador puede enviar el audio a su servicio de reconocimiento de voz.
              </span>
            </label>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {recorder.isRecording ? (
                <>
                  <button
                    type="button"
                    onClick={recorder.stop}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-red px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-red/90"
                  >
                    <Square className="size-4 fill-current" />
                    Detener
                  </button>
                  <span className="flex items-center gap-2 text-sm font-medium tabular-nums">
                    <span className="size-2 animate-pulse rounded-full bg-brand-red" />
                    {formatDuration(recorder.elapsed)}
                  </span>
                  <div
                    className="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-muted"
                    role="meter"
                    aria-label="Nivel del micrófono"
                    aria-valuenow={Math.round(recorder.level * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div className="h-full bg-brand-navy transition-all" style={{ width: `${recorder.level * 100}%` }} />
                  </div>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => void startRecording()}
                    disabled={!consent}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-navy/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Mic className="size-4" />
                    Iniciar grabación
                  </button>
                  <button
                    type="button"
                    onClick={loadExample}
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium transition hover:bg-muted"
                  >
                    <FileText className="size-4" />
                    Ver un ejemplo
                  </button>
                </>
              )}
            </div>

            {!recorder.speechSupported ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Este navegador no transcribe en vivo (funciona en Chrome y Edge). Se grabará el audio y puedes escribir o
                pegar la transcripción abajo.
              </p>
            ) : null}
            {recorder.speechWarning ? <p className="mt-3 text-xs text-brand-amber">{recorder.speechWarning}</p> : null}
            {recorder.error ? (
              <p role="alert" className="mt-3 text-sm text-brand-red">
                {recorder.error}
              </p>
            ) : null}
          </Card>

          {/* Transcripción */}
          <Card className="p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Transcripción</h2>
                <p className="text-xs text-muted-foreground">Puedes corregirla o pegar una transcripción existente.</p>
              </div>
              {isExample ? (
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  Texto de ejemplo
                </span>
              ) : null}
            </div>
            <textarea
              aria-label="Transcripción de la reunión"
              value={recorder.isRecording && recorder.interim ? `${transcript}\n${recorder.interim}`.trim() : transcript}
              onChange={(event) => setTranscript(event.target.value)}
              readOnly={recorder.isRecording}
              rows={8}
              placeholder="La transcripción aparecerá aquí mientras grabas…"
              className="w-full resize-y rounded-lg border border-input bg-card px-3 py-2.5 text-sm leading-relaxed outline-none transition placeholder:text-muted-foreground focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
            />

            {recorder.audioUrl ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <audio controls src={recorder.audioUrl} className="h-10 min-w-0 flex-1" />
                <a
                  href={recorder.audioUrl}
                  download={`${title.trim() || "reunion"}.webm`}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium transition hover:bg-muted"
                >
                  <Download className="size-3.5" />
                  Descargar audio
                </a>
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={!hasContent || isExample || isSaving || recorder.isRecording || !historyAvailable}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-navy/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="size-4" />
                {isSaving ? "Guardando…" : "Guardar análisis"}
              </button>
              {notice ? (
                <span role="status" className="text-xs text-brand-emerald">
                  {notice}
                </span>
              ) : null}
              {saveError ? (
                <span role="alert" className="text-xs text-brand-red">
                  {saveError}
                </span>
              ) : null}
            </div>
          </Card>

          {hasContent && !recorder.isRecording ? (
            <>
              {/* Resumen */}
              <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Resumen de la reunión">
                <Stat label="Duración" value={duration !== null ? formatDuration(duration) : "—"} />
                <Stat label="Palabras" value={String(analysis.wordCount)} />
                <Stat
                  label="Ritmo"
                  value={analysis.wordsPerMinute !== null ? String(analysis.wordsPerMinute) : "—"}
                  unit={analysis.wordsPerMinute !== null ? "pal./min" : undefined}
                />
                <Stat label="Emoción más frecuente" value={analysis.dominant?.label ?? "Ninguna"} small />
              </section>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Emociones */}
                <Card className="p-5">
                  <h2 className="text-base font-semibold">Palabras por emoción</h2>
                  <p className="mb-4 text-xs text-muted-foreground">Coincidencias con un diccionario de emociones</p>
                  <ul className="space-y-4">
                    {analysis.emotions.map((emotion) => (
                      <li key={emotion.key}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="font-medium">{emotion.label}</span>
                          <span className="tabular-nums text-muted-foreground">{emotion.count}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-[var(--chart-1)]"
                            style={{ width: `${(emotion.count / maxEmotion) * 100}%` }}
                          />
                        </div>
                        {emotion.words.length > 0 ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {emotion.words.map((word) => `${word.word} (${word.count})`).join(", ")}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </Card>

                {/* Palabras frecuentes */}
                <Card className="p-5">
                  <h2 className="text-base font-semibold">Palabras más repetidas</h2>
                  <p className="mb-4 text-xs text-muted-foreground">Sin contar artículos ni conectores</p>
                  {analysis.topWords.length > 0 ? (
                    <ol className="space-y-2">
                      {analysis.topWords.map((word) => (
                        <li key={word.word} className="grid grid-cols-[7rem_minmax(0,1fr)_2rem] items-center gap-3 text-sm">
                          <span className="truncate">{word.word}</span>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-[var(--chart-1)]"
                              style={{ width: `${(word.count / maxWord) * 100}%` }}
                            />
                          </div>
                          <span className="text-right tabular-nums text-muted-foreground">{word.count}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aún no hay suficientes palabras.</p>
                  )}
                </Card>
              </div>

              {/* Tono de voz */}
              <Card className="p-5">
                <div className="flex items-center gap-2">
                  <AudioLines className="size-4 text-muted-foreground" />
                  <h2 className="text-base font-semibold">Tono de voz</h2>
                </div>
                {voice ? (
                  <>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Medido sobre el audio de toda la reunión, sin separar a las personas.
                    </p>
                    <dl className={cn("mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4")}>
                      <VoiceFact label="Perfil general" value={voice.label} />
                      <VoiceFact label="Energía de la voz" value={`${voice.energy} / 100`} />
                      <VoiceFact
                        label="Variación del tono"
                        value={voice.pitchVariationHz !== null ? `${voice.pitchVariationHz} Hz` : "—"}
                      />
                      <VoiceFact label="Pausas" value={`${voice.pausePercent}%`} />
                    </dl>
                    <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                      Describe cómo suena la voz (volumen, variación y pausas). No determina si alguien está enojado o
                      feliz, y depende del micrófono y de la sala.
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Disponible solo cuando la reunión se graba con el micrófono.
                  </p>
                )}
              </Card>
            </>
          ) : null}
        </div>

        {/* Lateral */}
        <aside className="space-y-6 xl:col-span-4">
          <Card className="p-5">
            <h2 className="text-base font-semibold">Mis reuniones</h2>
            <p className="mb-3 text-xs text-muted-foreground">Solo tú puedes verlas</p>
            {!historyAvailable ? (
              <p className="text-sm text-muted-foreground">
                El historial aún no está disponible. Puedes grabar y analizar, pero todavía no guardar.
              </p>
            ) : saved.length > 0 ? (
              <ul className="-mx-2 space-y-0.5">
                {saved.map((meeting) => (
                  <li key={meeting.id} className="group flex items-center gap-1 rounded-lg hover:bg-muted">
                    <button type="button" onClick={() => openSaved(meeting)} className="min-w-0 flex-1 px-2 py-2 text-left">
                      <span className="block truncate text-sm font-medium">{meeting.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {timeAgo(meeting.created_at)}
                        {meeting.duration_seconds !== null ? ` · ${formatDuration(meeting.duration_seconds)}` : ""}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(meeting)}
                      aria-label={`Eliminar ${meeting.title}`}
                      className="mr-1 rounded-md p-2 text-muted-foreground transition hover:text-brand-red"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Todavía no has guardado reuniones.</p>
            )}
          </Card>

          <div className="rounded-2xl border border-border bg-muted/40 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-4 text-brand-emerald" />
              Privacidad
            </div>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
              <li>· El audio se queda en tu navegador: no se sube ni se guarda, salvo que lo descargues.</li>
              <li>· Solo se guardan el texto y el análisis, y únicamente si lo decides.</li>
              <li>· A diferencia del feed, una reunión no es anónima: evita usarla para evaluar a personas.</li>
              <li>· El análisis no alimenta los indicadores del dashboard.</li>
            </ul>
          </div>
        </aside>
      </div>
    </AppLayout>
  );
}

function Stat({ label, value, unit, small }: { label: string; value: string; unit?: string; small?: boolean }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 flex items-baseline gap-1">
        <span className={cn("font-semibold tabular-nums tracking-tight", small ? "text-base leading-tight" : "text-2xl")}>
          {value}
        </span>
        {unit ? <span className="text-xs text-muted-foreground">{unit}</span> : null}
      </p>
    </Card>
  );
}

function VoiceFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-semibold">{value}</dd>
    </div>
  );
}
