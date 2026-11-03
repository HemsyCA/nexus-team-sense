// Browser-only analysis of a meeting: word frequencies and an emotion lexicon
// over the transcript, plus acoustic measures of the voice. These are estimates
// (dictionary matches and signal statistics), not a diagnosis of how anyone feels.

export type EmotionKey = "felicidad" | "enojo" | "estres" | "tristeza";

export type EmotionResult = {
  key: EmotionKey;
  label: string;
  count: number;
  words: Array<{ word: string; count: number }>;
};

export type TranscriptAnalysis = {
  wordCount: number;
  wordsPerMinute: number | null;
  topWords: Array<{ word: string; count: number }>;
  emotions: EmotionResult[];
  dominant: EmotionResult | null;
};

export type VoiceSample = { rms: number; pitch: number | null };

export type VoiceSummary = {
  energy: number;
  pitchHz: number | null;
  pitchVariationHz: number | null;
  pausePercent: number;
  label: string;
};

// Accent-free stems matched as prefixes. Ambiguous stems are avoided on purpose
// (e.g. "content" would also match "contenido").
const EMOTIONS: Array<{ key: EmotionKey; label: string; stems: string[] }> = [
  {
    key: "felicidad",
    label: "Felicidad",
    stems: ["feliz", "felic", "contento", "contenta", "alegr", "satisf", "genial", "excelent", "orgull", "gracias", "agradec", "motivad", "entusias"],
  },
  {
    key: "enojo",
    label: "Enojo",
    stems: ["enoj", "molest", "frustr", "rabia", "furi", "indign", "irrit", "harto", "harta", "fastidi"],
  },
  {
    key: "estres",
    label: "Estrés o preocupación",
    stems: ["estres", "agotad", "agotamiento", "cansad", "cansancio", "presion", "preocup", "ansie", "miedo", "temor", "sobrecarg", "fatig", "burnout"],
  },
  {
    key: "tristeza",
    label: "Tristeza o desánimo",
    stems: ["trist", "decepcion", "desanim", "desmotiv", "lament"],
  },
];

const NEGATIONS = new Set(["no", "nunca", "sin", "tampoco", "ni", "nada"]);

const STOPWORDS = new Set(
  `a al algo algun alguna algunas alguno algunos ante antes asi aun aunque bien cada casi como con contra cual cuales cuando de del desde donde dos e el ella ellas ello ellos en entre era eran es esa esas ese eso esos esta estaba estaban estamos estan estar estas este esto estos estoy fue fueron ha habia han hasta hay hemos hoy la las le les lo los mas me mi mis mucho muchos muy nada ni no nos nosotros nuestra nuestro o otra otras otro otros para pero poco por porque pues que quien se sea segun ser si sin sobre solo son su sus tal tambien tan tanto te tenemos tengo tiene tienen todo todos tu tus un una uno unos vamos van varias varios y ya yo creo digamos entonces osea eh ah este bueno claro vez cosa cosas hacer hace hizo puede pueden podemos ver voy va da dar`.split(/\s+/),
);

function normalize(word: string) {
  return word.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function tokenize(text: string) {
  return text.match(/[\p{L}\p{N}]+/gu) ?? [];
}

function ranked(counts: Map<string, number>, limit: number) {
  return Array.from(counts.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, limit);
}

export function analyzeTranscript(text: string, durationSeconds: number | null): TranscriptAnalysis {
  const tokens = tokenize(text);
  const normalized = tokens.map(normalize);
  const wordCounts = new Map<string, number>();
  const emotionWords = new Map<EmotionKey, Map<string, number>>(EMOTIONS.map((e) => [e.key, new Map()]));

  tokens.forEach((token, i) => {
    const plain = normalized[i];
    if (plain.length > 2 && !STOPWORDS.has(plain) && !/^\d+$/.test(plain)) {
      const shown = token.toLowerCase();
      wordCounts.set(shown, (wordCounts.get(shown) ?? 0) + 1);
    }

    // "no estoy contento" must not count as happiness: look two words back.
    const negated = NEGATIONS.has(normalized[i - 1] ?? "") || NEGATIONS.has(normalized[i - 2] ?? "");
    if (negated) return;
    const emotion = EMOTIONS.find((e) => e.stems.some((stem) => plain.startsWith(stem)));
    if (emotion) {
      const words = emotionWords.get(emotion.key)!;
      const shown = token.toLowerCase();
      words.set(shown, (words.get(shown) ?? 0) + 1);
    }
  });

  const emotions: EmotionResult[] = EMOTIONS.map((emotion) => {
    const words = ranked(emotionWords.get(emotion.key)!, 5);
    const total = Array.from(emotionWords.get(emotion.key)!.values()).reduce((sum, n) => sum + n, 0);
    return { key: emotion.key, label: emotion.label, count: total, words };
  });

  const dominant = emotions.reduce<EmotionResult | null>(
    (best, emotion) => (emotion.count > (best?.count ?? 0) ? emotion : best),
    null,
  );

  return {
    wordCount: tokens.length,
    wordsPerMinute:
      durationSeconds && durationSeconds >= 10 ? Math.round(tokens.length / (durationSeconds / 60)) : null,
    topWords: ranked(wordCounts, 10),
    emotions,
    dominant,
  };
}

// Pitch of a voiced frame via autocorrelation, limited to the human speech range.
export function estimatePitch(frame: Float32Array, sampleRate: number): number | null {
  const minLag = Math.floor(sampleRate / 400);
  const maxLag = Math.min(Math.floor(sampleRate / 75), frame.length - 1);
  let energy = 0;
  for (let i = 0; i < frame.length; i += 1) energy += frame[i] * frame[i];
  if (energy === 0) return null;

  let bestLag = -1;
  let bestCorrelation = 0;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let sum = 0;
    let left = 0;
    let right = 0;
    for (let i = 0; i + lag < frame.length; i += 1) {
      sum += frame[i] * frame[i + lag];
      left += frame[i] * frame[i];
      right += frame[i + lag] * frame[i + lag];
    }
    const correlation = left > 0 && right > 0 ? sum / Math.sqrt(left * right) : 0;
    // Prefer the shortest lag that is nearly as good, to avoid octave errors.
    if (correlation > bestCorrelation + 0.01) {
      bestCorrelation = correlation;
      bestLag = lag;
    }
  }
  return bestLag > 0 && bestCorrelation > 0.6 ? sampleRate / bestLag : null;
}

export const VOICED_RMS = 0.015;

export function summarizeVoice(samples: VoiceSample[]): VoiceSummary | null {
  if (samples.length === 0) return null;
  const voiced = samples.filter((sample) => sample.rms >= VOICED_RMS);
  if (voiced.length === 0) return null;

  const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;
  const rmsMean = mean(voiced.map((sample) => sample.rms));
  // Roughly -50 dB (silence) to -10 dB (loud speech close to the mic) mapped to 0-100.
  const db = 20 * Math.log10(rmsMean);
  const energy = Math.round(Math.max(0, Math.min(100, ((db + 50) / 40) * 100)));

  const pitches = voiced.map((sample) => sample.pitch).filter((pitch): pitch is number => pitch !== null);
  const pitchHz = pitches.length > 0 ? mean(pitches) : null;
  const pitchVariationHz =
    pitchHz !== null ? Math.sqrt(mean(pitches.map((pitch) => (pitch - pitchHz) ** 2))) : null;

  const variation = pitchVariationHz ?? 0;
  const label =
    energy >= 60 && variation >= 35
      ? "Intenso y variable"
      : energy >= 60
        ? "Intenso y estable"
        : energy < 30 && variation < 20
          ? "Bajo y monótono"
          : "Moderado";

  return {
    energy,
    pitchHz: pitchHz === null ? null : Math.round(pitchHz),
    pitchVariationHz: pitchVariationHz === null ? null : Math.round(pitchVariationHz),
    pausePercent: Math.round((1 - voiced.length / samples.length) * 100),
    label,
  };
}
