import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Send, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase";
import { saveDigitalTwinProfile } from "@/lib/digitalTwin";
import type { EQIAssessment, MLQAssessment, TKIAssessment } from "@/types/assessment";

const eqQuestions = [
  "Soy consciente de mis emociones cuando tomo decisiones importantes.",
  "Puedo describir con precisión cómo me siento en situaciones de presión.",
  "Entiendo por qué ciertas situaciones me generan malestar.",
  "Reconozco el estado emocional de mis colegas sin que me lo digan.",
  "Cuando alguien de mi equipo está mal, lo noto antes de que lo exprese.",
  "Adapto mi forma de comunicarme según el estado emocional del otro.",
  "Mantengo la calma cuando el equipo enfrenta situaciones de alta presión.",
  "Recupero mi equilibrio emocional con relativa rapidez tras un conflicto.",
  "Evito que mis emociones negativas afecten mis decisiones laborales.",
  "Me motivan los desafíos difíciles aunque impliquen riesgo de fracaso.",
  "Mantengo mi compromiso con los objetivos incluso cuando los resultados tardan.",
  "Busco activamente soluciones en lugar de enfocarme en el problema.",
  "Resuelvo conflictos interpersonales buscando acuerdos que beneficien a todos.",
  "Genero relaciones de confianza en mis equipos de trabajo.",
  "Mi red de relaciones profesionales me respalda en momentos difíciles.",
];

const mlqQuestions = [
  "Hago que los demás se sientan bien cuando están cerca de mí.",
  "Expreso con pocas palabras lo que podríamos y deberíamos lograr.",
  "Ayudo a los demás a desarrollar sus fortalezas.",
  "Sugiero nuevas formas de mirar cómo completamos nuestro trabajo.",
  "Me siento bien cuando los demás cumplen con sus compromisos.",
  "Expreso satisfacción cuando los demás cumplen las expectativas.",
  "Los demás tienen plena confianza en mí.",
  "Doy a los demás lo que quieren a cambio de su apoyo.",
  "Evito involucrarme cuando surgen problemas importantes.",
  "Estoy ausente cuando se me necesita.",
  "Evito tomar decisiones.",
  "Demoro la respuesta a preguntas urgentes.",
];

const tkiPairs = [
  {
    a: "Prefiero no entrar en conflicto y ceder.",
    b: "Intento que se consideren mis objetivos y los del otro.",
  },
  {
    a: "Trato de ganar la discusión con argumentos sólidos.",
    b: "Busco un punto medio que sea aceptable para ambos.",
  },
  {
    a: "Generalmente satisfago las necesidades del otro antes que las mías.",
    b: "Comparto el problema y buscamos una solución juntos.",
  },
  {
    a: "Intento encontrar una solución de compromiso.",
    b: "A veces sacrifico mis propios deseos por los del otro.",
  },
  {
    a: "Busco consistentemente la ayuda del otro para encontrar una solución.",
    b: "Intento hacer lo necesario para evitar tensiones inútiles.",
  },
  {
    a: "Intento evitar crear situaciones desagradables para mí.",
    b: "Intento imponer mi posición.",
  },
  {
    a: "Pospongo el tema hasta que haya tenido tiempo de pensarlo.",
    b: "Cedo en algunos puntos a cambio de otros.",
  },
  {
    a: "Suele ser firme en la consecución de mis objetivos.",
    b: "Intento plantear inmediatamente y abiertamente todos los intereses en juego.",
  },
  {
    a: "Siento que no siempre vale la pena preocuparse por las diferencias.",
    b: "Hago un esfuerzo por lograr lo que quiero.",
  },
  {
    a: "Soy firme en la consecución de mis objetivos.",
    b: "Intento encontrar una solución de compromiso.",
  },
];

const likertLabelsEQ = ["Nunca", "Raramente", "A veces", "Con frecuencia", "Siempre"];
const likertLabelsMLQ = ["Nunca", "Raramente", "A veces", "Con frecuencia", "Casi siempre"];

const stepTitle = [
  "Inteligencia Emocional",
  "Estilo de Liderazgo",
  "Modo de Manejo de Conflictos",
];

export function AssessmentFlow() {
  const [step, setStep] = useState(1);
  const [eqAnswers, setEqAnswers] = useState<EQIAssessment>(Array(15).fill(0));
  const [mlqAnswers, setMLQAnswers] = useState<MLQAssessment>(Array(12).fill(-1));
  const [tkiAnswers, setTKIAnswers] = useState<TKIAssessment>(Array(10).fill(null));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const completedStep = useMemo(() => {
    if (step === 1) {
      return eqAnswers.every((value) => value >= 1 && value <= 5);
    }
    if (step === 2) {
      return mlqAnswers.every((value) => value >= 0 && value <= 4);
    }
    return tkiAnswers.every((answer) => answer === "A" || answer === "B");
  }, [eqAnswers, mlqAnswers, step, tkiAnswers]);

  const canAdvance = completedStep;

  const handleEqChange = (index: number, value: number) => {
    setEqAnswers((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  };

  const handleMlqChange = (index: number, value: number) => {
    setMLQAnswers((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  };

  const handleTkiChange = (index: number, value: "A" | "B") => {
    setTKIAnswers((current) => {
      const next = [...current];
      next[index] = value;
      return next as TKIAssessment;
    });
  };

  const handleNext = () => {
    if (!canAdvance) return;
    setStep((prev) => Math.min(3, prev + 1));
  };

  const handleSubmit = async () => {
    if (!canAdvance) return;
    setError(null);
    setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) {
        throw new Error("No se pudo obtener el usuario autenticado.");
      }

      await saveDigitalTwinProfile(userId, eqAnswers, mlqAnswers, tkiAnswers);
      await navigate({ to: "/onboarding/complete" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar el perfil.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-16">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm shadow-slate-900/5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Paso {step} de 3</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">{stepTitle[step - 1]}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Completa cada prueba para que Nexus Lead IA pueda construir tu perfil de liderazgo.
            </p>
          </div>
          <div className="min-w-[220px]">
            <Progress value={(step / 3) * 100} />
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-brand-red/20 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">
          {error}
        </div>
      ) : null}

      <div className="space-y-6">
        {step === 1 && (
          <section className="space-y-6 rounded-3xl border border-border bg-card p-6">
            <p className="text-sm font-medium text-muted-foreground">Escala Likert 1-5</p>
            {eqQuestions.map((question, index) => (
              <div key={question} className="space-y-3 rounded-3xl border border-border/80 bg-background px-4 py-4">
                <p className="text-sm font-semibold">{index + 1}. {question}</p>
                <div className="grid grid-cols-5 gap-2">
                  {likertLabelsEQ.map((label, valueIndex) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => handleEqChange(index, valueIndex + 1)}
                      className={
                        "rounded-2xl border px-2 py-2 text-[11px] transition " +
                        (eqAnswers[index] === valueIndex + 1
                          ? "border-brand-blue bg-brand-blue/10 text-brand-blue"
                          : "border-border bg-muted text-muted-foreground hover:border-brand-blue hover:text-foreground")
                      }
                    >
                      {valueIndex + 1}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {step === 2 && (
          <section className="space-y-6 rounded-3xl border border-border bg-card p-6">
            <p className="text-sm font-medium text-muted-foreground">Escala Likert 0-4</p>
            {mlqQuestions.map((question, index) => (
              <div key={question} className="space-y-3 rounded-3xl border border-border/80 bg-background px-4 py-4">
                <p className="text-sm font-semibold">{index + 1}. {question}</p>
                <div className="grid grid-cols-5 gap-2">
                  {likertLabelsMLQ.map((label, valueIndex) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => handleMlqChange(index, valueIndex)}
                      className={
                        "rounded-2xl border px-2 py-2 text-[11px] transition " +
                        (mlqAnswers[index] === valueIndex
                          ? "border-brand-blue bg-brand-blue/10 text-brand-blue"
                          : "border-border bg-muted text-muted-foreground hover:border-brand-blue hover:text-foreground")
                      }
                    >
                      {valueIndex}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {step === 3 && (
          <section className="space-y-6 rounded-3xl border border-border bg-card p-6">
            {tkiPairs.map((pair, index) => (
              <div key={pair.a} className="space-y-3 rounded-3xl border border-border/80 bg-background px-4 py-4">
                <p className="text-sm font-semibold">Par {index + 1}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(["A", "B"] as const).map((option) => {
                    const label = option === "A" ? pair.a : pair.b;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => handleTkiChange(index, option)}
                        className={
                          "rounded-3xl border px-4 py-4 text-left text-sm transition " +
                          (tkiAnswers[index] === option
                            ? "border-brand-blue bg-brand-blue/10 text-brand-blue"
                            : "border-border bg-muted text-muted-foreground hover:border-brand-blue hover:text-foreground")
                        }
                      >
                        <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          {option}
                        </span>
                        <span className="mt-2 block leading-6 text-foreground">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {step > 1 ? (
          <Button variant="secondary" size="sm" onClick={() => setStep((prev) => prev - 1)}>
            <ArrowLeft className="size-4" /> Volver
          </Button>
        ) : (
          <div />
        )}

        <Button
          onClick={step === 3 ? handleSubmit : handleNext}
          disabled={!canAdvance || loading}
          className="w-full sm:w-auto"
        >
          <Send className="size-4" />
          {loading
            ? "Guardando…"
            : step === 3
            ? "Finalizar y crear mi gemelo digital"
            : "Siguiente"}
        </Button>
      </div>
    </div>
  );
}
