import { useState, useEffect, useRef } from 'react';
import { useT } from '../i18n';
import useAppStore from '../store/useAppStore';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';
import {
  getIeltsStatus,
  startIeltsTest,
  getIeltsTest,
  sendIeltsAnswer,
  finishIeltsTest,
  abandonIeltsTest,
  getTTSAudio,
} from '../api/endpoints';
import { tapHaptic, notifyHaptic } from '../utils/haptics';
import { pickExaminerVoice, whenVoicesReady, type ExaminerGender } from '../utils/examinerVoice';
import { describeAnswerError } from '../utils/answerError';
import { MockHeader, MockIntroCard, MockLoading, type MockBusyAction } from '../components/MockIntro';
import { AlertCircle, AlertTriangle, ArrowLeft, Award, BookOpen, CheckCircle2, ChevronRight, Clock, Lightbulb, Mic, Mic2, MicOff, RotateCcw, Sparkles, ThumbsUp, Volume2, VolumeX } from 'lucide-react';

/** Uploads per answer. Each one carries the recording, so this stays small. */
const ANSWER_SEND_ATTEMPTS = 2;

/**
 * Whether a failed send is worth repeating. A dropped connection or a server fault may
 * well succeed next time; a request the server actively refused will be refused again,
 * so repeating it only makes the candidate wait longer for the same message.
 */
function isRetriableSendError(err: any): boolean {
  const status = err?.response?.status;
  if (!status) return true; // No reply at all: timeout, or the connection went away.
  return status >= 500;
}

/** The resync is a few hundred bytes; it must not wait as long as an upload. */
const RESYNC_TIMEOUT_MS = 8_000;

interface ScriptStep {
  i: number;
  part: number;
  kind: 'frame' | 'question' | 'cue' | 'rounding' | 'closing';
  say: string;
  cardSay?: string;
  card?: { cue: string; bullets: string[] } | null;
  startSay?: string;
  prepSec?: number;
  maxSec: number;
}

interface TestFeedback {
  overall: string;
  fluency: { band: string; comment: string };
  lexical: { band: string; comment: string };
  grammar: { band: string; comment: string };
  pronunciation: { band: string; comment: string };
  partNotes?: { part1: string; part2: string; part3: string };
  strengths?: string[];
  weaknesses?: string[];
  fixes?: Array<{ said: string; better: string; why: string }>;
  /** A list. Results marked before that change hold one paragraph. */
  advice?: string | string[];
}

/** Whatever shape a stored result used, as a list. */
function asList(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  const text = String(value || '').trim();
  return text ? [text] : [];
}

/** Wraps a callback so that whichever of several racing paths arrives first wins. */
function once(fn: () => void): () => void {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    fn();
  };
}

/**
 * The longest the examiner's line could plausibly take, counting the round trip that
 * fetches the voice as well as the speaking.
 *
 * This is the backstop behind every wait on speech, and it errs long on purpose:
 * firing late costs a pause, while firing early opens the microphone over the
 * examiner mid-sentence. It is only ever reached when speech fails to report back
 * at all, so the slack costs nothing in a normal test.
 */
function speechCeilingMs(text: string): number {
  const chars = String(text || '').length;
  return Math.min(8000 + chars * 120, 60000);
}

/** What the examiner says when the answer has run to its limit. */
const CUT_OFF_LINE = 'Thank you.';

export default function IeltsMock() {
  const t = useT();
  const { navigate, user } = useAppStore();

  useTelegramBackButton(() => navigate('mock'));

  // Status & Quota
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [status, setStatus] = useState<{
    enabled: boolean;
    remaining: number;
    limit: number;
    lifetime: boolean;
    isPremium: boolean;
    active: string | null;
  } | null>(null);

  // Active Test State
  const [testId, setTestId] = useState<string | null>(null);
  // Which voice the browser fallback should read the examiner's lines in.
  const examinerGenderRef = useRef<ExaminerGender>('female');

  // The browser populates its voice list asynchronously and reports none on the first
  // call. Warm it on mount so the fallback has real voices to choose from if it fires.
  useEffect(() => {
    whenVoicesReady(() => {});
  }, []);
  const [currentStep, setCurrentStep] = useState<ScriptStep | null>(null);
  // Off by default: the real test gives you no written question outside Part 2.
  const [showTranscript, setShowTranscript] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');
  const [totalSteps, setTotalSteps] = useState<number>(0);
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(0);
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'grading' | 'results'>('idle');

  // Part 2 Prep Timer State
  const [prepTimeLeft, setPrepTimeLeft] = useState<number>(60);
  const [isPrepping, setIsPrepping] = useState<boolean>(false);
  const prepTimerRef = useRef<any>(null);

  // Recording State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingMs, setRecordingMs] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);
  const recordingStartTimeRef = useRef<number>(0);

  // TTS Voice Examiner
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // Grading & Feedback State
  const [feedback, setFeedback] = useState<TestFeedback | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittingAnswer, setSubmittingAnswer] = useState<boolean>(false);
  // An answer that failed to reach the server is held, not lost: the recording is
  // still in hand, so the candidate is offered the send again rather than the test
  // stalling on an error box with nothing to tap.
  const [answerFailed, setAnswerFailed] = useState<boolean>(false);
  const [gradingFailed, setGradingFailed] = useState<boolean>(false);

  // Which start-screen button is mid-flight, so it can say so instead of sitting
  // there looking untapped.
  const [busyAction, setBusyAction] = useState<MockBusyAction>(null);

  useEffect(() => {
    fetchStatus();
    return () => {
      stopRecordingSilently();
      stopPrepTimer();
      stopSpeech();
      releaseStream();
    };
  }, []);

  const fetchStatus = async () => {
    setLoadingStatus(true);
    setErrorMsg(null);
    try {
      const data = await getIeltsStatus();
      setStatus(data);
      // An unfinished test is offered, never resumed on its own. Resuming reopens the
      // microphone, and a browser only grants that off a tap — dropping someone
      // straight back into a test on load meant a dead mic and no way to bail out.
      applyTestId(data.active);
    } catch (err: any) {
      console.error('Failed to load IELTS status', err);
      setStatus(null);
      setErrorMsg(t('mock.statusFailed'));
    } finally {
      setLoadingStatus(false);
    }
  };

  // One tap, one test. A double tap used to fire two start requests: the server hands
  // back the same test both times, but the client then ran its opening step twice —
  // two examiner voices over each other and two recorders fighting for the mic. The
  // ref closes the window between the taps that state alone would leave open.
  const actionLockRef = useRef(false);

  const runAction = async (name: Exclude<MockBusyAction, null>, fn: () => Promise<void>) => {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    setBusyAction(name);
    try {
      await fn();
    } finally {
      actionLockRef.current = false;
      if (mountedRef.current) setBusyAction(null);
    }
  };

  /**
   * The microphone is asked for here, on the tap, rather than when the first question
   * finishes being read out. Browsers only grant it in response to a gesture, and by
   * the time the examiner has finished speaking that gesture has expired — which is
   * how a test could open, greet the candidate, and then fail to record a word.
   */
  const claimMicrophone = async (): Promise<boolean> => {
    try {
      await ensureStream();
      return true;
    } catch (err) {
      console.error('Mic access error:', err);
      setErrorMsg('No microphone access. Allow the microphone in your browser settings to take the test.');
      return false;
    }
  };

  const loadActiveTest = (id: string) =>
    runAction('resume', async () => {
      tapHaptic('medium');
      setErrorMsg(null);
      if (!(await claimMicrophone())) return;
      try {
        const data = await getIeltsTest(id);
        if (data.examinerGender) examinerGenderRef.current = data.examinerGender;
        if (data.status === 'active' && data.step) {
          applyTestId(id);
          setTotalSteps(data.total || 0);
          setEstimatedMinutes(data.estimatedMinutes || 0);
          applyStep(data.step);
          setTestStatus('testing');
          beginStep(data.step);
        } else if (data.feedback) {
          setFeedback(data.feedback);
          setTestStatus('results');
        }
      } catch (err: any) {
        console.error('Failed to load active test', err);
        setErrorMsg(err.response?.data?.error || 'Could not open the test. Please try again.');
      }
    });

  const handleStartTest = () =>
    runAction('start', async () => {
      tapHaptic('medium');
      setErrorMsg(null);
      if (!(await claimMicrophone())) return;
      try {
        const data = await startIeltsTest({ mode: 'full' });
        if (data.examinerGender) examinerGenderRef.current = data.examinerGender;
        applyTestId(data.testId);
        setTotalSteps(data.total || 0);
        setEstimatedMinutes(data.estimatedMinutes || 0);
        applyStep(data.step);
        setTestStatus('testing');
        beginStep(data.step);
      } catch (err: any) {
        console.error('Failed to start test', err);
        // The server may well have created the test before this request gave up, so
        // look again rather than leaving a started test invisible behind an error.
        void fetchStatus();
        const msg = err.response?.data?.error || 'Could not start the test. Please try again.';
        setErrorMsg(msg);
      }
    });

  const handleAbandon = () => {
    if (!testId) return;
    haltStepMachine();
    return runAction('discard', async () => {
      tapHaptic('light');
      try {
        await abandonIeltsTest(testId);
      } catch (err) {}
      applyTestId(null);
      applyStep(null);
      pendingAnswerRef.current = null;
      setAnswerFailed(false);
      releaseStream();
      setTestStatus('idle');
      await fetchStatus();
    });
  };

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechTokenRef = useRef(0);

  // Mirrors of state that the async speech callbacks read: they fire long after the
  // render that scheduled them, so the captured state value would be stale.
  const mountedRef = useRef(true);
  const isRecordingRef = useRef(false);
  const isPreppingRef = useRef(false);

  /**
   * The test drives itself from timers and speech callbacks, all of which were
   * scheduled by an earlier render. Anything they read out of `useState` is the value
   * from that render, not the value now — which is why the recorder used to be given
   * the previous question's time limit, why the automatic cut-off at the limit tested
   * a stale `isRecording` and never fired, and why an answer could be posted against
   * the wrong step index. The live values live in refs; the state exists to draw.
   */
  const currentStepRef = useRef<ScriptStep | null>(null);
  const testIdRef = useRef<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const submitLockRef = useRef(false);
  const stepTokenRef = useRef(0);
  /** The recording behind a failed send, kept so it can be sent again. */
  const pendingAnswerRef = useRef<{ blob: Blob | null; ms: number } | null>(null);

  /**
   * Cancels the step in flight.
   *
   * Every step schedules a backstop timer that opens the microphone if the examiner's
   * voice never reports back. Leaving a test does not cancel that timer, so without
   * retiring the step token an abandoned test would reach across and start recording
   * on the screen the candidate had just walked back to.
   */
  const haltStepMachine = () => {
    stepTokenRef.current += 1;
    stopSpeech();
    stopRecordingSilently();
    stopPrepTimer();
  };

  const applyStep = (step: ScriptStep | null) => {
    currentStepRef.current = step;
    setCurrentStep(step);
    if (step) setStepIndex(step.i);
  };

  const applyTestId = (id: string | null) => {
    testIdRef.current = id;
    setTestId(id);
  };

  /**
   * One live microphone for the whole test.
   *
   * Every question used to open its own stream. On a phone that is a fresh permission
   * check and a fresh device negotiation between each answer — a few hundred
   * milliseconds of dead air at best, and an intermittent failure at worst, several
   * questions into a test the candidate cannot restart.
   */
  const ensureStream = async (): Promise<MediaStream> => {
    const live = streamRef.current;
    if (live && live.getAudioTracks().some((track) => track.readyState === 'live')) return live;

    live?.getTracks().forEach((track) => track.stop());
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    streamRef.current = stream;
    return stream;
  };

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Speech synthesis for AI Examiner voice (High Quality AI Voice TTS with Web Speech API fallback)
  const speakText = async (text?: string, onDone?: () => void) => {
    if (!text) {
      onDone?.();
      return;
    }
    // With sound off or unmounted there is nothing to wait for, so hand control straight back.
    if (!soundEnabled || !mountedRef.current) {
      onDone?.();
      return;
    }
    stopSpeech();
    speechTokenRef.current += 1;
    const token = speechTokenRef.current;

    try {
      const res = await getTTSAudio(text, 'examiner');
      if (!mountedRef.current || token !== speechTokenRef.current || !soundEnabled) return;
      if (res?.ok && res?.audioUrl) {
        const audio = new Audio(res.audioUrl);
        audioRef.current = audio;
        audio.onplay = () => {
          if (token === speechTokenRef.current && mountedRef.current) setIsSpeaking(true);
        };
        audio.onended = () => {
          audioRef.current = null;
          if (token === speechTokenRef.current && mountedRef.current) {
            setIsSpeaking(false);
            onDone?.();
          }
        };
        audio.onerror = () => {
          audioRef.current = null;
          if (token === speechTokenRef.current && mountedRef.current) {
            setIsSpeaking(false);
            fallbackSpeech(text, onDone, token);
          }
        };
        await audio.play();
        return;
      }
      fallbackSpeech(text, onDone, token);
    } catch {
      fallbackSpeech(text, onDone, token);
    }
  };

  const fallbackSpeech = (text: string, onDone?: () => void, token?: number) => {
    if (!soundEnabled || !text || !mountedRef.current || (token !== undefined && token !== speechTokenRef.current) || !('speechSynthesis' in window)) {
      onDone?.();
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      // Without this the browser reads the examiner in whatever voice the device
      // lists first, which is usually male — wrong for an examiner named Sarah.
      const preferred = pickExaminerVoice(examinerGenderRef.current, 'en-US');
      if (preferred) utterance.voice = preferred;
      utterance.rate = 0.95;
      utterance.onstart = () => {
        if (!token || token === speechTokenRef.current) setIsSpeaking(true);
      };
      utterance.onend = () => {
        if (!token || token === speechTokenRef.current) {
          setIsSpeaking(false);
          onDone?.();
        }
      };
      utterance.onerror = () => {
        if (!token || token === speechTokenRef.current) {
          setIsSpeaking(false);
          onDone?.();
        }
      };
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
      onDone?.();
    }
  };

  const stopSpeech = () => {
    speechTokenRef.current += 1;
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.src = '';
        audioRef.current.load();
      } catch {}
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  // ── Recording Logic ──
  const startRecording = async (step: ScriptStep) => {
    if (isRecordingRef.current || !mountedRef.current) return;
    stopSpeech();
    tapHaptic('medium');
    setErrorMsg(null);
    try {
      const stream = await ensureStream();
      if (!mountedRef.current) return;
      audioChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/aac';

      // Speech, not music. Left to itself the browser picks a music-grade bitrate —
      // on iOS that is AAC at around 128 kbps, which turns a two-minute Part 2 answer
      // into nearly 2 MB and takes longer to upload over a weak mobile connection than
      // the request is allowed to wait. 32 kbps mono is well above what the
      // transcription models need and cuts the upload about fourfold.
      const AUDIO_BITS_PER_SECOND = 32_000;
      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
      });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start(100);
      setIsRecording(true);
      isRecordingRef.current = true;
      recordingStartTimeRef.current = Date.now();
      setRecordingMs(0);

      // The limit belongs to the step being answered, which the caller hands in. Read
      // off `currentStep` it was whatever the previous render held.
      const maxMs = Math.max(step.maxSec || 60, 5) * 1000;
      recordTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - recordingStartTimeRef.current;
        setRecordingMs(elapsed);
        if (elapsed >= maxMs) {
          clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
          // A real examiner cuts you off out loud rather than the recording just
          // stopping. The line is said inside, once the recorder is closed: spoken
          // first it would have been recorded, and the marker would have read the
          // examiner's words back as the candidate's.
          void stopRecordingAndSend({ announce: true });
        }
      }, 200);
    } catch (err: any) {
      console.error('Mic access error:', err);
      setErrorMsg('No microphone access. Allow the microphone in your settings to take the test.');
    }
  };

  const stopRecordingAndSend = async (options?: { announce?: boolean }) => {
    const step = currentStepRef.current;
    const recorder = mediaRecorderRef.current;
    // Guarded on the refs, not on state: the automatic cut-off runs from a timer whose
    // captured `isRecording` is always the value from before recording started, so the
    // old state check turned the cut-off into a no-op and a silent candidate waited
    // for an examiner who never came back.
    if (!recorder || !isRecordingRef.current || submitLockRef.current || !step) return;

    submitLockRef.current = true;
    tapHaptic('medium');
    stopSpeech();

    const duration = Date.now() - recordingStartTimeRef.current;
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setIsRecording(false);
    isRecordingRef.current = false;
    setSubmittingAnswer(true);

    await new Promise<void>((resolve) => {
      // A recorder that never reports back would strand the test here forever, so the
      // wait is bounded — whatever chunks arrived are what gets sent. The stream stays
      // open; it belongs to the test, not to this one recording.
      const done = once(resolve);
      recorder.onstop = done;
      try {
        recorder.stop();
      } catch {
        done();
      }
      window.setTimeout(done, 2500);
    });

    const blob = new Blob(audioChunksRef.current, {
      type: recorder.mimeType || 'audio/webm',
    });
    audioChunksRef.current = [];
    mediaRecorderRef.current = null;
    submitLockRef.current = false;

    // Not awaited: the acknowledgement plays over the upload, which is exactly the
    // dead air it is there to cover.
    if (options?.announce) void speakText(CUT_OFF_LINE);

    await submitAnswer(blob, duration);
  };

  const stopRecordingSilently = () => {
    if (mediaRecorderRef.current && isRecordingRef.current) {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    mediaRecorderRef.current = null;
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setIsRecording(false);
    isRecordingRef.current = false;
  };

  /**
   * Picks the test back up from the server's own record of it.
   *
   * The server writes the answer and advances the step before it composes its reply,
   * so a reply that never arrives does not mean a lost answer — it usually means the
   * test has already moved on without the candidate being told. Returns true when the
   * test could be resumed, false when the caller should surface the error instead.
   */
  const resumeFromServer = async (id: string, sentStep: number): Promise<boolean> => {
    try {
      const data = await getIeltsTest(id, RESYNC_TIMEOUT_MS);
      if (!mountedRef.current) return false;

      if (data.status === 'active' && data.step) {
        // A step past the one just sent means the answer did land.
        if (data.step.i <= sentStep) return false;
        pendingAnswerRef.current = null;
        setSubmittingAnswer(false);
        setErrorMsg(null);
        setRecordingMs(0);
        applyStep(data.step);
        beginStep(data.step);
        return true;
      }

      // The last answer was the last question: the test is over, so mark it.
      pendingAnswerRef.current = null;
      setSubmittingAnswer(false);
      void finishTestGrading();
      return true;
    } catch (err) {
      console.error('Could not resync the test:', err);
      return false;
    }
  };

  const submitAnswer = async (blob: Blob | null, durationMs: number, attempt = 1) => {
    const step = currentStepRef.current;
    const id = testIdRef.current;
    if (!id || !step) return;

    // Held until the server confirms, so a failed send can be repeated with the same
    // recording instead of costing the candidate the answer.
    pendingAnswerRef.current = { blob, ms: durationMs };
    setErrorMsg(null);
    setAnswerFailed(false);
    setSubmittingAnswer(true);

    try {
      const res = await sendIeltsAnswer(id, step.i, blob, durationMs);
      if (!mountedRef.current) return;
      pendingAnswerRef.current = null;
      setSubmittingAnswer(false);

      if (res.done) {
        void finishTestGrading();
        return;
      }

      if (res.step) {
        setRecordingMs(0);
        applyStep(res.step);
        // This is the line the whole test turned on. It used to speak the next
        // question and stop there — no prep timer, no microphone, no way forward — so
        // every test froze on the examiner's second question. Running the step is what
        // opens the microphone again.
        beginStep(res.step);
        return;
      }

      // No next step and not done is not a state the server should produce; marking
      // is still the right move, and beats sitting on a screen with nothing to tap.
      void finishTestGrading();
    } catch (err: any) {
      if (!mountedRef.current) return;
      console.error(`Failed to submit answer (attempt ${attempt}):`, err);

      // Ask where the test stands before re-sending anything. The server records the
      // answer and advances the step before it composes its reply, so the usual
      // failure here is a reply lost on the way back — one cheap request settles that
      // without pushing the whole recording up a connection that just dropped it.
      if (await resumeFromServer(id, step.i)) return;

      // The answer really did not land. Sending the same step again is safe: the row
      // is written once, and a step the server has already passed comes back as the
      // current one rather than a second recording.
      if (isRetriableSendError(err) && attempt < ANSWER_SEND_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
        if (!mountedRef.current) return;
        return submitAnswer(blob, durationMs, attempt + 1);
      }

      setSubmittingAnswer(false);
      setErrorMsg(describeAnswerError(err));
      setAnswerFailed(true);
    }
  };

  const retryAnswer = () => {
    const pending = pendingAnswerRef.current;
    if (!pending) return;
    tapHaptic('medium');
    setAnswerFailed(false);
    void submitAnswer(pending.blob, pending.ms);
  };

  const skipAnswer = () => {
    tapHaptic('light');
    pendingAnswerRef.current = null;
    setAnswerFailed(false);
    void submitAnswer(null, 0);
  };

  const handleNextFrame = async () => {
    await submitAnswer(null, 0);
  };

  /**
   * Runs a step the way an examiner would: speak, then wait for the candidate.
   *
   * Every answer used to need a "start recording" tap first, which meant unlimited
   * silent thinking time before the clock began and no conversational rhythm at all.
   * The microphone now opens as soon as the examiner stops talking.
   */
  const beginStep = (step: ScriptStep) => {
    stepTokenRef.current += 1;
    const token = stepTokenRef.current;
    const spoken = step.say || step.cardSay || '';

    // A later step, or leaving the test, retires this one's turn.
    const current = () => mountedRef.current && token === stepTokenRef.current;

    const proceed = once(() => {
      if (!current()) return;

      if (step.kind === 'cue') {
        // The card is on screen; the preparation minute starts by itself.
        startPrepTimer(step);
        return;
      }
      if (step.kind === 'frame' || step.kind === 'closing') {
        // Examiner framing needs no answer — move on rather than waiting for a tap.
        window.setTimeout(() => { if (current()) void handleNextFrame(); }, 700);
        return;
      }
      // A short beat, then the microphone opens.
      window.setTimeout(() => { if (current()) void startRecording(step); }, 400);
    });

    speakText(spoken, proceed);

    // The test must not depend on the voice reporting back. Autoplay policy can
    // refuse the audio outright, a tapped Repeat cancels the utterance that was going
    // to call back, and a webview can simply drop the event — each of which used to
    // leave the candidate on a silent screen with no microphone and no way on.
    window.setTimeout(proceed, speechCeilingMs(spoken));
  };

  /**
   * Asking the examiner to repeat is allowed in the real test — and must not strand it.
   *
   * The microphone is already open by the time anyone thinks to ask, so the part-answer
   * is thrown away and the clock restarted. Speaking the question over a live recording
   * would otherwise put the examiner's own words into the candidate's transcript and
   * mark them for saying them.
   */
  const repeatQuestion = () => {
    const step = currentStepRef.current;
    if (!step || submitLockRef.current) return;
    tapHaptic('light');

    const wasRecording = isRecordingRef.current;
    if (wasRecording) stopRecordingSilently();

    const token = stepTokenRef.current;
    const spoken = step.say || step.cardSay || '';
    const resume = once(() => {
      if (!mountedRef.current || token !== stepTokenRef.current || isPreppingRef.current) return;
      const answerable = step.kind === 'question' || step.kind === 'rounding' || step.kind === 'cue';
      if (wasRecording && answerable) void startRecording(step);
    });

    speakText(spoken, resume);
    window.setTimeout(resume, speechCeilingMs(spoken));
  };

  // ── Part 2 Cue Card Timer ──
  const startPrepTimer = (step: ScriptStep) => {
    if (isPreppingRef.current) return;
    // Leaving the test mid-preparation must not let the start line reach across and
    // open the microphone on the screen the candidate walked back to.
    const token = stepTokenRef.current;
    const total = Math.max(step.prepSec || 60, 5);
    // Counted against a deadline rather than by decrementing: a phone that throttles
    // timers in the background used to hand back more preparation than the test allows.
    const endsAt = Date.now() + total * 1000;

    setIsPrepping(true);
    isPreppingRef.current = true;
    setPrepTimeLeft(total);

    const begin = once(() => {
      if (!mountedRef.current || token !== stepTokenRef.current) return;
      void startRecording(step);
    });

    prepTimerRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setPrepTimeLeft(left);
      if (left > 0) return;

      stopPrepTimer();
      notifyHaptic('success');
      if (step.startSay) {
        speakText(step.startSay, begin);
        window.setTimeout(begin, speechCeilingMs(step.startSay));
      } else {
        begin();
      }
    }, 250);
  };

  /** Lets a candidate who has finished their notes start early instead of waiting out the clock. */
  const skipPrep = () => {
    const step = currentStepRef.current;
    if (!step || !isPreppingRef.current) return;
    tapHaptic('medium');
    stopPrepTimer();
    setPrepTimeLeft(0);
    const token = stepTokenRef.current;
    const begin = once(() => {
      if (mountedRef.current && token === stepTokenRef.current) void startRecording(step);
    });
    if (step.startSay) {
      speakText(step.startSay, begin);
      window.setTimeout(begin, speechCeilingMs(step.startSay));
    } else {
      begin();
    }
  };

  const stopPrepTimer = () => {
    if (prepTimerRef.current) {
      clearInterval(prepTimerRef.current);
      prepTimerRef.current = null;
    }
    setIsPrepping(false);
    isPreppingRef.current = false;
  };

  // ── Test Finish & AI Marking ──
  const finishTestGrading = async (attempt = 1) => {
    const id = testIdRef.current;
    if (!id) return;

    haltStepMachine();
    releaseStream();
    setTestStatus('grading');
    setErrorMsg(null);
    setGradingFailed(false);

    try {
      const res = await finishIeltsTest(id);
      if (!mountedRef.current) return;
      setFeedback(res.feedback);
      setTestStatus('results');
      notifyHaptic('success');
    } catch (err: any) {
      if (!mountedRef.current) return;
      console.error('Grading error:', err);

      // Marking carries on server-side even when this request gives up waiting, and
      // the result is stored against the test — so one quiet retry usually collects a
      // finished band rather than starting the work again.
      if (attempt < 2) {
        await new Promise((resolve) => window.setTimeout(resolve, 4000));
        if (!mountedRef.current) return;
        return finishTestGrading(attempt + 1);
      }

      setGradingFailed(true);
      setErrorMsg(err.response?.data?.error || 'Could not mark your test. Please try again.');
    }
  };

  const formatSecs = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return `${m}:${rs.toString().padStart(2, '0')}`;
  };

  const getIeltsPartBadgeText = (part: number, kind: string) => {
    if (kind === 'frame') return 'KIRISH • Examiner Yo\'riqnomasi';
    if (kind === 'closing') return 'END • Test finished';
    if (part === 1) return 'PART 1 • Introduction & personal questions';
    if (part === 2) return 'PART 2 • Cue card task';
    if (part === 3) return 'PART 3 • Discussion & analysis';
    return `PART ${part}`;
  };

  // Render Header
  const renderHeader = () => (
    <MockHeader
      accent="ielts"
      title="IELTS AI Mock Examiner"
      soundEnabled={soundEnabled}
      onBack={() => navigate('mock')}
      onToggleSound={() => {
        const next = !soundEnabled;
        setSoundEnabled(next);
        if (!next) stopSpeech();
      }}
    />
  );

  // 1. IDLE SCREEN (Quota & Start)
  if (testStatus === 'idle') {
    // The status call decides what the card can say — how many tests are left, whether
    // one is unfinished. Drawing the card before it lands would show numbers that then
    // change under the reader, so the wait is shown instead. CEFR waits the same way.
    if (loadingStatus) {
      return (
        <div className="im-page">
          {renderHeader()}
          <MockLoading accent="ielts" label={t('mock.preparing')} />
          <style>{css}</style>
        </div>
      );
    }

    const statusFailed = !status;
    const outOfTests = !!status && status.remaining <= 0;

    return (
      <div className="im-page">
        {renderHeader()}

        <MockIntroCard
          accent="ielts"
          hero={<Award size={40} aria-hidden="true" />}
          title="IELTS Speaking Mock Exam"
          description="A full IELTS Speaking test: Part 1, the Part 2 cue card, and the Part 3 discussion. An AI examiner marks you on the four official criteria."
          details={[
            {
              icon: <Clock size={15} aria-hidden="true" />,
              label: 'Length',
              value: estimatedMinutes ? t('mock.durationMins', { n: estimatedMinutes }) : t('mock.duration'),
            },
            {
              icon: <Award size={15} aria-hidden="true" />,
              label: 'Scoring',
              value: 'Band 0 - 9.0 (IELTS)',
            },
            {
              icon: <BookOpen size={15} aria-hidden="true" />,
              label: 'Format',
              value: 'Part 1 (Intro) + Part 2 (Cue Card) + Part 3 (Discussion)',
              wide: true,
            },
            {
              icon: <Sparkles size={15} aria-hidden="true" />,
              // Free users get a one-off trial that never refills, premium users a
              // quota that resets each day — calling both "Kunlik Limit" told half of
              // them to come back tomorrow for tests they will not get.
              label: status?.lifetime ? t('mock.freeTrial') : t('mock.dailyLimit'),
              value: status ? `${status.remaining} of ${status.limit} tests left` : '—',
              wide: true,
            },
          ]}
          error={errorMsg}
          note={outOfTests ? t('mock.quotaHint') : null}
          busy={busyAction}
          resume={
            status?.active
              ? {
                  label: t('mock.resume'),
                  busyLabel: t('mock.opening'),
                  icon: <Sparkles size={18} aria-hidden="true" />,
                  onClick: () => loadActiveTest(status.active!),
                }
              : undefined
          }
          start={
            status?.active
              ? undefined
              : statusFailed
              ? {
                  // Nothing loaded, so there is nothing to start — offer the retry the
                  // dead, greyed-out start button used to leave people without.
                  label: t('common.tryAgain'),
                  icon: <RotateCcw size={18} aria-hidden="true" />,
                  onClick: () => fetchStatus(),
                }
              : {
                  label: outOfTests ? t('mock.noQuota') : t('mock.startIelts'),
                  busyLabel: t('mock.starting'),
                  icon: <Sparkles size={18} aria-hidden="true" />,
                  onClick: handleStartTest,
                  disabled: outOfTests,
                }
          }
          discard={
            status?.active
              ? {
                  label: t('mock.discard'),
                  busyLabel: t('mock.discarding'),
                  onClick: handleAbandon,
                }
              : undefined
          }
        />

        <style>{css}</style>
      </div>
    );
  }

  // 2. TESTING SCREEN (Part 1, 2, 3 questions)
  if (testStatus === 'testing' && currentStep) {
    const isCueCard = currentStep.kind === 'cue';

    return (
      <div className="im-page">
        {renderHeader()}

        {/* Progress Bar */}
        <div className="im-progress">
          <div className="im-progress__bar" style={{ width: `${((stepIndex + 1) / (totalSteps || 1)) * 100}%` }} />
          <div className="im-progress__info">
            <span>{getIeltsPartBadgeText(currentStep.part, currentStep.kind)}</span>
            <span>{stepIndex + 1} / {totalSteps}</span>
          </div>
        </div>

        <div className="im-test-container">
          {/* Examiner Box */}
          <div className="im-examiner-box">
            <div className={`im-examiner-avatar${isSpeaking ? ' is-speaking' : ''}`}>
              <Mic2 size={22} aria-hidden="true" />
            </div>
            <div className="im-examiner-speech">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="im-examiner-name">AI Examiner</span>
                {isSpeaking && <span style={{ fontSize: '11px', color: '#38bdf8', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px' }}><Volume2 size={13} className="animate-pulse" /> speaking…</span>}
              </div>
              {showTranscript ? (
                <p className="im-examiner-text">{currentStep.say || currentStep.cardSay}</p>
              ) : (
                <p className="im-examiner-text im-examiner-text--hidden">
                  {isSpeaking ? 'Listen to the examiner…' : 'Answer now.'}
                </p>
              )}
              <div className="im-examiner-actions">
                {/* Asking the examiner to repeat is allowed in the real test. */}
                <button
                  type="button"
                  className="im-mini-btn"
                  onClick={repeatQuestion}
                  disabled={isSpeaking || submittingAnswer}
                >
                  <Volume2 size={13} aria-hidden="true" /> Repeat
                </button>
                <button
                  type="button"
                  className="im-mini-btn"
                  onClick={() => setShowTranscript((v) => !v)}
                >
                  {showTranscript ? 'Hide text' : 'Show text'}
                </button>
              </div>
            </div>
          </div>

          {/* Part 2 Cue Card Display */}
          {isCueCard && currentStep.card && (
            <div className="im-cue-card">
              <div className="im-cue-card__header">
                <BookOpen size={16} />
                <span>Part 2 Cue Card</span>
              </div>
              <h3 className="im-cue-card__title">"{currentStep.card.cue}"</h3>
              <div className="im-cue-card__bullets">
                <p className="im-cue-card__bullets-title">You should say:</p>
                <ul>
                  {currentStep.card.bullets.map((bullet, idx) => (
                    <li key={idx}>{bullet}</li>
                  ))}
                </ul>
              </div>

              {/* Prep Timer */}
              <div className="im-prep-timer">
                {/* The timer and the skip button share a row; the hint gets its own,
                    because squeezed between them it wrapped one word per line. */}
                <div className="im-prep-timer__row">
                  <div className="im-prep-timer__info">
                    <Clock size={16} />
                    <span>Preparation: </span>
                    <strong className="im-prep-timer__time">{prepTimeLeft}s</strong>
                  </div>
                  {isPrepping && (
                    <button type="button" className="im-mini-btn" onClick={skipPrep}>
                      <Mic size={13} aria-hidden="true" /> I am ready, start
                    </button>
                  )}
                </div>
                {isPrepping ? (
                  <span className="im-prep-active">Make your notes — you start speaking when this ends.</span>
                ) : prepTimeLeft === 0 ? (
                  <span className="im-prep-active">Speak now.</span>
                ) : null}
              </div>

              {/* The real test hands you paper and a pencil for this minute. */}
              <textarea
                className="im-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Your notes…"
                rows={4}
                aria-label="Notes for Part 2"
              />
            </div>
          )}

          {/* Error Notice */}
          {errorMsg && (
            <div className="im-error-box">
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Controls Area */}
          <div className="im-controls">
            {answerFailed ? (
              // Without this the test simply stopped: an error box, "Getting ready…",
              // and nothing to tap but End the test.
              <div className="im-retry-controls">
                <button className="im-rec-btn im-rec-btn--retry" onClick={retryAnswer}>
                  <RotateCcw size={20} />
                  <span>Send answer again</span>
                </button>
                <button className="im-mini-btn" onClick={skipAnswer}>
                  Skip this question
                </button>
              </div>
            ) : submittingAnswer ? (
              <div className="im-loading-answer">
                <div className="im-spinner" />
                <span>Sending your answer…</span>
              </div>
            ) : isRecording ? (
              <div className="im-recording-controls">
                <div className="im-rec-active">
                  <div className="im-rec-timer">
                    <span className="im-rec-dot" />
                    <span>{formatSecs(recordingMs)} / {formatSecs((currentStep?.maxSec || 60) * 1000)}</span>
                  </div>
                  {/* The examiner stops you at the limit; this is for finishing early. */}
                  <button className="im-rec-btn im-rec-btn--stop" onClick={() => void stopRecordingAndSend()}>
                    <MicOff size={22} />
                    <span>I've finished</span>
                  </button>
                </div>
              </div>
            ) : isPrepping ? (
              <div className="im-waiting-note">
                <Clock size={15} aria-hidden="true" />
                <span>Preparing — {prepTimeLeft}s left</span>
              </div>
            ) : isSpeaking ? (
              <div className="im-waiting-note">
                <Volume2 size={15} aria-hidden="true" />
                <span>The examiner is speaking…</span>
              </div>
            ) : (
              <div className="im-waiting-note">
                <Mic size={15} aria-hidden="true" />
                <span>Getting ready…</span>
              </div>
            )}

            <button className="im-abandon-link" onClick={handleAbandon}>
              End the test
            </button>
          </div>
        </div>
        <style>{css}</style>
      </div>
    );
  }

  // 3. GRADING LOADING SCREEN
  if (testStatus === 'grading') {
    if (gradingFailed) {
      return (
        <div className="im-page">
          {renderHeader()}
          <div className="im-content">
            <div className="im-error-box">
              <AlertCircle size={16} />
              <span>{errorMsg || 'Could not mark your test.'}</span>
            </div>
            {/* The answers are safe on the server, so this retries the marking rather
                than the test — nobody has to speak for twenty minutes again. */}
            <p className="im-grading-note">
              Your answers are saved. Tap to try marking again.
            </p>
            <div className="im-retry-controls">
              <button className="im-rec-btn im-rec-btn--retry" onClick={() => void finishTestGrading()}>
                <RotateCcw size={20} />
                <span>Try marking again</span>
              </button>
              <button className="im-mini-btn" onClick={() => navigate('mock')}>
                Keyinroq qaytaman
              </button>
            </div>
          </div>
          <style>{css}</style>
        </div>
      );
    }

    return (
      <div className="im-page">
        <MockLoading
          accent="ielts"
          label="The AI examiner is marking your test…"
          sublabel="Marking you on Fluency, Lexical Resource, Grammar and Pronunciation. This takes a moment."
        />
        <style>{css}</style>
      </div>
    );
  }

  // 4. RESULTS & FEEDBACK SCREEN
  if (testStatus === 'results' && feedback) {
    return (
      <div className="im-page">
        {renderHeader()}

        <div className="im-content">
          {/* Main Band Score Card */}
          <div className="im-result-score-card">
            <Award size={36} className="im-award-icon" />
            <div className="im-overall-badge">OVERALL BAND</div>
            <div className="im-score-num">{feedback.overall}</div>
            <p className="im-score-text">
              Tabriklaymiz! IELTS Speaking testini muvaffaqiyatli yakunladingiz.
            </p>
          </div>

          {/* Sub-scores Grid */}
          <div className="im-subscores-grid">
            <div className="im-subscore-item">
              <div className="im-subscore-head">
                <span className="im-subscore-name">Fluency & Coherence</span>
                <span className="im-subscore-band">{feedback.fluency.band}</span>
              </div>
              <p className="im-subscore-comment">{feedback.fluency.comment}</p>
            </div>

            <div className="im-subscore-item">
              <div className="im-subscore-head">
                <span className="im-subscore-name">Lexical Resource</span>
                <span className="im-subscore-band">{feedback.lexical.band}</span>
              </div>
              <p className="im-subscore-comment">{feedback.lexical.comment}</p>
            </div>

            <div className="im-subscore-item">
              <div className="im-subscore-head">
                <span className="im-subscore-name">Grammar Range & Accuracy</span>
                <span className="im-subscore-band">{feedback.grammar.band}</span>
              </div>
              <p className="im-subscore-comment">{feedback.grammar.comment}</p>
            </div>

            <div className="im-subscore-item">
              <div className="im-subscore-head">
                <span className="im-subscore-name">Pronunciation</span>
                <span className="im-subscore-band">{feedback.pronunciation.band}</span>
              </div>
              <p className="im-subscore-comment">{feedback.pronunciation.comment}</p>
            </div>
          </div>

          {/* What the examiner made of each part. The marker has written these since
              the start; nothing on screen ever showed them. */}
          {feedback.partNotes &&
            (feedback.partNotes.part1 || feedback.partNotes.part2 || feedback.partNotes.part3) && (
              <div className="im-section">
                <h3 className="im-section-title">
                  <BookOpen size={18} />
                  <span>Notes on each part</span>
                </h3>
                <div className="im-subscores-grid">
                  {([
                    { key: 'part1', label: 'Part 1', sub: 'Introduction & Interview' },
                    { key: 'part2', label: 'Part 2', sub: 'Cue Card' },
                    { key: 'part3', label: 'Part 3', sub: 'Discussion' },
                  ] as const).map(({ key, label, sub }) =>
                    feedback.partNotes?.[key] ? (
                      <div className="im-subscore-item" key={key}>
                        <div className="im-subscore-head">
                          <span className="im-subscore-name">{label} · {sub}</span>
                        </div>
                        <p className="im-subscore-comment">{feedback.partNotes[key]}</p>
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            )}

          {/* Strong Points & Main Problems */}
          {((feedback.strengths && feedback.strengths.length > 0) || (feedback.weaknesses && feedback.weaknesses.length > 0)) && (
            <div className="im-subscores-grid">
              {feedback.strengths && feedback.strengths.length > 0 && (
                <div className="im-subscore-item" style={{ borderLeft: '3px solid #10b981' }}>
                  <div className="im-subscore-head">
                    <span className="im-subscore-name" style={{ color: '#10b981' }}><ThumbsUp size={13} aria-hidden="true" /> {t('mock.strongPoints')}</span>
                  </div>
                  <ul style={{ margin: '6px 0 0', paddingLeft: '18px', fontSize: '14px', lineHeight: '1.6', color: 'rgba(255,255,255,0.9)' }}>
                    {feedback.strengths.map((pt, idx) => (
                      <li key={idx}>{pt}</li>
                    ))}
                  </ul>
                </div>
              )}
              {feedback.weaknesses && feedback.weaknesses.length > 0 && (
                <div className="im-subscore-item" style={{ borderLeft: '3px solid #ef4444' }}>
                  <div className="im-subscore-head">
                    <span className="im-subscore-name" style={{ color: '#ef4444' }}><AlertTriangle size={13} aria-hidden="true" /> {t('mock.mainProblems')}</span>
                  </div>
                  <ul style={{ margin: '6px 0 0', paddingLeft: '18px', fontSize: '14px', lineHeight: '1.6', color: 'rgba(255,255,255,0.9)' }}>
                    {feedback.weaknesses.map((pr, idx) => (
                      <li key={idx}>{pr}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* A rewrite of one answer used to live here, but the marker has never
              produced one: "fixes" below does the same job for up to five answers. */}

          {/* Error Fixes & Corrections */}
          {feedback.fixes && feedback.fixes.length > 0 && (
            <div className="im-section">
              <h3 className="im-section-title">
                <CheckCircle2 size={18} />
                <span>Mistakes and better phrases</span>
              </h3>
              <div className="im-fixes-list">
                {feedback.fixes.map((fix, idx) => (
                  <div key={idx} className="im-fix-card">
                    <div className="im-fix-said">
                      <span className="im-fix-label">You said:</span>
                      <p>"{fix.said}"</p>
                    </div>
                    <div className="im-fix-better">
                      <span className="im-fix-label">Yaxshiroq (Band+):</span>
                      <p>"{fix.better}"</p>
                    </div>
                    {fix.why && <span className="im-fix-why">Sabab: {fix.why}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actionable Advice */}
          {asList(feedback.advice).length > 0 && (
            <div className="im-advice-card">
              <h3><Lightbulb size={14} aria-hidden="true" /> {t('mock.advice')}</h3>
              <ol style={{ margin: '8px 0 0', paddingLeft: '20px', fontSize: '15px', lineHeight: 1.65 }}>
                {asList(feedback.advice).map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ol>
            </div>
          )}

          {/* Result Actions */}
          <div className="im-actions">
            <button className="im-btn im-btn--primary" onClick={() => { setTestStatus('idle'); fetchStatus(); }}>
              <RotateCcw size={18} />
              <span>{t('mock.retake')}</span>
            </button>
            <button className="im-btn im-btn--ghost" onClick={() => navigate('mock')}>
              <span>Bosh sahifaga qaytish</span>
            </button>
          </div>
        </div>
        <style>{css}</style>
      </div>
    );
  }

  return null;
}

const css = `
  .im-page {
    display: flex; flex-direction: column; height: 100%; min-height: 100dvh;
    background: var(--bg); color: var(--text-primary);
    overflow-y: auto; padding-bottom: 40px;
  }
  .im-page--center {
    align-items: center; justify-content: center; padding: 24px;
  }

  .im-content {
    padding: 16px; display: flex; flex-direction: column; gap: 16px; max-width: 500px; margin: 0 auto; width: 100%; box-sizing: border-box;
  }

  .im-hero-card {
    position: relative; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
    border-radius: 20px; padding: 24px 20px; text-align: center;
    display: flex; flex-direction: column; align-items: center; gap: 12px;
    box-shadow: 0 10px 30px rgba(2, 132, 199, 0.3);
  }
  .im-badge {
    position: absolute; top: 12px; right: 12px;
    background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3);
    padding: 3px 8px; border-radius: 99px; font-size: 10px; font-weight: 700; color: #fff;
  }
  .im-avatar-wrapper { position: relative; width: 64px; height: 64px; }
  .im-avatar {
    width: 64px; height: 64px; border-radius: 50%; background: #fff;
    display: flex; align-items: center; justify-content: center; font-size: 30px;
  }
  .im-title { font-size: 20px; font-weight: 800; margin: 0; color: #fff; }
  .im-desc { font-size: 13px; line-height: 1.5; color: rgba(255,255,255,0.9); margin: 0; }

  .im-quota-card {
    background: var(--bg-secondary); border: 1px solid var(--border);
    border-radius: 16px; padding: 14px 16px; display: flex; flex-direction: column; gap: 6px;
  }
  .im-quota-info { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
  .im-quota-label { color: var(--text-secondary); }
  .im-quota-value { font-weight: 700; color: #38bdf8; }
  .im-quota-hint { font-size: 11px; color: var(--text-tertiary); margin: 0; line-height: 1.4; }

  .im-error-box {
    background: var(--danger-bg); border: 1px solid rgba(239, 68, 68, 0.3);
    color: var(--danger); padding: 10px 14px; border-radius: 12px; font-size: 13px;
    display: flex; align-items: center; gap: 8px;
  }

  .im-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
  .im-btn {
    width: 100%; min-height: 48px; border-radius: 14px; font-size: 15px; font-weight: 700;
    display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer;
    border: none; transition: transform 0.1s, opacity 0.15s;
  }
  .im-btn:active { transform: scale(0.98); }
  .im-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .im-btn--primary { background: #38bdf8; color: #090d16; box-shadow: 0 4px 16px rgba(56, 189, 248, 0.3); }
  .im-btn--ghost { background: var(--surface-2); color: var(--text-primary); border: 1px solid var(--border); }

  /* Progress Bar */
  .im-progress {
    position: relative; background: var(--surface-2); height: 28px;
    display: flex; align-items: center; padding: 0 14px; overflow: hidden;
  }
  .im-progress__bar {
    position: absolute; left: 0; top: 0; bottom: 0; background: #0284c7;
    transition: width 0.3s ease; opacity: 0.4;
  }
  .im-progress__info {
    position: relative; z-index: 1; width: 100%; display: flex; justify-content: space-between;
    font-size: 11px; font-weight: 700; color: var(--text-secondary);
  }

  /* Test Interface */
  .im-test-container {
    padding: 16px; display: flex; flex-direction: column; gap: 16px; flex: 1; max-width: 500px; margin: 0 auto; width: 100%;
  }
  .im-examiner-box {
    background: var(--bg-secondary); border: 1px solid var(--border);
    border-radius: 18px; padding: 16px; display: flex; gap: 14px; align-items: flex-start;
  }
  .im-examiner-avatar {
    width: 44px; height: 44px; border-radius: 50%; background: #0284c7; color: #fff;
    display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0;
  }
  .im-examiner-avatar.is-speaking {
    animation: examPulse 1.2s infinite;
  }
  @keyframes examPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.6); }
    50% { box-shadow: 0 0 0 10px rgba(56, 189, 248, 0); }
  }
  .im-examiner-speech { display: flex; flex-direction: column; gap: 4px; }
  .im-examiner-name { font-size: 11px; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px; }
  .im-examiner-text { font-size: 15px; line-height: 1.5; margin: 0; color: var(--text-primary); }

  .im-cue-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border); border-radius: 18px; padding: 18px;
    display: flex; flex-direction: column; gap: 12px;
  }
  .im-cue-card__header { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: #38bdf8; }
  .im-cue-card__title { font-size: 16px; font-weight: 700; margin: 0; color: var(--text-primary); line-height: 1.4; }
  .im-cue-card__bullets { background: var(--surface-2); padding: 12px 14px; border-radius: 12px; }
  .im-cue-card__bullets-title { font-size: 12px; font-weight: 600; color: var(--text-secondary); margin: 0 0 6px; }
  .im-cue-card__bullets ul { margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.6; color: var(--text-primary); }

  .im-prep-timer {
    display: flex; flex-direction: column; gap: 8px;
    background: var(--surface-2); padding: 10px 12px; border-radius: 12px;
  }
  .im-prep-timer__row {
    display: flex; align-items: center; justify-content: space-between;
    gap: 10px; flex-wrap: wrap;
  }
  .im-prep-timer__info { font-size: 12px; display: flex; align-items: center; gap: 6px; color: var(--text-secondary); }
  .im-prep-timer__time { font-size: 15px; color: #38bdf8; }
  /* Scoped to this row so the other .im-mini-btn uses are left alone. */
  .im-prep-timer .im-mini-btn { flex-shrink: 0; white-space: nowrap; }
  .im-prep-btn {
    background: #0284c7; color: #fff; border: none; padding: 6px 12px; border-radius: 8px;
    font-size: 12px; font-weight: 700; cursor: pointer;
  }
  .im-prep-active { font-size: 11px; color: #f59e0b; font-weight: 600; line-height: 1.5; }

  .im-controls { margin-top: auto; display: flex; flex-direction: column; gap: 12px; }
  .im-loading-answer {
    display: flex; align-items: center; justify-content: center; gap: 10px; padding: 16px;
    background: var(--surface-2); border-radius: 14px; font-size: 14px; font-weight: 600; color: var(--text-primary);
  }
  .im-spinner {
    width: 20px; height: 20px; border: 2px solid var(--border-strong);
    border-top-color: #38bdf8; border-radius: 50%; animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .im-recording-controls { width: 100%; }
  .im-examiner-text--hidden { opacity: 0.55; font-style: italic; }
  .im-examiner-actions { display: flex; gap: 6px; margin-top: 8px; }
  .im-mini-btn {
    display: inline-flex; align-items: center; gap: 4px;
    min-height: 30px; padding: 0 10px;
    border-radius: 999px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    color: var(--text-secondary);
    font-size: 11px; font-weight: 700;
  }
  .im-mini-btn:disabled { opacity: 0.4; }
  .im-notes {
    width: 100%; margin-top: 10px; padding: 10px;
    border-radius: 10px; resize: vertical;
    background: var(--surface-2);
    border: 1px solid var(--border);
    color: var(--text-primary); font-size: 13px; line-height: 1.5;
  }
  .im-notes::placeholder { color: var(--text-tertiary); }
  .im-waiting-note {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    width: 100%; min-height: 48px;
    color: var(--text-secondary); font-size: 13px; font-weight: 600;
  }
  .im-rec-btn {
    width: 100%; min-height: 52px; border-radius: 16px; border: none; font-size: 15px; font-weight: 700;
    display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer;
    transition: transform 0.1s;
  }
  .im-rec-btn:active { transform: scale(0.98); }
  .im-rec-btn--start { background: #10b981; color: #fff; box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3); }
  .im-rec-btn--stop { background: #ef4444; color: #fff; box-shadow: 0 4px 16px rgba(239, 68, 68, 0.3); }
  .im-rec-btn--retry { background: #38bdf8; color: #04222f; box-shadow: 0 4px 16px rgba(56, 189, 248, 0.3); }

  .im-retry-controls {
    width: 100%; display: flex; flex-direction: column; gap: 10px; align-items: center;
  }
  .im-grading-note {
    margin: 12px 0; font-size: 13px; line-height: 1.6; text-align: center;
    color: var(--text-secondary);
  }

  .im-rec-active { display: flex; flex-direction: column; gap: 10px; align-items: center; }
  .im-rec-timer {
    display: flex; align-items: center; gap: 6px; font-size: 16px; font-weight: 800; color: #ef4444;
  }
  .im-rec-dot {
    width: 10px; height: 10px; border-radius: 50%; background: #ef4444;
    animation: dotPulse 1s infinite;
  }
  @keyframes dotPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

  .im-abandon-link {
    background: none; border: none; color: var(--text-tertiary); font-size: 12px;
    padding: 6px; cursor: pointer; text-align: center;
  }

  /* Grading Screen */

  /* Results Screen */
  .im-result-score-card {
    background: linear-gradient(135deg, #0284c7 0%, #0f172a 100%);
    border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 24px; padding: 28px 20px;
    display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center;
    box-shadow: 0 12px 36px rgba(2, 132, 199, 0.25);
  }
  .im-award-icon { color: #f59e0b; }
  .im-overall-badge { font-size: 12px; font-weight: 800; color: #38bdf8; letter-spacing: 1px; }
  .im-score-num { font-size: 54px; font-weight: 900; line-height: 1; color: #fff; }
  .im-score-text { font-size: 15px; line-height: 1.55; color: rgba(255,255,255,0.85); margin: 4px 0 0; }

  /* One per row: two columns left each comment in a column too narrow to read,
     breaking the sentences into a word or two per line. */
  .im-subscores-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
  .im-subscore-item {
    background: var(--bg-secondary); border: 1px solid var(--border);
    border-radius: 14px; padding: 14px 16px; display: flex; flex-direction: column; gap: 6px;
  }
  .im-subscore-head { display: flex; justify-content: space-between; align-items: center; }
  .im-subscore-name { font-size: 13px; font-weight: 700; color: var(--text-secondary); }
  .im-subscore-band { font-size: 20px; font-weight: 800; color: #38bdf8; }
  .im-subscore-comment { font-size: 14px; line-height: 1.65; color: var(--text-primary); margin: 0; }

  .im-section { display: flex; flex-direction: column; gap: 10px; }
  .im-section-title {
    font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 8px; color: #10b981; margin: 0;
  }
  .im-fixes-list { display: flex; flex-direction: column; gap: 10px; }
  .im-fix-card {
    background: var(--bg-secondary); border: 1px solid var(--border);
    border-radius: 14px; padding: 14px 16px; display: flex; flex-direction: column; gap: 7px; font-size: 14px;
  }
  .im-fix-said { color: #ef4444; }
  .im-fix-better { color: #10b981; }
  .im-fix-label { font-weight: 700; margin-right: 6px; opacity: 0.85; }
  .im-fix-card p { margin: 3px 0 0; font-weight: 600; line-height: 1.55; color: var(--text-primary); }
  .im-fix-why { font-size: 13px; line-height: 1.5; color: var(--text-secondary); font-style: italic; }

  .im-advice-card {
    background: var(--warning-bg); border: 1px solid rgba(245, 158, 11, 0.25);
    border-radius: 16px; padding: 14px 16px; display: flex; flex-direction: column; gap: 6px;
  }
  .im-advice-card h3 { font-size: 15px; font-weight: 700; color: #f59e0b; margin: 0; }
  .im-advice-card p { font-size: 15px; line-height: 1.65; color: var(--text-primary); margin: 0; }
`;
