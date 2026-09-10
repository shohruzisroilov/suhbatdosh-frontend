import { useCallback, useEffect, useRef, useState } from 'react';
import { transcribeAiAudio, getTTSAudio } from '../api/endpoints';
import { streamAiTurn, AiStreamError } from '../api/aiStream';
import { notifyHaptic, tapHaptic } from '../utils/haptics';

export type VoiceStatus = 'connecting' | 'listening' | 'thinking' | 'speaking' | 'muted' | 'error';

/** Silence this long after speech has started is taken as the end of a turn. */
const END_OF_TURN_SILENCE_MS = 850;
/** A single turn cannot run longer than this, however quiet the room is. */
const MAX_TURN_MS = 30_000;
/** Sustained speech over the partner's own voice before it stops and listens. */
const BARGE_IN_MS = 320;

export interface VoiceConversationOptions {
  /** Null until the thread has been created; the loop waits for it. */
  conversationId: string | null;
  userLevel?: string;
  /** Spoken once on arrival, so nobody is left talking into silence first. */
  greeting?: string;
  /** Both halves of a finished turn, for the transcript. */
  onTurn: (userText: string, aiText: string) => void;
  /** The greeting, so it appears in the transcript like anything else said. */
  onGreeting?: (text: string) => void;
  onVocab?: (vocab: { word: string; meaning: string; example: string }) => void;
  /** Words per minute for this turn, accumulated by the caller for the end screen. */
  onWpm?: (wpm: number) => void;
  /**
   * Microphone loudness, 0–1, on every animation frame.
   *
   * A callback rather than state: this fires sixty times a second, and re-rendering
   * the screen that often to move one highlight is what makes a mid-range Android
   * phone drop the audio. The caller writes it straight to the element.
   */
  onLevel?: (level: number) => void;
}

/**
 * A spoken conversation that runs itself.
 *
 * It listens continuously and decides for itself when a turn has ended, so there is
 * no button to hold: the person talks, stops, and the reply comes back. Three things
 * make that feel like a conversation rather than a walkie-talkie — the reply is spoken
 * sentence by sentence as it is generated instead of all at once at the end, the
 * microphone stays open while it speaks so talking over it stops it mid-sentence, and
 * a turn the transcriber could not make out is met with silence and another chance
 * rather than an error.
 *
 * The microphone stream is acquired once and kept for the session. Re-requesting it
 * per turn cost half a second of dead air each time and, on iOS, sometimes dropped the
 * permission entirely.
 */
export function useVoiceConversation(options: VoiceConversationOptions) {
  const [status, setStatus] = useState<VoiceStatus>('connecting');
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live audio plumbing. All refs: these change many times a second and none of them
  // should cost a render.
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);
  const silenceAtRef = useRef<number | null>(null);
  const loudSinceRef = useRef<number | null>(null);
  const spokeRef = useRef(false);
  const noiseFloorRef = useRef(4);
  const calibrationRef = useRef<number[]>([]);
  const turnStartedRef = useRef(0);

  // Playback queue: sentences arrive while the reply is still being written, and have
  // to be played in the order they were generated.
  const playQueueRef = useRef<string[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const playingRef = useRef(false);
  const streamDoneRef = useRef(false);

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const mutedRef = useRef(false);
  const statusRef = useRef<VoiceStatus>('connecting');
  const turnRef = useRef(0);

  // beginListening starts a turn that ends in sendTurn, and sendTurn ends by calling
  // beginListening again. Holding each behind a ref keeps that cycle from either
  // capturing a stale copy of the other or forcing both to be rebuilt every render.
  const sendTurnRef = useRef<(blob: Blob) => void>(() => {});
  const drainQueueRef = useRef<() => void>(() => {});
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const setPhase = useCallback((next: VoiceStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  // ── Playback ─────────────────────────────────────────────────────────────
  const stopPlayback = useCallback(() => {
    playQueueRef.current = [];
    playingRef.current = false;
    const audio = currentAudioRef.current;
    if (audio) {
      try {
        audio.pause();
        audio.src = '';
      } catch {
        /* already gone */
      }
      currentAudioRef.current = null;
    }
  }, []);

  // ── Recording ────────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        /* already stopped */
      }
    }
  }, []);

  const beginListening = useCallback(() => {
    if (!mountedRef.current || mutedRef.current) return;
    const stream = streamRef.current;
    if (!stream) return;
    if (recorderRef.current && recorderRef.current.state === 'recording') return;

    chunksRef.current = [];
    spokeRef.current = false;
    silenceAtRef.current = null;
    calibrationRef.current = [];
    turnStartedRef.current = Date.now();

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, pickMimeType());
    } catch {
      setError('recorder');
      setPhase('error');
      return;
    }

    recorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      chunksRef.current = [];

      // Anything this small is a click or a breath, not a sentence. Listen again
      // rather than sending it and getting "no speech detected" back.
      if (!spokeRef.current || blob.size < 1200) {
        if (mountedRef.current && !mutedRef.current && statusRef.current === 'listening') {
          beginListening();
        }
        return;
      }
      sendTurnRef.current(blob);
    };

    recorder.start(120);
    setPhase('listening');
  }, [setPhase]);

  // ── One turn ─────────────────────────────────────────────────────────────
  /**
   * The half of a turn that is the same however the words arrived.
   *
   * Speech and typing differ only in how the sentence was captured; from there both
   * stream the same reply and hear it spoken back.
   */
  const runTurn = useCallback(
    async (userText: string, turn: number) => {
      const { conversationId, userLevel, onTurn, onVocab } = optionsRef.current;
      if (!conversationId) return;

      const abort = new AbortController();
      abortRef.current = abort;
      streamDoneRef.current = false;

      let reply = '';
      try {
        await streamAiTurn(
          { conversationId, text: userText, voice: true, userLevel, signal: abort.signal },
          {
            onDelta: (delta) => {
              if (turn !== turnRef.current) return;
              reply += delta;
            },
            onSentence: (_sentence, audioUrl) => {
              if (turn !== turnRef.current || !audioUrl) return;
              playQueueRef.current.push(audioUrl);
              drainQueueRef.current();
            },
            onVocab: (vocab) => onVocab?.(vocab),
            onDone: ({ text }) => {
              reply = text || reply;
            },
          }
        );
      } catch (err: any) {
        if (!mountedRef.current || turn !== turnRef.current) return;
        setError(err instanceof AiStreamError ? err.message : 'reply');
        setPhase('error');
        notifyHaptic('error');
        return;
      }

      streamDoneRef.current = true;
      if (!mountedRef.current || turn !== turnRef.current) return;

      onTurn(userText, reply);

      // No audio came back at all — the browser voice is the fallback, so the partner
      // is never silent just because synthesis was unavailable.
      if (!playingRef.current && !playQueueRef.current.length) {
        setPhase('speaking');
        speakWithBrowser(reply, () => {
          if (mountedRef.current && turn === turnRef.current) beginListening();
        });
      }
    },
    [beginListening, setPhase]
  );

  const sendTurn = useCallback(
    async (blob: Blob) => {
      if (!mountedRef.current) return;

      const turn = ++turnRef.current;
      setPhase('thinking');

      const base64 = await blobToBase64(blob);
      if (!base64 || !mountedRef.current || turn !== turnRef.current) return;

      let userText = '';
      try {
        const heard = await transcribeAiAudio({
          audioBase64: base64,
          audioMimeType: blob.type || 'audio/webm',
        });
        userText = (heard?.text || '').trim();
        if (heard?.wordsPerMinute > 0) optionsRef.current.onWpm?.(heard.wordsPerMinute);
      } catch {
        // Nothing intelligible. Say nothing and listen again — an error message for a
        // cough would be worse than silence.
        if (mountedRef.current && turn === turnRef.current) beginListening();
        return;
      }

      if (!userText || !mountedRef.current || turn !== turnRef.current) {
        if (mountedRef.current && turn === turnRef.current) beginListening();
        return;
      }

      await runTurn(userText, turn);
    },
    [beginListening, setPhase, runTurn]
  );

  /**
   * A turn typed instead of spoken.
   *
   * The reply still comes back as speech: this is for the times when saying it out
   * loud is not an option — a quiet room, a word the microphone keeps mishearing.
   */
  const sendTyped = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !mountedRef.current || statusRef.current === 'thinking') return;

      const turn = ++turnRef.current;
      stopRecording();
      stopPlayback();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();

      setError(null);
      setPhase('thinking');
      await runTurn(trimmed, turn);
    },
    [runTurn, setPhase, stopRecording, stopPlayback]
  );

  const drainQueue = useCallback(async () => {
    if (playingRef.current) return;
    playingRef.current = true;

    while (playQueueRef.current.length && mountedRef.current) {
      const src = playQueueRef.current.shift()!;
      setPhase('speaking');

      await new Promise<void>((resolve) => {
        const audio = new Audio(src);
        currentAudioRef.current = audio;
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.play().catch(() => resolve());
      });

      currentAudioRef.current = null;
    }

    playingRef.current = false;

    // Only hand the turn back once the reply has finished arriving. Draining an empty
    // queue mid-generation would start listening between two sentences.
    if (mountedRef.current && streamDoneRef.current && !playQueueRef.current.length) {
      if (!mutedRef.current) beginListening();
      else setPhase('muted');
    }
  }, [beginListening, setPhase]);

  sendTurnRef.current = (blob: Blob) => void sendTurn(blob);
  drainQueueRef.current = () => void drainQueue();

  // ── Microphone, once, for the whole session ──────────────────────────────
  const ready = Boolean(options.conversationId);

  useEffect(() => {
    if (!ready) return;

    mountedRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            // Without cancellation the microphone hears the partner through the
            // speaker and interrupts itself on every sentence.
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new Ctx();
        if (ctx.state === 'suspended') await ctx.resume();
        audioCtxRef.current = ctx;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        ctx.createMediaStreamSource(stream).connect(analyser);
        analyserRef.current = analyser;

        monitor();
        await openWithGreeting();
      } catch {
        if (!cancelled) {
          setError('mic');
          setPhase('error');
        }
      }
    })();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      turnRef.current += 1;
      abortRef.current?.abort();
      stopPlayback();
      stopRecording();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state !== 'closed') ctx.close().catch(() => {});
      audioCtxRef.current = null;
    };
    // Runs once, when the thread exists. Everything it needs is held in refs, and
    // re-running it would re-request the microphone mid-conversation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  /**
   * The partner speaks first.
   *
   * Arriving to silence puts the burden of opening on the learner, which is the
   * hardest moment of a speaking session. A failure here is not worth stopping for —
   * if the greeting cannot be synthesised, it just starts listening.
   */
  async function openWithGreeting() {
    const { greeting, onGreeting } = optionsRef.current;
    if (!greeting) {
      beginListening();
      return;
    }

    onGreeting?.(greeting);
    setPhase('speaking');

    try {
      const res = await getTTSAudio(greeting);
      if (!mountedRef.current) return;
      if (res?.ok && res?.audioUrl) {
        playQueueRef.current.push(res.audioUrl);
        streamDoneRef.current = true;
        drainQueueRef.current();
        return;
      }
    } catch {
      /* fall through to the browser voice */
    }

    if (!mountedRef.current) return;
    speakWithBrowser(greeting, () => {
      if (mountedRef.current) beginListening();
    });
  }

  /**
   * The one loop that watches the microphone.
   *
   * It does three jobs from the same reading — drives the orb, decides when a turn has
   * ended, and notices the user talking over the reply — because they all need the
   * same number and running three analysers would triple the cost for nothing.
   */
  function monitor() {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const bins = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      if (!mountedRef.current) return;
      analyser.getByteFrequencyData(bins);

      let sum = 0;
      for (let i = 0; i < bins.length; i++) sum += bins[i];
      const volume = sum / bins.length;

      // The first few frames of a turn measure the room, so the thresholds sit above
      // this particular room's noise rather than a number picked on a quiet laptop.
      if (calibrationRef.current.length < 12) {
        calibrationRef.current.push(volume);
        if (calibrationRef.current.length === 12) {
          const mean =
            calibrationRef.current.reduce((a, b) => a + b, 0) / calibrationRef.current.length;
          noiseFloorRef.current = Math.max(3, mean);
        }
      }

      const floor = noiseFloorRef.current;
      const speechAt = floor + 3.5;
      const silenceAt = floor + 1.5;
      const now = Date.now();

      optionsRef.current.onLevel?.(Math.min(1, Math.max(0, (volume - floor) / 28)));

      if (statusRef.current === 'listening') {
        if (volume > speechAt) {
          spokeRef.current = true;
          silenceAtRef.current = null;
        } else if (spokeRef.current && volume <= silenceAt) {
          if (silenceAtRef.current === null) silenceAtRef.current = now;
          else if (now - silenceAtRef.current >= END_OF_TURN_SILENCE_MS) stopRecording();
        }

        if (turnStartedRef.current && now - turnStartedRef.current > MAX_TURN_MS) {
          stopRecording();
        }
      } else if (statusRef.current === 'speaking' && !mutedRef.current) {
        // Barge-in. The bar is deliberately high: echo cancellation is not perfect,
        // and cutting the partner off because it heard itself is worse than making
        // someone speak up.
        if (volume > floor + 14) {
          if (loudSinceRef.current === null) loudSinceRef.current = now;
          else if (now - loudSinceRef.current >= BARGE_IN_MS) {
            loudSinceRef.current = null;
            tapHaptic('light');
            // Retiring the turn makes every callback still in flight for it a no-op,
            // so sentences generated after the interruption cannot start playing over
            // the person who just interrupted.
            turnRef.current += 1;
            abortRef.current?.abort();
            stopPlayback();
            if ('speechSynthesis' in window) window.speechSynthesis.cancel();
            beginListening();
          }
        } else {
          loudSinceRef.current = null;
        }
      } else {
        loudSinceRef.current = null;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    tick();
  }

  const toggleMute = useCallback(() => {
    tapHaptic('light');
    setMuted((was) => {
      const next = !was;
      mutedRef.current = next;

      if (next) {
        stopRecording();
        setPhase('muted');
      } else if (statusRef.current !== 'speaking' && statusRef.current !== 'thinking') {
        beginListening();
      }
      return next;
    });
  }, [beginListening, setPhase, stopRecording]);

  return { status, muted, error, toggleMute, sendTyped };
}

/** The first container this browser will actually record. Safari has neither webm option. */
function pickMimeType(): MediaRecorderOptions {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  for (const mimeType of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(mimeType)) {
      return { mimeType };
    }
  }
  return {};
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(blob);
  });
}

/** Last resort when server-side speech is unavailable, so the partner is never mute. */
function speakWithBrowser(text: string, onEnd: () => void) {
  if (!('speechSynthesis' in window) || !text.trim()) {
    onEnd();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.98;
  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  window.speechSynthesis.speak(utterance);
}

export default useVoiceConversation;
