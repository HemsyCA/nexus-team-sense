// Worked examples for the decision simulator. They run entirely in the browser
// (no AI call, nothing saved), so the flow can be shown when the API is down.
// The figures are illustrative and the UI must always label them as such: they
// do not come from a real organisation or from the model.

export type ExampleOutcome = {
  summary: string;
  risk_level: "low" | "medium" | "high" | "critical";
  risk_score: number;
  recommendations: string[];
  projected_metrics: Record<string, { before: number; after: number }>;
};

export type ExampleAlternative = {
  id: string;
  title: string;
  description: string;
  outcome: ExampleOutcome;
};

export type ExampleCase = {
  id: string;
  title: string;
  decision: string;
  alternatives: ExampleAlternative[];
};

const metrics = (
  before: [estres: number, motivacion: number, clima: number, productividad: number, confianza: number],
  after: [estres: number, motivacion: number, clima: number, productividad: number, confianza: number],
) => ({
  estres: { before: before[0], after: after[0] },
  motivacion: { before: before[1], after: after[1] },
  clima: { before: before[2], after: after[2] },
  productividad: { before: before[3], after: after[3] },
  confianza: { before: before[4], after: after[4] },
});

const MEETINGS_BEFORE: [number, number, number, number, number] = [55, 62, 64, 68, 66];
const OFFICE_BEFORE: [number, number, number, number, number] = [42, 70, 72, 74, 71];
const CLOSING_BEFORE: [number, number, number, number, number] = [78, 48, 52, 66, 58];

export const EXAMPLE_CASES: ExampleCase[] = [
  {
    id: "reuniones",
    title: "Adelantar la reunión diaria",
    decision: "Cambiar la reunión diaria del equipo de las 8:00 a. m. a las 7:00 a. m. para ganar tiempo operativo.",
    alternatives: [
      {
        id: "reuniones-obligatoria",
        title: "Aplicar el cambio a todo el equipo",
        description: "Todos se conectan a las 7:00 a. m. desde la próxima semana, sin periodo de prueba.",
        outcome: {
          summary:
            "Se gana una hora de coordinación, pero el cambio impuesto afecta el descanso y la conciliación familiar. Es probable que el estrés suba y que la confianza en el líder baje.",
          risk_level: "high",
          risk_score: 7.5,
          recommendations: [
            "Explicar el motivo del cambio antes de aplicarlo.",
            "Medir la energía del equipo durante las primeras dos semanas.",
          ],
          projected_metrics: metrics(MEETINGS_BEFORE, [72, 50, 52, 70, 50]),
        },
      },
      {
        id: "reuniones-piloto",
        title: "Piloto voluntario de dos semanas",
        description: "Un grupo voluntario prueba el nuevo horario y luego se decide con los resultados.",
        outcome: {
          summary:
            "El equipo participa en la decisión y se obtiene evidencia antes de generalizar. La mejora operativa es menor al inicio, con un riesgo mucho más bajo.",
          risk_level: "low",
          risk_score: 3,
          recommendations: [
            "Definir de antemano qué indicadores decidirán el resultado.",
            "Compartir los resultados del piloto con todo el equipo.",
          ],
          projected_metrics: metrics(MEETINGS_BEFORE, [56, 66, 68, 71, 72]),
        },
      },
      {
        id: "reuniones-asincrona",
        title: "Reemplazarla por un reporte escrito",
        description: "Actualización escrita diaria y solo dos reuniones en vivo por semana.",
        outcome: {
          summary:
            "Se libera tiempo sin adelantar el horario y baja la fatiga por reuniones. El reto es mantener la cohesión y la disciplina del reporte escrito.",
          risk_level: "medium",
          risk_score: 4.5,
          recommendations: [
            "Usar una plantilla breve para el reporte diario.",
            "Reservar las reuniones en vivo para bloqueos y decisiones.",
          ],
          projected_metrics: metrics(MEETINGS_BEFORE, [46, 68, 67, 74, 68]),
        },
      },
    ],
  },
  {
    id: "presencial",
    title: "Retorno a la oficina",
    decision: "Pedir que el equipo vuelva a trabajar de forma presencial los cinco días de la semana.",
    alternatives: [
      {
        id: "presencial-total",
        title: "Cinco días presenciales",
        description: "Retorno general en un plazo de 30 días, sin excepciones.",
        outcome: {
          summary:
            "Mejora la coordinación cara a cara, pero se pierde flexibilidad valorada por el equipo. Aumenta el riesgo de rotación, sobre todo en perfiles con mayor demanda.",
          risk_level: "high",
          risk_score: 8,
          recommendations: [
            "Identificar los perfiles con mayor riesgo de salida.",
            "Revisar los motivos reales del retorno con el equipo.",
          ],
          projected_metrics: metrics(OFFICE_BEFORE, [64, 50, 53, 72, 52]),
        },
      },
      {
        id: "presencial-hibrido",
        title: "Esquema híbrido con días ancla",
        description: "Tres días presenciales, dos de ellos fijos para todo el equipo.",
        outcome: {
          summary:
            "Se recupera la colaboración presencial conservando parte de la flexibilidad. Es la opción más equilibrada entre coordinación y bienestar.",
          risk_level: "low",
          risk_score: 3.5,
          recommendations: [
            "Usar los días ancla para trabajo colaborativo.",
            "Revisar el esquema a los tres meses.",
          ],
          projected_metrics: metrics(OFFICE_BEFORE, [44, 72, 76, 78, 75]),
        },
      },
      {
        id: "presencial-por-area",
        title: "Decisión por área",
        description: "Cada líder acuerda con su equipo los días presenciales según sus necesidades.",
        outcome: {
          summary:
            "Aumenta la autonomía y la confianza, aunque puede percibirse desigualdad entre áreas y dificultar la coordinación transversal.",
          risk_level: "medium",
          risk_score: 5,
          recommendations: [
            "Publicar criterios comunes para todas las áreas.",
            "Definir al menos un día común para coordinar entre áreas.",
          ],
          projected_metrics: metrics(OFFICE_BEFORE, [40, 74, 73, 73, 77]),
        },
      },
    ],
  },
  {
    id: "cierre",
    title: "Sobrecarga en el cierre de mes",
    decision: "El equipo muestra señales de agotamiento por la sobrecarga de cada cierre de mes. ¿Cómo debería actuar el líder?",
    alternatives: [
      {
        id: "cierre-horas-extra",
        title: "Mantener el proceso y pagar horas extra",
        description: "Se reconoce el esfuerzo económicamente sin cambiar la forma de trabajo.",
        outcome: {
          summary:
            "El reconocimiento ayuda a corto plazo, pero la causa de la sobrecarga sigue ahí. El agotamiento probablemente continúe en los próximos cierres.",
          risk_level: "high",
          risk_score: 7,
          recommendations: [
            "No usar el pago como única medida.",
            "Registrar las horas para dimensionar el problema real.",
          ],
          projected_metrics: metrics(CLOSING_BEFORE, [76, 54, 54, 67, 60]),
        },
      },
      {
        id: "cierre-redistribuir",
        title: "Redistribuir tareas y escalonar entregas",
        description: "Se adelantan tareas previsibles y se escalonan las fechas internas del cierre.",
        outcome: {
          summary:
            "Actúa sobre la causa: la carga se reparte durante el mes y baja el pico de estrés. Requiere coordinar con otras áreas durante uno o dos ciclos.",
          risk_level: "low",
          risk_score: 3,
          recommendations: [
            "Mapear qué tareas del cierre se pueden adelantar.",
            "Acordar las nuevas fechas con las áreas que entregan información.",
          ],
          projected_metrics: metrics(CLOSING_BEFORE, [52, 66, 70, 74, 72]),
        },
      },
      {
        id: "cierre-refuerzo",
        title: "Sumar apoyo temporal",
        description: "Una persona de otra área apoya durante la semana de cierre.",
        outcome: {
          summary:
            "Alivia la carga con rapidez, aunque consume tiempo de capacitación y traslada presión al área que presta el apoyo.",
          risk_level: "medium",
          risk_score: 5,
          recommendations: [
            "Documentar las tareas antes de delegarlas.",
            "Verificar el impacto en el área que brinda apoyo.",
          ],
          projected_metrics: metrics(CLOSING_BEFORE, [62, 58, 62, 72, 64]),
        },
      },
    ],
  },
];
