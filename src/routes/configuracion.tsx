import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck, EyeOff, Lock, Bell, FileCheck2 } from "lucide-react";
import { AppLayout, Card } from "@/components/AppLayout";

export const Route = createFileRoute("/configuracion")({
  head: () => ({
    meta: [
      { title: "Privacidad · NEXUS LEAD IA" },
      {
        name: "description",
        content: "Cómo NEXUS LEAD IA protege tu anonimato y tus datos.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <AppLayout
      title="Privacidad y Anonimato"
      subtitle="Así protegemos tu identidad y tus respuestas"
    >
      {/* Hero explanation */}
      <Card className="mb-6 overflow-hidden bg-brand-navy text-white">
        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
          <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-brand-blue/15 text-brand-blue">
            <ShieldCheck className="size-7" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-blue">
              Promesa de Anonimato
            </p>
            <h2 className="mt-2 text-xl font-bold leading-snug">
              Los comentarios son visibles para el líder solo mediante códigos
              anónimos. La identidad real no se muestra en el feed ni en el
              dashboard.
            </h2>
          </div>
        </div>
      </Card>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* How it works */}
        <Card>
          <h3 className="text-base font-bold">Cómo funciona tu anonimato</h3>
          <ol className="mt-5 space-y-5">
            {[
              {
                n: 1,
                t: "Tu identidad se reemplaza por un código COL-###",
                d: "Cada cuenta recibe un código aleatorio que rota periódicamente. Nadie en la empresa puede mapearlo.",
              },
              {
                n: 2,
                t: "El texto se procesa cifrado",
                d: "Tus comentarios viajan con cifrado AES-256 y son analizados por la IA sin almacenar metadatos personales.",
              },
              {
                n: 3,
                t: "Los líderes ven datos agregados",
                d: "Solo se muestran tendencias, emociones y códigos anónimos. Nunca nombres, correos ni ubicaciones.",
              },
            ].map((s) => (
              <li key={s.n} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-4">
                <span className="grid size-7 place-items-center rounded-full bg-brand-blue/10 text-xs font-bold text-brand-blue">
                  {s.n}
                </span>
                <div>
                  <p className="text-sm font-semibold">{s.t}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {s.d}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        {/* Toggles */}
        <div className="space-y-6">
          <Card>
            <h3 className="text-base font-bold">Consentimiento</h3>
            <p className="mb-5 mt-1 text-xs text-muted-foreground">
              Controla cómo se utilizan tus aportes
            </p>
            <div className="space-y-1">
              <Toggle
                icon={EyeOff}
                title="Participar en el feed anónimo"
                desc="Tus publicaciones se mostrarán al equipo con tu código COL."
                defaultOn
              />
              <Toggle
                icon={FileCheck2}
                title="Permitir análisis por IA"
                desc="Nexus IA puede leer tus comentarios para detectar patrones."
                defaultOn
              />
              <Toggle
                icon={Lock}
                title="Incluirme en métricas agregadas"
                desc="Tus respuestas suman al promedio del equipo, nunca individuales."
                defaultOn
              />
            </div>
          </Card>

          <Card>
            <h3 className="text-base font-bold">Notificaciones</h3>
            <p className="mb-5 mt-1 text-xs text-muted-foreground">
              Cuándo quieres saber de Nexus IA
            </p>
            <div className="space-y-1">
              <Toggle
                icon={Bell}
                title="Resumen diario del equipo"
                desc="Te enviamos un resumen al final del día laboral."
                defaultOn
              />
              <Toggle
                icon={Bell}
                title="Alertas de burnout"
                desc="Solo cuando se detecte un patrón crítico en tu área."
              />
            </div>
          </Card>
        </div>
      </section>

      <Card className="mt-6 grid grid-cols-1 items-center gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <h3 className="text-sm font-bold">¿Quieres eliminar tus datos?</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Puedes solicitar la eliminación completa de tu historial en
            cualquier momento. El proceso es irreversible.
          </p>
        </div>
        <button className="shrink-0 rounded-xl border border-brand-red/30 bg-brand-red/5 px-5 py-2.5 text-sm font-semibold text-brand-red transition hover:bg-brand-red/10">
          Solicitar eliminación
        </button>
      </Card>
    </AppLayout>
  );
}

function Toggle({
  icon: Icon,
  title,
  desc,
  defaultOn = false,
}: {
  icon: typeof EyeOff;
  title: string;
  desc: string;
  defaultOn?: boolean;
}) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 py-3">
      <div className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{desc}</p>
      </div>
      <button
        onClick={() => setOn((v) => !v)}
        className={
          "relative h-6 w-11 shrink-0 rounded-full transition " +
          (on ? "bg-brand-emerald" : "bg-muted")
        }
        aria-pressed={on}
      >
        <span
          className={
            "absolute top-0.5 size-5 rounded-full bg-white shadow transition-all " +
            (on ? "left-[1.375rem]" : "left-0.5")
          }
        />
      </button>
    </div>
  );
}
