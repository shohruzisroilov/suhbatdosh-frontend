import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowUp, MessageSquare, Mic, MicOff, X } from 'lucide-react';
import { transcribeAiAudio } from '../../api/endpoints';
import { streamAiTurn, AiStreamError } from '../../api/aiStream';
import { notifyHaptic, tapHaptic } from '../../utils/haptics';
import { useT } from '../../i18n';

export type VoiceStatus = 'connecting' | 'listening' | 'thinking' | 'speaking' | 'muted' | 'error';

interface AiVoiceModeProps {
  conversationId: string;
  userLevel?: string;
  onClose: () => void;
  /** Both halves of a finished turn, so the text transcript stays in step. */
  onTurn: (userText: string, aiText: string) => void;
  onVocab?: (vocab: { word: string; meaning: string; example: string }) => void;
  onTitle?: (title: string) => void;
  /** Words per minute for this turn, accumulated by the caller for the end screen. */
  onWpm?: (wpm: number) => void;
  /** Opens the saved conversations, without leaving the one in progress. */
  onOpenHistory?: () => void;
}

/** Silence this long after speech has started is taken as the end of a turn. */
const END_OF_TURN_SILENCE_MS = 850;
/** A single turn cannot run longer than this, however quiet the room is. */
const MAX_TURN_MS = 30_000;
/** Sustained speech over the partner's own voice before it stops and listens. */
const BARGE_IN_MS = 320;

/**
 * Full-screen spoken conversation.
 *
 * The partner listens continuously and decides for itself when a turn has ended, the
 * way the voice mode in ChatGPT does — there is no button to hold. Two things make
 * that work: the reply is spoken sentence by sentence as it is generated rather than
 * all at once at the end, and the microphone stays open while it speaks, so talking
 * over it stops it mid-sentence instead of queueing behind it.
 *
 * The microphone stream is acquired once and kept for the whole session. Re-requesting
 * it per turn cost half a second of dead air each time and, on iOS, occasionally
 * dropped the permission entirely.
 */
export default function AiVoiceMode({
  conversationId,
  userLevel,
  onClose,
  onTurn,
  onVocab,
  onTitle,
  onWpm,
  onOpenHistory,
}: AiVoiceModeProps) {
  const t = useT();
  const [status, setStatus] = useState<VoiceStatus>('connecting');
  const [muted, setMuted] = useState(false);
  const [userCaption, setUserCaption] = useState('');
  const [aiCaption, setAiCaption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState('');

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

  const orbRef = useRef<HTMLDivElement | null>(null);
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

  const setPhase = useCallback((next: VoiceStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

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
      setError(t('ai.voice.noRecorder'));
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

  // ── One spoken turn ──────────────────────────────────────────────────────
  /**
   * The half of a turn that is the same however the words arrived.
   *
   * Speech and typing differ only in how the sentence is captured; from there both
   * stream the same reply and hear it spoken back. Keeping one path means the typed
   * turn cannot quietly drift into behaving like the text chat.
   */
  const runTurn = useCallback(
    async (userText: string, turn: number) => {
      setUserCaption(userText);

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
              setAiCaption(reply);
            },
            onSentence: (_sentence, audioUrl) => {
              if (turn !== turnRef.current || !audioUrl) return;
              playQueueRef.current.push(audioUrl);
              drainQueueRef.current();
            },
            onVocab: (vocab) => onVocab?.(vocab),
            onTitle: (title) => onTitle?.(title),
            onDone: ({ text }) => {
              reply = text || reply;
            },
          }
        );
      } catch (err: any) {
        if (!mountedRef.current || turn !== turnRef.current) return;
        const message =
          err instanceof AiStreamError ? err.message : t('ai.voice.failed');
        setError(message);
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
        speakWithBrowser(reply, () => {
          if (mountedRef.current && turn === turnRef.current) beginListening();
        });
        setPhase('speaking');
      }
    },
    [conversationId, userLevel, onTurn, onVocab, onTitle, beginListening, setPhase, t]
  );

  const sendTurn = useCallback(
    async (blob: Blob) => {
      if (!mountedRef.current) return;

      const turn = ++turnRef.current;
      setPhase('thinking');
      setAiCaption('');
      setUserCaption('');

      const base64 = await blobToBase64(blob);
      if (!base64 || !mountedRef.current || turn !== turnRef.current) return;

      let userText = '';
      try {
        const heard = await transcribeAiAudio({
          audioBase64: base64,
          audioMimeType: blob.type || 'audio/webm',
        });
        userText = (heard?.text || '').trim();
        if (heard?.wordsPerMinute > 0) onWpm?.(heard.wordsPerMinute);
      } catch {
        // Nothing intelligible. Say nothing and go back to listening — an error
        // message for a cough would be worse than silence.
        if (mountedRef.current && turn === turnRef.current) beginListening();
        return;
      }

      if (!userText || !mountedRef.current || turn !== turnRef.current) {
        if (mountedRef.current && turn === turnRef.current) beginListening();
        return;
      }

      await runTurn(userText, turn);
    },
    [onWpm, beginListening, setPhase, runTurn]
  );

  /**
   * A turn typed instead of spoken.
   *
   * The reply still comes back as speech: this is for the times when saying it out
   * loud is not an option — a quiet room, a word the microphone keeps mishearing —
   * not a way out of the conversation.
   */
  const sendTyped = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !mountedRef.current) return;
      if (statusRef.current === 'thinking') return;

      const turn = ++turnRef.current;
      stopRecording();
      stopPlayback();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();

      setTyped('');
      setError(null);
      setPhase('thinking');
      setAiCaption('');
      setUserCaption('');

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

  // ── Microphone, once, for the whole session ──────────────────────────────
  useEffect(() => {
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
        beginListening();
      } catch {
        if (!cancelled) {
          setError(t('ai.voice.micDenied'));
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
    // Mount-only: everything it depends on is held in refs, and re-running it would
    // re-request the microphone mid-conversation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * The one loop that watches the microphone.
   *
   * It does three jobs from the same reading — draws the orb, decides when a turn has
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

      // Written to the element rather than to state: this runs on every animation
      // frame, and re-rendering the screen sixty times a second to move one shadow is
      // the kind of thing that makes a mid-range Android phone drop the audio.
      const loudness = Math.min(1, Math.max(0, (volume - floor) / 28));
      orbRef.current?.style.setProperty('--level', loudness.toFixed(2));

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

  function toggleMute() {
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
  }

  sendTurnRef.current = (blob: Blob) => void sendTurn(blob);
  drainQueueRef.current = () => void drainQueue();

  const label = t(`ai.voice.${status}`);

  return (
    <div className="vm">
      <div className="vm__stage">
      {/* ── Orb ─────────────────────────────────────────────────────────────
             One soft sphere, lit from inside. The clouds drifting within it are
             three blurred blobs clipped to the circle, and the whole thing
             breathes with the microphone — so the screen is doing something
             whether the partner is listening or talking, without a spinner or a
             progress bar ever appearing. */}
      <div ref={orbRef} className={`vm__orb vm__orb--${status}`}>
        <div className="vm__orb-sphere">
          <span className="vm__orb-blob vm__orb-blob--1" />
          <span className="vm__orb-blob vm__orb-blob--2" />
          <span className="vm__orb-blob vm__orb-blob--3" />
          <span className="vm__orb-sheen" />
        </div>
      </div>

      {/* ── State ── */}
      <span className={`pill vm__pill vm__pill--${status}`}>
        {(status === 'listening' || status === 'speaking') && <span className="dot-live" />}
        {label}
      </span>

      {/* ── What was said ── */}
      <div className="vm__captions">
        {error ? (
          <div className="vm__error card">
            <span className="vm__error-ico"><AlertCircle size={17} /></span>
            <span>{error}</span>
          </div>
        ) : (
          <>
            {userCaption && (
              <div className="vm__said">
                <span className="eyebrow">{t('ai.voice.youSaid')}</span>
                <p className="vm__said-text">{userCaption}</p>
              </div>
            )}
            {aiCaption && <p className="vm__reply">{aiCaption}</p>}
            {!userCaption && !aiCaption && status === 'listening' && (
              <p className="vm__hint">{t('ai.voice.hint')}</p>
            )}
          </>
        )}
      </div>

      </div>

      {/* ── Control bar ─────────────────────────────────────────────────────
             Everything for the conversation on one row: the saved threads, a way
             to type a turn when saying it out loud is not an option, the
             microphone, and the way out. */}
      <div className="vm__bar">
        {onOpenHistory && (
          <button
            type="button"
            className="vm__bar-btn"
            onClick={() => {
              tapHaptic('light');
              onOpenHistory();
            }}
            aria-label={t('ai.chats')}
          >
            <MessageSquare size={19} />
          </button>
        )}

        <input
          className="vm__type"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void sendTyped(typed);
            }
          }}
          placeholder={t('ai.voice.type')}
          maxLength={2000}
          aria-label={t('ai.voice.type')}
        />

        {typed.trim() ? (
          <button
            type="button"
            className="vm__bar-btn vm__bar-btn--send"
            onClick={() => void sendTyped(typed)}
            aria-label="Send"
          >
            <ArrowUp size={19} strokeWidth={2.5} />
          </button>
        ) : (
          <button
            type="button"
            className={`vm__bar-btn${muted ? ' vm__bar-btn--off' : ''}${
              status === 'listening' ? ' vm__bar-btn--live' : ''
            }`}
            onClick={toggleMute}
            aria-label={muted ? t('cc.unmute') : t('cc.mute')}
          >
            {muted ? <MicOff size={19} /> : <Mic size={19} />}
          </button>
        )}

        <button
          type="button"
          className="vm__bar-btn vm__bar-btn--end"
          onClick={() => {
            tapHaptic('medium');
            onClose();
          }}
          aria-label={t('ai.voice.done')}
        >
          <X size={19} strokeWidth={2.4} />
        </button>
      </div>

      <style>{`
        .vm {
          position: fixed; inset: 0; z-index: 120;
          display: flex; flex-direction: column; align-items: center;
          padding: calc(var(--space-5) + env(safe-area-inset-top, 0px)) var(--space-4)
                   calc(var(--space-4) + env(safe-area-inset-bottom, 0px));
          background: var(--bg);
          animation: fadeIn 0.24s ease;
        }

        .vm__stage {
          flex: 1; min-height: 0; width: 100%;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: var(--space-4);
        }

        /* ── Orb ──
           The edge stays crisp: the blobs are blurred, not the sphere, and
           overflow plus a mask keeps their haze inside the circle on both
           engines. */
        .vm__orb {
          position: relative; flex-shrink: 0;
          width: min(62vw, 232px); aspect-ratio: 1;
          /* --level is written straight from the microphone analyser on every
             animation frame, so the sphere swells as the room gets louder. */
          transform: scale(calc(1 + var(--level, 0) * 0.09));
          transition: transform 110ms linear;
        }
        .vm__orb-sphere {
          position: absolute; inset: 0;
          border-radius: 50%; overflow: hidden; isolation: isolate;
          background:
            radial-gradient(circle at 32% 72%, #FFFFFF 0%, #E8F3FF 26%, transparent 62%),
            linear-gradient(150deg, #7FA8FF 0%, #4E7FE8 42%, #2E5BD0 100%);
          -webkit-mask-image: radial-gradient(circle at center, #000 99%, transparent 100%);
                  mask-image: radial-gradient(circle at center, #000 99%, transparent 100%);
          box-shadow: 0 24px 80px rgba(78, 127, 232, 0.30);
          animation: vmBreathe 7s ease-in-out infinite;
        }
        @keyframes vmBreathe {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.035); }
        }

        .vm__orb-blob {
          position: absolute; border-radius: 50%;
          filter: blur(26px); will-change: transform;
        }
        .vm__orb-blob--1 {
          width: 78%; height: 78%; top: -14%; right: -10%;
          background: radial-gradient(circle, rgba(124, 158, 255, 0.95) 0%, rgba(124, 158, 255, 0) 68%);
          animation: vmDrift1 11s ease-in-out infinite;
        }
        .vm__orb-blob--2 {
          width: 70%; height: 70%; bottom: -8%; left: -12%;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0) 66%);
          animation: vmDrift2 9s ease-in-out infinite;
        }
        .vm__orb-blob--3 {
          width: 54%; height: 54%; top: 30%; left: 26%;
          background: radial-gradient(circle, rgba(0, 198, 255, 0.34) 0%, rgba(0, 198, 255, 0) 70%);
          animation: vmDrift3 13s ease-in-out infinite;
        }
        @keyframes vmDrift1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(-14%, 12%) scale(1.14); }
        }
        @keyframes vmDrift2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(16%, -14%) scale(0.9); }
        }
        @keyframes vmDrift3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%      { transform: translate(12%, -10%) scale(1.2); }
          66%      { transform: translate(-10%, 8%) scale(0.88); }
        }

        /* A single highlight across the top, which is what reads as "sphere"
           rather than "flat disc". */
        .vm__orb-sheen {
          position: absolute; inset: 0;
          background: radial-gradient(ellipse 70% 46% at 46% 14%, rgba(255,255,255,0.42) 0%, transparent 70%);
        }

        /* States. The orb never stops moving entirely — a frozen sphere reads as
           a crash — but each state moves differently enough to be told apart. */
        .vm__orb--listening .vm__orb-sphere { animation-duration: 4.5s; }
        .vm__orb--speaking .vm__orb-sphere  { animation-duration: 1.9s; }
        .vm__orb--speaking .vm__orb-blob--1 { animation-duration: 4s; }
        .vm__orb--speaking .vm__orb-blob--2 { animation-duration: 3.2s; }
        .vm__orb--speaking .vm__orb-blob--3 { animation-duration: 4.6s; }
        .vm__orb--thinking .vm__orb-sphere  { animation-duration: 2.6s; opacity: 0.72; }
        .vm__orb--connecting .vm__orb-sphere { opacity: 0.6; }
        .vm__orb--muted .vm__orb-sphere,
        .vm__orb--error .vm__orb-sphere {
          background: linear-gradient(150deg, #2A3446 0%, #1A2232 100%);
          box-shadow: none;
        }
        .vm__orb--muted .vm__orb-blob,
        .vm__orb--error .vm__orb-blob,
        .vm__orb--muted .vm__orb-sheen,
        .vm__orb--error .vm__orb-sheen { opacity: 0.12; }

        @media (prefers-reduced-motion: reduce) {
          .vm__orb-sphere, .vm__orb-blob { animation: none; }
        }

        /* ── State pill ── */
        .vm__pill { font-size: var(--text-sm); }
        .vm__pill--listening { background: var(--success-bg); color: var(--success); }
        .vm__pill--speaking  { background: var(--btn-bg-soft); color: var(--btn-bg); }
        .vm__pill--thinking  { background: var(--warning-bg); color: var(--warning); }
        .vm__pill--error     { background: var(--danger-bg);  color: var(--danger); }

        /* ── Captions ── */
        .vm__captions {
          flex: 0 1 auto; width: 100%; max-width: 420px;
          min-height: 116px; max-height: 32vh; overflow-y: auto;
          display: flex; flex-direction: column; gap: var(--space-3);
          text-align: center;
        }
        .vm__said { display: flex; flex-direction: column; gap: var(--space-1); align-items: center; }
        .vm__said-text {
          font-size: var(--text-sm); line-height: 1.5;
          color: var(--text-tertiary); margin: 0;
        }
        .vm__reply {
          font-size: var(--text-md); line-height: 1.5; margin: 0;
          font-weight: var(--weight-medium); color: var(--text-primary);
        }
        .vm__hint { font-size: var(--text-sm); color: var(--text-tertiary); margin: 0; }
        .vm__error {
          display: flex; align-items: center; gap: var(--space-3);
          text-align: left; border-color: rgba(255, 69, 58, 0.35);
          font-size: var(--text-sm); line-height: 1.5; color: var(--text-secondary);
        }
        .vm__error-ico {
          width: 34px; height: 34px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          border-radius: var(--radius-sm);
          background: var(--danger-bg); color: var(--danger);
        }

        /* ── Control bar ── */
        .vm__bar {
          display: flex; align-items: center; gap: var(--space-2);
          width: 100%; max-width: 520px;
          padding: var(--space-2);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border);
          background: var(--bg-secondary);
          box-shadow: var(--shadow-md);
        }
        .vm__type {
          flex: 1; min-width: 0;
          height: 44px; padding: 0 var(--space-3);
          background: transparent; color: var(--text-primary);
          font-family: inherit; font-size: var(--text-base);
          border: none; outline: none;
        }
        .vm__type::placeholder { color: var(--text-tertiary); }

        .vm__bar-btn {
          width: 44px; height: 44px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          border-radius: var(--radius-md);
          background: var(--surface-2); color: var(--text-secondary);
          transition: transform 0.14s var(--ease-out), background var(--t), color var(--t);
        }
        .vm__bar-btn:active { transform: scale(0.93); }
        .vm__bar-btn--live { background: var(--success-bg); color: var(--success); }
        .vm__bar-btn--off  { background: var(--surface-3); color: var(--text-tertiary); }
        .vm__bar-btn--send {
          background: var(--grad-primary); color: var(--btn-text);
          box-shadow: 0 4px 16px rgba(0, 168, 255, 0.35);
        }
        .vm__bar-btn--end { background: var(--danger-bg); color: var(--danger); }
      `}</style>
    </div>
  );
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
