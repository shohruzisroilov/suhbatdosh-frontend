import { useCallback, useEffect, useRef, useState } from 'react';

const SILENCE_RMS = 0.012;
// How long to wait after speech stops before sending the turn.
//
// This is dead air the person sits through on every single turn, and it lands on
// top of transcription, the model reply and speech. At 2800ms the whole round trip
// was 6-10s, which reads as a form being submitted rather than someone answering.
// 1200ms is long enough to ride out a mid-sentence thinking pause without cutting
// people off.
const SILENCE_AFTER_SPEECH_MS = 1200;
const NO_SPEECH_TIMEOUT_MS = 12_000;
const TICK_MS = 100;
const SPEECH_BITRATE = 32_000;

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
}

export function useRecorder() {
  const supported =
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia);

  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<'denied' | 'failed' | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const bufRef = useRef<Float32Array | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<any>(null);
  const startedAtRef = useRef(0);
  const doneRef = useRef<((blob: Blob | null, ms: number, heardSpeech: boolean) => void) | null>(null);
  const heardSpeechRef = useRef(false);
  const lastLoudAtRef = useRef(0);
  const maxMsRef = useRef(0);
  const finishingRef = useRef(false);

  const prime = useCallback(async () => {
    if (!supported) {
      setError('failed');
      return false;
    }
    if (streamRef.current) return true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);

      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      bufRef.current = new Float32Array(analyser.fftSize);

      setError(null);
      return true;
    } catch (err: any) {
      setError(
        err?.name === 'NotAllowedError' || err?.name === 'SecurityError' ? 'denied' : 'failed'
      );
      return false;
    }
  }, [supported]);

  const readLevel = useCallback(() => {
    const analyser = analyserRef.current;
    const buf = bufRef.current;
    if (!analyser || !buf) return 0;
    analyser.getFloatTimeDomainData(buf as any);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  }, []);

  const clearTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    clearTick();

    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      const done = doneRef.current;
      doneRef.current = null;
      setRecording(false);
      setLevel(0);
      done?.(null, 0, false);
      return;
    }
    try {
      recorder.stop();
    } catch {}
  }, [clearTick]);

  const start = useCallback(
    async ({
      maxSec,
      onDone,
    }: {
      maxSec: number;
      onDone: (blob: Blob | null, ms: number, heardSpeech: boolean) => void;
    }) => {
      doneRef.current = onDone;
      finishingRef.current = false;
      heardSpeechRef.current = false;
      chunksRef.current = [];
      setElapsedMs(0);

      const ready = streamRef.current || (await prime());
      if (!ready || !streamRef.current) {
        doneRef.current = null;
        onDone?.(null, 0, false);
        return;
      }

      const mimeType = pickMimeType();
      const opts = {
        ...(mimeType ? { mimeType } : null),
        audioBitsPerSecond: SPEECH_BITRATE,
      };
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(streamRef.current, opts);
      } catch {
        try {
          recorder = new MediaRecorder(
            streamRef.current,
            mimeType ? { mimeType } : undefined
          );
        } catch {
          setError('failed');
          doneRef.current = null;
          onDone?.(null, 0, false);
          return;
        }
      }

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        clearTick();
        const ms = Date.now() - startedAtRef.current;
        const blob = chunksRef.current.length
          ? new Blob(chunksRef.current, {
              type: recorder.mimeType || mimeType || 'audio/webm',
            })
          : null;
        chunksRef.current = [];
        recorderRef.current = null;
        setRecording(false);
        setLevel(0);

        const done = doneRef.current;
        doneRef.current = null;
        done?.(blob, ms, heardSpeechRef.current);
      };

      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      lastLoudAtRef.current = Date.now();
      maxMsRef.current = Math.max(maxSec, 1) * 1000;

      try {
        recorder.start();
      } catch {
        setError('failed');
        recorderRef.current = null;
        doneRef.current = null;
        onDone?.(null, 0, false);
        return;
      }
      setRecording(true);

      tickRef.current = setInterval(() => {
        const now = Date.now();
        const elapsed = now - startedAtRef.current;
        setElapsedMs(elapsed);

        const rms = readLevel();
        setLevel(Math.min(rms * 12, 1));

        if (rms > SILENCE_RMS) {
          heardSpeechRef.current = true;
          lastLoudAtRef.current = now;
        }

        if (elapsed >= maxMsRef.current) {
          stop();
          return;
        }

        const silentFor = now - lastLoudAtRef.current;
        if (heardSpeechRef.current) {
          if (silentFor >= SILENCE_AFTER_SPEECH_MS) stop();
        } else if (elapsed >= NO_SPEECH_TIMEOUT_MS) {
          stop();
        }
      }, TICK_MS);
    },
    [prime, readLevel, clearTick, stop]
  );

  const release = useCallback(() => {
    clearTick();
    doneRef.current = null;
    try {
      recorderRef.current?.stop();
    } catch {}
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    setRecording(false);
    setLevel(0);
  }, [clearTick]);

  useEffect(() => release, [release]);

  return { supported, recording, level, elapsedMs, error, prime, start, stop, release };
}
