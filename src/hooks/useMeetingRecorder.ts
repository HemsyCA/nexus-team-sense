import { useCallback, useEffect, useRef, useState } from "react";

import { estimatePitch, summarizeVoice, VOICED_RMS, type VoiceSample, type VoiceSummary } from "@/lib/meeting-analysis";

// Web Speech API is not part of the TypeScript DOM lib yet.
type SpeechResultEvent = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
};
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const SAMPLE_INTERVAL_MS = 200;

export function useMeetingRecorder({ onTranscript }: { onTranscript: (finalText: string) => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [speechWarning, setSpeechWarning] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [voice, setVoice] = useState<VoiceSummary | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [speechSupported, setSpeechSupported] = useState(true);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const listeningRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const samplesRef = useRef<VoiceSample[]>([]);
  const startedAtRef = useRef(0);
  const audioUrlRef = useRef<string | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  useEffect(() => {
    setSpeechSupported(getSpeechRecognition() !== null);
  }, []);

  const releaseDevices = useCallback(() => {
    listeningRef.current = false;
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void contextRef.current?.close();
    contextRef.current = null;
  }, []);

  const clearAudio = useCallback(() => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    setAudioUrl(null);
  }, []);

  const reset = useCallback(() => {
    clearAudio();
    setVoice(null);
    setDuration(null);
    setElapsed(0);
    setLevel(0);
    setInterim("");
    setError(null);
    setSpeechWarning(null);
  }, [clearAudio]);

  useEffect(
    () => () => {
      releaseDevices();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    },
    [releaseDevices],
  );

  const startRecognition = useCallback(() => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.lang = "es-PE";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let pending = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) onTranscriptRef.current(text.trim());
        else pending += text;
      }
      setInterim(pending);
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        listeningRef.current = false;
        setSpeechWarning("El navegador no permitió la transcripción. El audio se sigue grabando.");
      } else if (event.error === "network") {
        setSpeechWarning("La transcripción necesita internet. El audio se sigue grabando.");
      }
    };
    // Chrome ends recognition after silences: keep it alive until the user stops.
    recognition.onend = () => {
      if (!listeningRef.current) return;
      try {
        recognition.start();
      } catch {
        // already restarting
      }
    };
    recognitionRef.current = recognition;
    listeningRef.current = true;
    recognition.start();
  }, []);

  const start = useCallback(async () => {
    reset();
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Este navegador no permite grabar audio. Usa Chrome o Edge en una versión reciente.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("No se pudo acceder al micrófono. Revisa el permiso del navegador e inténtalo de nuevo.");
      return;
    }
    streamRef.current = stream;
    samplesRef.current = [];

    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      const url = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
      audioUrlRef.current = url;
      setAudioUrl(url);
    };
    recorderRef.current = recorder;
    recorder.start(1000);

    const context = new AudioContext();
    contextRef.current = context;
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    context.createMediaStreamSource(stream).connect(analyser);
    const frame = new Float32Array(analyser.fftSize);

    startedAtRef.current = Date.now();
    timerRef.current = window.setInterval(() => {
      analyser.getFloatTimeDomainData(frame);
      let sum = 0;
      for (let i = 0; i < frame.length; i += 1) sum += frame[i] * frame[i];
      const rms = Math.sqrt(sum / frame.length);
      samplesRef.current.push({
        rms,
        pitch: rms >= VOICED_RMS ? estimatePitch(frame, context.sampleRate) : null,
      });
      setLevel(Math.min(1, rms * 6));
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, SAMPLE_INTERVAL_MS);

    if (getSpeechRecognition()) startRecognition();
    setIsRecording(true);
  }, [reset, startRecognition]);

  const stop = useCallback(() => {
    setDuration(Math.round((Date.now() - startedAtRef.current) / 1000));
    setVoice(summarizeVoice(samplesRef.current));
    releaseDevices();
    setIsRecording(false);
    setInterim("");
    setLevel(0);
  }, [releaseDevices]);

  return {
    isRecording,
    elapsed,
    level,
    interim,
    error,
    speechWarning,
    speechSupported,
    audioUrl,
    voice,
    duration,
    start,
    stop,
    reset,
  };
}
