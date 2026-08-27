import React, { useState, useEffect, useRef } from 'react';
import { useT } from '../i18n';
import { AlertTriangle, ArrowLeft, Award, BookOpen, CheckCircle2, Clock, HelpCircle, Image as ImageIcon, Layers, Lightbulb, Mic, Mic2, MicOff, RotateCcw, Sparkles, ThumbsUp, Volume2, VolumeX } from 'lucide-react';
import {
  getCefrStatus,
  createCefrTest,
  getCefrTest,
  sendCefrAnswer,
  finishCefrTest,
  abandonCefrTest,
  getTTSAudio,
} from '../api/endpoints';
import useAppStore from '../store/useAppStore';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';
import { tapHaptic, notifyHaptic } from '../utils/haptics';
import { pickExaminerVoice, whenVoicesReady, type ExaminerGender } from '../utils/examinerVoice';
import { MockHeader, MockIntroCard, MockLoading, type MockBusyAction } from '../components/MockIntro';

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

interface CefrMockProps {
  navigate: (screen: string) => void;
}

interface StepData {
  i: number;
  part: '1.1' | '1.2' | '2' | '3' | 'intro' | 'closing';
  kind: 'frame' | 'question' | 'task' | 'closing';
  say: string;
  pictures?: {
    type: 'comparison' | 'contextual';
    pic1Url?: string;
    pic2Url?: string;
    pic1Alt?: string;
    pic2Alt?: string;
  } | null;
  prompts?: string[] | null;
  prepSec?: number | null;
  maxSec: number;
}

interface CefrFeedback {
  cefrLevel: string;
  estimatedScore: string;
  partPerformance: {
    part1_1: { score: string; comment: string };
    part1_2: { score: string; comment: string };
    part2: { score: string; comment: string };
    part3: { score: string; comment: string };
  };
  skills: {
    fluency: { score: string; comment: string };
    vocabulary: { score: string; comment: string };
    grammar: { score: string; comment: string };
    pronunciation: { score: string; comment: string };
  };
  strengths: string[];
  weaknesses: string[];
  improvementPlan: string[];
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
 * firing late costs a pause, while firing early opens the microphone over the examiner
 * mid-sentence. It is only reached when speech fails to report back at all.
 */
function speechCeilingMs(text: string): number {
  const chars = String(text || '').length;
  return Math.min(8000 + chars * 120, 60000);
}

/** What the examiner says when the answer has run to its limit. */
const CUT_OFF_LINE = 'Thank you.';

/** What the examiner says when preparation time is up, as in the real exam. */
const BEGIN_LINE = 'Your preparation time is over. Please begin speaking now.';

export default function CefrMock(props: Partial<CefrMockProps>) {
  const t = useT();
  const storeNavigate = useAppStore((s) => s.navigate);
  const navigate = props.navigate || storeNavigate;
  const user = useAppStore((s) => s.user);

  useTelegramBackButton(() => storeNavigate('mock'));

  // Test status
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'grading' | 'results'>('idle');
  // Only the first status call blanks the screen. Starting or resuming keeps the card
  // on screen and lights up the button instead — same as IELTS.
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);
  const [testId, setTestId] = useState<string | null>(null);
  // Which voice the browser fallback should read the examiner's lines in.
  const examinerGenderRef = useRef<ExaminerGender>('female');
  // The question is heard, not read — the text is available on request, as in IELTS.
  const [showTranscript, setShowTranscript] = useState(false);

  // The browser populates its voice list asynchronously and reports none on the first
  // call. Warm it on mount so the fallback has real voices to choose from if it fires.
  useEffect(() => {
    whenVoicesReady(() => {});
  }, []);
  const [activeTestId, setActiveTestId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<StepData | null>(null);
  const [totalSteps, setTotalSteps] = useState<number>(9);
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(0);

  // Quota Status
  const [quota, setQuota] = useState<{
    remaining: number;
    limit: number;
    used: number;
    isPremium: boolean;
  } | null>(null);

  // Prep Timer State
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
  const [feedback, setFeedback] = useState<CefrFeedback | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittingAnswer, setSubmittingAnswer] = useState<boolean>(false);

  // Which start-screen button is mid-flight, so it can say so instead of sitting
  // there looking untapped.
  const [busyAction, setBusyAction] = useState<MockBusyAction>(null);
  // An answer that failed to reach the server is held, not lost: the recording is still
  // in hand, so the candidate is offered the send again rather than the test stalling.
  const [answerFailed, setAnswerFailed] = useState<boolean>(false);
  const [gradingFailed, setGradingFailed] = useState<boolean>(false);
  const mountedRef = useRef(true);

  /**
   * The test drives itself from timers and speech callbacks, all of which were
   * scheduled by an earlier render, so anything they read out of `useState` is the
   * value from that render rather than the value now. That is why the recorder was
   * given the previous question's time limit and why the duration posted with every
   * answer was whatever `recordingMs` held before recording started — almost always
   * zero, which is what the marker was then shown. The live values live in refs.
   */
  const currentStepRef = useRef<StepData | null>(null);
  const testIdRef = useRef<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef(false);
  const isPreppingRef = useRef(false);
  const submitLockRef = useRef(false);
  const stepTokenRef = useRef(0);
  /** The recording behind a failed send, kept so it can be sent again. */
  const pendingAnswerRef = useRef<{ blob: Blob | null; ms: number } | null>(null);

  const applyStep = (step: StepData | null) => {
    currentStepRef.current = step;
    setCurrentStep(step);
  };

  const applyTestId = (id: string | null) => {
    testIdRef.current = id;
    setTestId(id);
  };

  /**
   * One live microphone for the whole test.
   *
   * Every question used to open its own stream and stop its tracks on the way out. On
   * a phone that is a fresh permission check and a fresh device negotiation between
   * each answer — dead air at best, an intermittent failure at worst, several
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

  /**
   * The browser only grants the microphone in response to a tap, and the first question
   * opens it from a speech callback seconds later — by then the gesture has expired on
   * some webviews. Ask here, while the tap is still in hand.
   */
  const claimMicrophone = async (): Promise<boolean> => {
    try {
      await ensureStream();
      return true;
    } catch (err) {
      console.error('Mic access error:', err);
      setErrorMsg('Mikrofonga ruxsat berilmadi. Imtihon uchun brauzer sozlamalaridan ruxsat bering.');
      return false;
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    fetchStatus();
    return () => {
      stopSpeech();
      stopRecordingSilently();
      clearTimers();
      releaseStream();
    };
  }, []);

  const clearTimers = () => {
    if (prepTimerRef.current) clearInterval(prepTimerRef.current);
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
  };

  const fetchStatus = async () => {
    setLoadingStatus(true);
    setErrorMsg(null);
    try {
      const res = await getCefrStatus();
      setQuota(res.quota);
      if (res.activeTest) {
        applyTestId(res.activeTest.id);
        setActiveTestId(res.activeTest.id);
      } else {
        setActiveTestId(null);
      }
    } catch (err: any) {
      console.error('CEFR Status error:', err);
      setQuota(null);
      setErrorMsg(t('mock.statusFailed'));
    } finally {
      setLoadingStatus(false);
      setTestStatus('idle');
    }
  };

  // One tap, one test. A double tap used to fire two create requests: the server hands
  // back the same test both times, but the client then ran its opening step twice —
  // two examiner voices over each other and two prep timers counting down. The ref
  // closes the window between the taps that state alone would leave open.
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

  const loadActiveTest = (id: string) =>
    runAction('resume', async () => {
      tapHaptic('medium');
      setErrorMsg(null);
      if (!(await claimMicrophone())) return;
      try {
        const res = await getCefrTest(id);
        if (res.examinerGender) examinerGenderRef.current = res.examinerGender;
        // The server calls a marked test "finished"; this looked for "completed",
        // matched nothing, and then fell through to a step that a finished test does
        // not have — so reopening a graded test showed the candidate nothing at all.
        if (res.feedback) {
          setFeedback(res.feedback);
          setTestStatus('results');
          return;
        }
        if (res.step) {
          applyTestId(res.testId);
          setTotalSteps(res.totalSteps || 9);
          setEstimatedMinutes(res.estimatedMinutes || 0);
          applyStep(res.step);
          setTestStatus('testing');
          beginStep(res.step);
          return;
        }
        setErrorMsg('Bu imtihonni davom ettirib bo\'lmadi.');
      } catch (err: any) {
        console.error('Load active test error:', err);
        setErrorMsg(err?.response?.data?.error || 'Imtihonni yuklashda xatolik.');
      }
    });

  const handleStartTest = () =>
    runAction('start', async () => {
      tapHaptic('medium');
      setErrorMsg(null);
      if (!(await claimMicrophone())) return;
      try {
        const res = await createCefrTest('full');
        if (res.examinerGender) examinerGenderRef.current = res.examinerGender;
        applyTestId(res.testId);
        setActiveTestId(res.testId);
        setTotalSteps(res.totalSteps || 9);
        setEstimatedMinutes(res.estimatedMinutes || 0);
        applyStep(res.step);
        setTestStatus('testing');
        if (res.step) beginStep(res.step);
      } catch (err: any) {
        console.error('Start CEFR test error:', err);
        // The server may well have created the test before this request gave up, so
        // look again rather than leaving a started test invisible behind an error.
        void fetchStatus();
        const msg = err?.response?.data?.error || 'Imtihonni boshlashda xatolik yuz berdi.';
        setErrorMsg(msg);
      }
    });

  /**
   * Runs a step the way an examiner would: speak, then wait for the candidate.
   *
   * The old version spoke the question, started the preparation clock, and stopped
   * there — the microphone only ever opened if the candidate found and pressed a
   * button, and when preparation ran out nothing happened at all. A real Multilevel
   * examiner does not wait to be asked, so the recorder now opens by itself.
   */
  const beginStep = (step: StepData) => {
    stepTokenRef.current += 1;
    const token = stepTokenRef.current;
    if (prepTimerRef.current) clearInterval(prepTimerRef.current);
    setIsPrepping(false);
    isPreppingRef.current = false;
    setRecordingMs(0);

    // A later step, or leaving the test, retires this one's turn.
    const current = () => mountedRef.current && token === stepTokenRef.current;
    const spoken = step.say || '';

    const proceed = once(() => {
      if (!current()) return;

      if (step.kind === 'frame' || step.kind === 'closing') {
        // Examiner framing needs no answer — move on rather than waiting for a tap.
        window.setTimeout(() => { if (current()) void handleNextFrame(); }, 700);
        return;
      }
      if (step.prepSec && step.prepSec > 0) {
        startPrepTimer(step);
        return;
      }
      window.setTimeout(() => { if (current()) void startRecording(step); }, 400);
    });

    speakText(spoken, proceed);

    // The test must not depend on the voice reporting back. Autoplay policy can refuse
    // the audio outright and a webview can simply drop the event — either of which
    // used to leave the candidate on a silent screen with nothing happening.
    window.setTimeout(proceed, speechCeilingMs(spoken));
  };

  const startPrepTimer = (step: StepData) => {
    if (isPreppingRef.current) return;
    // Leaving the test mid-preparation must not let the finishing line reach across
    // and open the microphone on the screen the candidate walked back to.
    const token = stepTokenRef.current;
    const total = Math.max(step.prepSec || 60, 5);
    // Counted against a deadline rather than by decrementing: a phone that throttles
    // timers in the background used to hand back more preparation than the exam allows.
    const endsAt = Date.now() + total * 1000;

    setIsPrepping(true);
    isPreppingRef.current = true;
    setPrepTimeLeft(total);

    const begin = once(() => {
      if (mountedRef.current && token === stepTokenRef.current) void startRecording(step);
    });

    prepTimerRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setPrepTimeLeft(left);
      if (left > 0) return;

      stopPrepTimer();
      notifyHaptic('success');
      speakText(BEGIN_LINE, begin);
      window.setTimeout(begin, speechCeilingMs(BEGIN_LINE));
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
    speakText(BEGIN_LINE, begin);
    window.setTimeout(begin, speechCeilingMs(BEGIN_LINE));
  };

  const stopPrepTimer = () => {
    if (prepTimerRef.current) {
      clearInterval(prepTimerRef.current);
      prepTimerRef.current = null;
    }
    setIsPrepping(false);
    isPreppingRef.current = false;
  };

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

  /** Asking for a repeat is allowed — and must not strand the test. */
  const repeatQuestion = () => {
    const step = currentStepRef.current;
    if (!step || submitLockRef.current) return;
    tapHaptic('light');

    // The microphone is already open by the time anyone thinks to ask, so the part
    // answer is thrown away and the clock restarted. Speaking over a live recording
    // would put the examiner's own words into the candidate's transcript.
    const wasRecording = isRecordingRef.current;
    if (wasRecording) stopRecordingSilently();

    const token = stepTokenRef.current;
    const spoken = step.say || '';
    const resume = once(() => {
      if (!mountedRef.current || token !== stepTokenRef.current || isPreppingRef.current) return;
      if (wasRecording) void startRecording(step);
    });
    speakText(spoken, resume);
    window.setTimeout(resume, speechCeilingMs(spoken));
  };

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechTokenRef = useRef(0);

  const speakText = async (text?: string, onDone?: () => void) => {
    // With sound off or nothing to say there is nothing to wait for, so hand control
    // straight back — the step machine is waiting on this callback.
    if (!soundEnabled || !text || !mountedRef.current) {
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
      utterance.lang = 'en-GB';
      // Without this the browser reads the examiner in whatever voice the device
      // lists first, which is usually male — wrong for an examiner named Sarah.
      const preferred = pickExaminerVoice(examinerGenderRef.current, 'en-GB');
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

  const toggleSound = () => {
    // The header button already fires the tap haptic.
    if (soundEnabled) {
      stopSpeech();
      setSoundEnabled(false);
    } else {
      setSoundEnabled(true);
      // Not while the microphone is open: the question would be recorded as though the
      // candidate had said it.
      if (currentStepRef.current?.say && !isRecordingRef.current) {
        void speakText(currentStepRef.current.say);
      }
    }
  };

  const startRecording = async (step: StepData) => {
    if (isRecordingRef.current || !mountedRef.current) return;
    tapHaptic('heavy');
    stopSpeech();
    setErrorMsg(null);

    try {
      const stream = await ensureStream();
      if (!mountedRef.current) return;
      audioChunksRef.current = [];
      const preferred = getSupportedMimeType();
      // An empty string is not a valid mimeType — passing it through threw and killed
      // the recording outright. No option at all lets the browser pick its own.
      const recorder = preferred
        ? new MediaRecorder(stream, { mimeType: preferred })
        : new MediaRecorder(stream);
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
          // The examiner cuts you off out loud. The line is said inside, once the
          // recorder is closed: spoken first it would have been recorded, and the
          // marker would have read the examiner's words back as the candidate's.
          void stopRecordingAndSend({ announce: true });
        }
      }, 200);
    } catch (err: any) {
      console.error('Mic access error:', err);
      setErrorMsg('Mikrofonga ruxsat berilmadi. Sozlamalardan mikrofonga ruxsat bering.');
    }
  };

  const stopRecordingAndSend = async (options?: { announce?: boolean }) => {
    const recorder = mediaRecorderRef.current;
    // Guarded on the refs, not on state: the automatic cut-off runs from a timer whose
    // captured state is always the value from before recording started.
    if (!recorder || !isRecordingRef.current || submitLockRef.current) return;

    submitLockRef.current = true;
    tapHaptic('medium');
    stopSpeech();

    // Measured, not read out of `recordingMs`. The cut-off timer's copy of that state
    // was fixed at zero, so every automatically ended answer was posted as zero
    // seconds long and marked as though the candidate had said nothing.
    const duration = Date.now() - recordingStartTimeRef.current;
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setIsRecording(false);
    isRecordingRef.current = false;
    setSubmittingAnswer(true);

    await new Promise<void>((resolve) => {
      // Waiting a flat 300ms was a race: the recorder had not always flushed its last
      // chunk, so the tail of the answer went missing. Wait for the event, bounded so
      // a recorder that never reports back cannot strand the test.
      const done = once(resolve);
      recorder.onstop = done;
      try {
        recorder.stop();
      } catch {
        done();
      }
      window.setTimeout(done, 2500);
    });

    const audioBlob = audioChunksRef.current.length
      ? new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
      : null;
    audioChunksRef.current = [];
    mediaRecorderRef.current = null;
    submitLockRef.current = false;

    // Not awaited: the acknowledgement plays over the upload, which is exactly the
    // dead air it is there to cover.
    if (options?.announce) void speakText(CUT_OFF_LINE);

    await submitAnswer(audioBlob, duration);
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
      const data = await getCefrTest(id, RESYNC_TIMEOUT_MS);
      if (!mountedRef.current) return false;

      if (data.status === 'active' && data.step) {
        // A step past the one just sent means the answer did land.
        if (data.step.i <= sentStep) return false;
        pendingAnswerRef.current = null;
        setSubmittingAnswer(false);
        setErrorMsg(null);
        applyStep(data.step);
        beginStep(data.step);
        return true;
      }

      // The last answer was the last question: the test is over, so mark it.
      pendingAnswerRef.current = null;
      setSubmittingAnswer(false);
      void handleFinishTest();
      return true;
    } catch (err) {
      console.error('Could not resync the test:', err);
      return false;
    }
  };

  const submitAnswer = async (audioBlob: Blob | null, durationMs: number, attempt = 1) => {
    const step = currentStepRef.current;
    const id = testIdRef.current;
    if (!id || !step) return;

    // Held until the server confirms, so a failed send can be repeated with the same
    // recording instead of costing the candidate the answer.
    pendingAnswerRef.current = { blob: audioBlob, ms: durationMs };
    setErrorMsg(null);
    setAnswerFailed(false);
    setSubmittingAnswer(true);

    try {
      const res = await sendCefrAnswer(id, step.i, durationMs, audioBlob);
      if (!mountedRef.current) return;
      pendingAnswerRef.current = null;
      setSubmittingAnswer(false);

      if (res.done || !res.step) {
        void handleFinishTest();
        return;
      }

      applyStep(res.step);
      // Running the step is what speaks the next question and opens the microphone
      // again. Setting the state alone left the test sitting there.
      beginStep(res.step);
    } catch (err: any) {
      if (!mountedRef.current) return;
      console.error(`Send CEFR answer error (attempt ${attempt}):`, err);

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
        return submitAnswer(audioBlob, durationMs, attempt + 1);
      }

      setSubmittingAnswer(false);
      setErrorMsg(err?.response?.data?.error || 'Javobni yuborishda xatolik. Qayta yuborib ko\'ring.');
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

  const getPartBadgeText = (part: string, kind?: string) => {
    if (kind === 'frame' || part === 'intro') return 'KIRISH • Examiner Yo\'riqnomasi';
    if (kind === 'closing' || part === 'closing') return 'YAKUN • Imtihon Tugadi';
    if (part === '1.1') return 'PART 1.1 • Oddiy Savollar (A1-A2)';
    if (part === '1.2') return 'PART 1.2 • Rasmlarni Taqqoslash (B1)';
    if (part === '2') return 'PART 2 • Mavzu Bo\'yicha Nutq (B2)';
    if (part === '3') return 'PART 3 • Erkin Muhokama (C1)';
    return `PART ${part}`;
  };

  const handleFinishTest = async (attempt = 1) => {
    const id = testIdRef.current;
    if (!id) return;

    haltStepMachine();
    releaseStream();
    setTestStatus('grading');
    setErrorMsg(null);
    setGradingFailed(false);

    try {
      const res = await finishCefrTest(id);
      if (!mountedRef.current) return;
      setFeedback(res.feedback);
      setTestStatus('results');
      notifyHaptic('success');
    } catch (err: any) {
      if (!mountedRef.current) return;
      console.error('CEFR Grading error:', err);

      // Marking carries on server-side even when this request gives up waiting, and
      // the result is stored against the test — so one quiet retry usually collects a
      // finished evaluation rather than starting the work again.
      if (attempt < 2) {
        await new Promise((resolve) => window.setTimeout(resolve, 4000));
        if (!mountedRef.current) return;
        return handleFinishTest(attempt + 1);
      }

      setGradingFailed(true);
      setErrorMsg(err?.response?.data?.error || 'Natijalarni hisoblashda xatolik yuz berdi.');
    }
  };

  const handleAbandon = () => {
    if (!testId) return;
    if (!window.confirm('Imtihondan chiqmoqchimisiz? Ushbu urinish bekor qilinadi.')) return;
    haltStepMachine();
    return runAction('discard', async () => {
      tapHaptic('light');
      try {
        await abandonCefrTest(testId);
      } catch (err) {
        console.error('Abandon error:', err);
      }
      applyTestId(null);
      setActiveTestId(null);
      applyStep(null);
      pendingAnswerRef.current = null;
      setAnswerFailed(false);
      releaseStream();
      setTestStatus('idle');
      await fetchStatus();
    });
  };

  const getSupportedMimeType = (): string => {
    const types = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav'];
    for (const t of types) {
      if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return '';
  };

  const formatSecs = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Render CEFR Level Badge Color
  const getCefrBadgeStyle = (level?: string) => {
    const lvl = (level || 'B2').toUpperCase();
    if (lvl.includes('C1') || lvl.includes('C2')) {
      return { bg: 'linear-gradient(135deg, #10b981, #059669)', border: '#34d399', text: '#fff' };
    }
    if (lvl.includes('B2')) {
      return { bg: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', border: '#60a5fa', text: '#fff' };
    }
    if (lvl.includes('B1')) {
      return { bg: 'linear-gradient(135deg, #f59e0b, #d97706)', border: '#fbbf24', text: '#fff' };
    }
    return { bg: 'linear-gradient(135deg, #6b7280, #4b5563)', border: '#9ca3af', text: '#fff' };
  };

  return (
    <div className="im-container">
      {/* Top Navigation */}
      <MockHeader
        accent="cefr"
        title="CEFR Multilevel Mock"
        soundEnabled={soundEnabled}
        onBack={() => navigate('mock')}
        onToggleSound={toggleSound}
      />

      {/* The start screen carries its own error inside the card; the banner is for
          everything after it. */}
      {errorMsg && testStatus !== 'idle' && (
        <div className="im-error-banner" role="alert">
          <AlertTriangle size={18} aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 1. LOADING STATE — the status call decides what the card can say, so the card
          waits for it rather than showing numbers that change under the reader. */}
      {testStatus === 'idle' && loadingStatus && (
        <MockLoading accent="cefr" label={t('mock.preparing')} />
      )}

      {/* 2. IDLE / START SCREEN */}
      {testStatus === 'idle' && !loadingStatus && (
        <MockIntroCard
          accent="cefr"
          hero={<Award size={40} aria-hidden="true" />}
          title="CEFR Multilevel Speaking Mock"
          description="Milliy Sertifikat formati bo'yicha (Part 1.1, Part 1.2 Rasm tahlili, Part 2 B2, va Part 3 C1) to'liq AI topshirish va darajani aniqlash."
          details={[
            {
              icon: <Clock size={15} aria-hidden="true" />,
              label: 'Davomiyligi',
              value: estimatedMinutes ? t('mock.durationMins', { n: estimatedMinutes }) : t('mock.duration'),
            },
            {
              icon: <Award size={15} aria-hidden="true" />,
              label: 'Baholash',
              value: 'Max 75 ball (A1 - C1)',
            },
            {
              icon: <BookOpen size={15} aria-hidden="true" />,
              label: "Format & Bo'limlar",
              value: 'Part 1.1 (A1-A2) + Part 1.2 (Rasm) + Part 2 (B2) + Part 3 (C1)',
              wide: true,
            },
            {
              icon: <Sparkles size={15} aria-hidden="true" />,
              // Only the premium quota resets daily; the free one is a one-off trial.
              label: quota && !quota.isPremium ? t('mock.freeTrial') : t('mock.dailyLimit'),
              value: quota ? `${quota.remaining} / ${quota.limit} ta imtihon qoldi` : '—',
              wide: true,
            },
          ]}
          error={errorMsg}
          note={quota && quota.remaining <= 0 ? t('mock.quotaHint') : null}
          busy={busyAction}
          resume={
            activeTestId
              ? {
                  label: t('mock.resume'),
                  busyLabel: t('mock.opening'),
                  icon: <Sparkles size={18} aria-hidden="true" />,
                  onClick: () => loadActiveTest(activeTestId),
                }
              : undefined
          }
          start={
            activeTestId
              ? undefined
              : !quota
              ? {
                  // Nothing loaded, so there is nothing to start — offer the retry a
                  // dead start button would leave people without.
                  label: t('common.tryAgain'),
                  icon: <RotateCcw size={18} aria-hidden="true" />,
                  onClick: () => fetchStatus(),
                }
              : {
                  label: quota.remaining <= 0 ? t('mock.noQuota') : t('mock.startCefr'),
                  busyLabel: t('mock.starting'),
                  icon: <Sparkles size={18} aria-hidden="true" />,
                  onClick: handleStartTest,
                  disabled: quota.remaining <= 0,
                }
          }
          discard={
            activeTestId
              ? {
                  label: t('mock.discard'),
                  busyLabel: t('mock.discarding'),
                  onClick: handleAbandon,
                }
              : undefined
          }
        />
      )}

      {/* 3. TESTING STATE */}
      {testStatus === 'testing' && currentStep && (
        <div className="im-content im-test-box">
          {/* Progress Tracker */}
          <div className="im-progress-bar-wrap">
            <div className="im-progress-info">
              <span>{getPartBadgeText(String(currentStep.part), currentStep.kind)}</span>
              <span>{currentStep.i + 1} / {totalSteps}</span>
            </div>
            <div className="im-progress-bar">
              <div
                className="im-progress-fill"
                style={{ width: `${((currentStep.i + 1) / totalSteps) * 100}%`, background: '#10b981' }}
              />
            </div>
          </div>

          {/* Examiner Box Card */}
          <div className="im-examiner-box" style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '16px', padding: '14px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div className={`im-examiner-avatar${isSpeaking ? ' is-speaking' : ''}`} style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0, boxShadow: isSpeaking ? '0 0 12px rgba(16, 185, 129, 0.5)' : 'none' }}>
              <Mic2 size={22} aria-hidden="true" />
            </div>
            <div className="im-examiner-speech" style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="im-examiner-name" style={{ fontSize: '13px', fontWeight: 700, color: '#10b981' }}>AI Examiner</span>
                {isSpeaking && <span style={{ fontSize: '11px', color: '#34d399', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px' }}><Volume2 size={13} className="animate-pulse" /> savolni o'qimoqda...</span>}
              </div>
              {showTranscript ? (
                <p className="im-examiner-text" style={{ fontSize: '15px', margin: '4px 0 0 0', color: '#f8fafc', lineHeight: 1.5 }}>
                  {currentStep.say}
                </p>
              ) : (
                <p className="im-examiner-text" style={{ fontSize: '15px', margin: '4px 0 0 0', color: 'rgba(248,250,252,0.6)', fontStyle: 'italic', lineHeight: 1.5 }}>
                  {isSpeaking ? 'Examinerni tinglang…' : 'Endi javob bering.'}
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
                  <Volume2 size={13} aria-hidden="true" /> Qayta eshitish
                </button>
                <button
                  type="button"
                  className="im-mini-btn"
                  onClick={() => setShowTranscript((v) => !v)}
                >
                  {showTranscript ? 'Matnni yashirish' : 'Matnni koʻrsatish'}
                </button>
              </div>
            </div>
          </div>

          {/* Part 1.2 — two scenes to compare.
              Labelled by what is actually on screen: "Picture 1" next to nothing to
              look at contradicts the question, which asks about situations whenever
              the pool has no image for this pair. Real images drop in later and the
              labels follow automatically. */}
          {currentStep.pictures?.type === 'comparison' && (
            <div className="im-pictures-grid">
              {([
                { url: currentStep.pictures.pic1Url, alt: currentStep.pictures.pic1Alt, n: 1, letter: 'A' },
                { url: currentStep.pictures.pic2Url, alt: currentStep.pictures.pic2Alt, n: 2, letter: 'B' },
              ] as const).map((side) => (
                <div className="im-picture-card" key={side.n}>
                  <span className="im-pic-tag">
                    {side.url ? (
                      <>
                        <ImageIcon size={12} aria-hidden="true" /> {t('mock.picture', { n: side.n })}
                      </>
                    ) : (
                      <>
                        <Layers size={12} aria-hidden="true" /> {t('mock.situation', { letter: side.letter })}
                      </>
                    )}
                  </span>
                  {side.url ? <img src={side.url} alt={side.alt || ''} /> : null}
                  <p>{side.alt}</p>
                </div>
              ))}
            </div>
          )}

          {/* Part 2 — the scene the topic sits in. */}
          {currentStep.pictures?.type === 'contextual' && (
            <div className="im-picture-card im-picture-card--full">
              <span className="im-pic-tag">
                {currentStep.pictures.pic1Url ? (
                  <>
                    <ImageIcon size={12} aria-hidden="true" /> {t('mock.topicPicture')}
                  </>
                ) : (
                  <>
                    <Layers size={12} aria-hidden="true" /> {t('mock.context')}
                  </>
                )}
              </span>
              {currentStep.pictures.pic1Url ? (
                <img src={currentStep.pictures.pic1Url} alt={currentStep.pictures.pic1Alt || ''} />
              ) : null}
              <p>{currentStep.pictures.pic1Alt}</p>
            </div>
          )}

          {/* Question / Task Card */}
          <div className="im-question-card">
            <span className="im-part-tag">{getPartBadgeText(String(currentStep.part), currentStep.kind)}</span>
            {/* Parts 1.2 and 2 hand the candidate material to look at in the real exam,
                so their wording stays on screen. The spoken-only parts follow the
                transcript toggle instead of printing what the examiner just said. */}
            {(currentStep.pictures || currentStep.prompts || showTranscript) && (
              <h3 className="im-question-text">{currentStep.say}</h3>
            )}

            {/* Prompts list for Part 2 */}
            {currentStep.prompts && (
              <ul className="im-prompts-list">
                {currentStep.prompts.map((pr, idx) => (
                  <li key={idx}>• {pr}</li>
                ))}
              </ul>
            )}
          </div>

          {/* The examiner runs the exam: it speaks, then records, then moves on. The
              only controls the candidate needs are finishing early, asking for a
              repeat, and getting out — plus a way back when something goes wrong. */}
          {answerFailed ? (
            <div className="im-retry-controls">
              <button className="im-rec-btn im-rec-btn--retry" onClick={retryAnswer}>
                <RotateCcw size={20} />
                <span>Javobni qayta yuborish</span>
              </button>
              <button className="im-mini-btn" onClick={skipAnswer}>
                Bu savolni o'tkazib yuborish
              </button>
            </div>
          ) : submittingAnswer ? (
            <div className="im-submitting-box">
              <div className="im-spinner" />
              <span>Javobingiz yuborilmoqda...</span>
            </div>
          ) : isPrepping ? (
            <div className="im-prep-card">
              <Clock size={24} className="animate-spin text-emerald-400" />
              <div style={{ flex: 1 }}>
                <h4>Tayyorgarlik vaqti: {prepTimeLeft} soniya</h4>
                <p>{t('mock.notesHint')}</p>
                <button className="im-mini-btn" onClick={skipPrep} style={{ marginTop: '8px' }}>
                  <Mic size={13} aria-hidden="true" /> Tayyorman, boshlayman
                </button>
              </div>
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
                  <span>Javobni tugatdim</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="im-waiting-note">
              {isSpeaking ? (
                <>
                  <Volume2 size={15} aria-hidden="true" />
                  <span>Examiner gapirmoqda…</span>
                </>
              ) : (
                <>
                  <Mic size={15} aria-hidden="true" />
                  <span>Tayyorlanmoqda…</span>
                </>
              )}
            </div>
          )}

          <button className="im-abandon-link" onClick={handleAbandon}>
            Imtihonni bekor qilish
          </button>
        </div>
      )}

      {/* 4. GRADING / EVALUATING STATE */}
      {testStatus === 'grading' && !gradingFailed && (
        <MockLoading accent="cefr" label="Natijalar baholanmoqda…" sublabel={t('mock.cefrGrading')} />
      )}

      {testStatus === 'grading' && gradingFailed && (
        <div className="im-content">
          {/* Grading failure used to drop the candidate back onto the test screen with
              an error and no way to ask for the result again. The answers are safe on
              the server, so this retries the marking, not the exam. */}
          <p className="im-grading-note">
            Javoblaringiz saqlangan. Baholashni qaytadan boshlash uchun bosing.
          </p>
          <div className="im-retry-controls">
            <button className="im-rec-btn im-rec-btn--retry" onClick={() => void handleFinishTest()}>
              <RotateCcw size={20} />
              <span>Baholashni qayta urinish</span>
            </button>
            <button className="im-mini-btn" onClick={() => navigate('mock')}>
              Keyinroq qaytaman
            </button>
          </div>
        </div>
      )}

      {/* 5. RESULTS STATE */}
      {testStatus === 'results' && feedback && (
        <div className="im-content im-results-card">
          {/* Header Score Badge */}
          <div className="im-result-header" style={{ background: getCefrBadgeStyle(feedback.cefrLevel).bg }}>
            <span className="im-result-title">🇺🇿 CEFR Multilevel Speaking Mock Result</span>
            <div className="im-score-circle">
              <span className="im-score-val">{feedback.cefrLevel}</span>
              <span className="im-score-sub">{feedback.estimatedScore}</span>
            </div>
          </div>

          {/* Part-by-Part Breakdown */}
          {feedback.partPerformance && (
            <div className="im-section">
              <h3 className="im-section-title">
                <BookOpen size={18} />
                <span>Bo'limlar bo'yicha ko'rsatkichlar (Part Performance)</span>
              </h3>
              <div className="im-subscores-grid">
                <div className="im-subscore-item">
                  <div className="im-subscore-head">
                    <span className="im-subscore-name">Part 1.1 (A1-A2)</span>
                    <span className="im-subscore-band">{feedback.partPerformance.part1_1?.score}</span>
                  </div>
                  <p className="im-subscore-comment">{feedback.partPerformance.part1_1?.comment}</p>
                </div>
                <div className="im-subscore-item">
                  <div className="im-subscore-head">
                    <span className="im-subscore-name">Part 1.2 (B1 Rasm)</span>
                    <span className="im-subscore-band">{feedback.partPerformance.part1_2?.score}</span>
                  </div>
                  <p className="im-subscore-comment">{feedback.partPerformance.part1_2?.comment}</p>
                </div>
                <div className="im-subscore-item">
                  <div className="im-subscore-head">
                    <span className="im-subscore-name">Part 2 (B2 Topic)</span>
                    <span className="im-subscore-band">{feedback.partPerformance.part2?.score}</span>
                  </div>
                  <p className="im-subscore-comment">{feedback.partPerformance.part2?.comment}</p>
                </div>
                <div className="im-subscore-item">
                  <div className="im-subscore-head">
                    <span className="im-subscore-name">Part 3 (C1 Discussion)</span>
                    <span className="im-subscore-band">{feedback.partPerformance.part3?.score}</span>
                  </div>
                  <p className="im-subscore-comment">{feedback.partPerformance.part3?.comment}</p>
                </div>
              </div>
            </div>
          )}

          {/* Skills Breakdown */}
          {feedback.skills && (
            <div className="im-section">
              <h3 className="im-section-title">
                <Award size={18} />
                <span>Ko'nikmalar bo'yicha baholar (Skills)</span>
              </h3>
              <div className="im-subscores-grid">
                <div className="im-subscore-item">
                  <div className="im-subscore-head">
                    <span className="im-subscore-name">Fluency & Coherence</span>
                    <span className="im-subscore-band">{feedback.skills.fluency?.score}</span>
                  </div>
                  <p className="im-subscore-comment">{feedback.skills.fluency?.comment}</p>
                </div>
                <div className="im-subscore-item">
                  <div className="im-subscore-head">
                    <span className="im-subscore-name">Vocabulary</span>
                    <span className="im-subscore-band">{feedback.skills.vocabulary?.score}</span>
                  </div>
                  <p className="im-subscore-comment">{feedback.skills.vocabulary?.comment}</p>
                </div>
                <div className="im-subscore-item">
                  <div className="im-subscore-head">
                    <span className="im-subscore-name">Grammar</span>
                    <span className="im-subscore-band">{feedback.skills.grammar?.score}</span>
                  </div>
                  <p className="im-subscore-comment">{feedback.skills.grammar?.comment}</p>
                </div>
                <div className="im-subscore-item">
                  <div className="im-subscore-head">
                    <span className="im-subscore-name">Pronunciation</span>
                    <span className="im-subscore-band">{feedback.skills.pronunciation?.score}</span>
                  </div>
                  <p className="im-subscore-comment">{feedback.skills.pronunciation?.comment}</p>
                </div>
              </div>
            </div>
          )}

          {/* Strengths & Weaknesses */}
          <div className="im-subscores-grid">
            {feedback.strengths && feedback.strengths.length > 0 && (
              <div className="im-subscore-item" style={{ borderLeft: '3px solid #10b981' }}>
                <div className="im-subscore-head">
                  <span className="im-subscore-name" style={{ color: '#10b981' }}><ThumbsUp size={13} aria-hidden="true" /> {t('mock.strongPoints')}</span>
                </div>
                <ul style={{ margin: '6px 0 0', paddingLeft: '18px', fontSize: '14px', lineHeight: '1.6', color: 'rgba(255,255,255,0.9)' }}>
                  {feedback.strengths.map((st, idx) => (
                    <li key={idx}>{st}</li>
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
                  {feedback.weaknesses.map((wk, idx) => (
                    <li key={idx}>{wk}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Actionable Improvement Plan */}
          {feedback.improvementPlan && feedback.improvementPlan.length > 0 && (
            <div className="im-advice-card">
              <h3><Lightbulb size={14} aria-hidden="true" /> {t('mock.actionPlan')}</h3>
              <ol style={{ margin: '8px 0 0', paddingLeft: '20px', fontSize: '15px', lineHeight: '1.65' }}>
                {feedback.improvementPlan.map((plan, idx) => (
                  <li key={idx}>{plan}</li>
                ))}
              </ol>
            </div>
          )}

          {/* Actions */}
          <div className="im-actions">
            <button
              className="im-btn im-btn--primary"
              onClick={() => {
                setTestStatus('idle');
                fetchStatus();
              }}
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
            >
              <RotateCcw size={18} />
              <span>{t('mock.retakeCefr')}</span>
            </button>
            <button className="im-btn im-btn--ghost" onClick={() => navigate('mock')}>
              <span>Bosh sahifaga qaytish</span>
            </button>
          </div>
        </div>
      )}

      <style>{`
        .im-container {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          background: #090d16;
          color: #ffffff;
          font-family: inherit;
          padding-bottom: env(safe-area-inset-bottom, 16px);
        }

        .im-error-banner {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin: 12px 16px 0;
          padding: 10px 12px;
          border-radius: 12px;
          background: rgba(239, 68, 68, 0.14);
          border: 1px solid rgba(239, 68, 68, 0.30);
          color: #fca5a5;
          font-size: 12.5px;
          line-height: 1.45;
        }
        .im-error-banner svg { flex-shrink: 0; margin-top: 1px; }

        .im-content {
          flex: 1;
          padding: 16px;
          display: flex;
          flex-direction: column;
          max-width: 500px;
          margin: 0 auto;
          width: 100%;
          box-sizing: border-box;
        }

        .im-spinner {
          width: 44px;
          height: 44px;
          border: 3px solid rgba(16, 185, 129, 0.2);
          border-top-color: #10b981;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .im-btn {
          width: 100%;
          min-height: 52px;
          border-radius: 16px;
          font-size: 15px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: none;
          cursor: pointer;
          transition: transform 0.15s ease, opacity 0.15s ease;
        }
        .im-btn:active { transform: scale(0.97); }
        .im-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .im-btn--primary {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: #ffffff;
          box-shadow: 0 4px 20px rgba(16, 185, 129, 0.35);
        }
        .im-btn--ghost {
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.15);
        }

        .im-test-box {
          display: flex;
          flex-direction: column;
          gap: 16px;
          width: 100%;
        }

        .im-progress-bar-wrap {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .im-progress-info {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          font-weight: 700;
          color: #94a3b8;
        }
        .im-progress-bar {
          height: 8px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 4px;
          overflow: hidden;
        }
        .im-progress-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .im-examiner-speaking {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(16, 185, 129, 0.12);
          border: 1px solid rgba(16, 185, 129, 0.3);
          padding: 10px 14px;
          border-radius: 12px;
          color: #10b981;
          font-size: 13px;
          font-weight: 600;
        }

        .im-pictures-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        /* Real exam images drop straight in once the pool carries URLs; until then the
           caption alone is shown and the question asks about "situations", not pictures. */
        .im-picture-card img,
        .im-picture-single img {
          display: block;
          width: 100%;
          aspect-ratio: 4 / 3;
          object-fit: cover;
          border-radius: 8px;
          margin: 6px 0;
          background: rgba(255, 255, 255, 0.06);
        }
        .im-picture-card {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 14px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .im-picture-card--full {
          width: 100%;
        }
        .im-pic-tag {
          font-size: 10px;
          font-weight: 800;
          color: #10b981;
          background: rgba(16, 185, 129, 0.15);
          padding: 2px 6px;
          border-radius: 6px;
          width: fit-content;
        }
        .im-picture-card p {
          font-size: 12px;
          color: #cbd5e1;
          margin: 0;
          line-height: 1.4;
        }

        .im-question-card {
          background: linear-gradient(145deg, rgba(16, 24, 38, 0.9), rgba(10, 16, 26, 0.95));
          border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: 20px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .im-part-tag {
          font-size: 11px;
          font-weight: 800;
          color: #10b981;
          letter-spacing: 0.5px;
        }
        .im-question-text {
          font-size: 17px;
          font-weight: 700;
          color: #ffffff;
          line-height: 1.45;
          margin: 0;
        }
        .im-prompts-list {
          margin: 6px 0 0;
          padding: 0;
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 13px;
          color: #94a3b8;
        }

        .im-prep-card {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(245, 158, 11, 0.12);
          border: 1px solid rgba(245, 158, 11, 0.3);
          padding: 14px;
          border-radius: 16px;
          color: #f59e0b;
        }
        .im-prep-card h4 {
          font-size: 14px;
          font-weight: 800;
          margin: 0 0 2px 0;
        }
        .im-prep-card p {
          font-size: 12px;
          margin: 0;
          opacity: 0.9;
        }

        .im-submitting-box {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          font-size: 14px;
          font-weight: 600;
        }

        .im-recording-controls {
          width: 100%;
        }
        .im-rec-btn {
          width: 100%;
          min-height: 54px;
          border-radius: 16px;
          border: none;
          font-size: 16px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          cursor: pointer;
          transition: transform 0.15s ease;
        }
        .im-rec-btn:active { transform: scale(0.97); }
        .im-rec-btn--start {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: #ffffff;
          box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4);
        }
        .im-rec-btn--stop {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: #ffffff;
          box-shadow: 0 4px 20px rgba(239, 68, 68, 0.4);
        }
        .im-rec-btn--retry {
          background: linear-gradient(135deg, #34d399 0%, #059669 100%);
          color: #04231a;
          box-shadow: 0 4px 20px rgba(52, 211, 153, 0.35);
        }

        .im-retry-controls {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 10px;
          align-items: center;
        }
        .im-mini-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 7px 12px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.06);
          color: rgba(255, 255, 255, 0.78);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .im-mini-btn:disabled { opacity: 0.45; cursor: default; }
        .im-waiting-note {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          min-height: 48px;
          color: rgba(255, 255, 255, 0.6);
          font-size: 13px;
          font-weight: 600;
        }
        .im-grading-note {
          margin: 12px 0;
          font-size: 13px;
          line-height: 1.6;
          text-align: center;
          color: rgba(255, 255, 255, 0.7);
        }

        .im-rec-active {
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: center;
        }
        .im-rec-timer {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 18px;
          font-weight: 800;
          color: #ef4444;
        }
        .im-rec-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #ef4444;
          animation: dotPulse 1s infinite;
        }
        @keyframes dotPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

        .im-abandon-link {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.4);
          font-size: 12px;
          padding: 8px;
          cursor: pointer;
          text-align: center;
          margin-top: 8px;
        }

        .im-error-box {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
          padding: 12px 14px;
          border-radius: 14px;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 14px;
          width: 100%;
        }

        .im-results-card {
          display: flex;
          flex-direction: column;
          gap: 16px;
          width: 100%;
        }
        .im-result-header {
          border-radius: 20px;
          padding: 24px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 12px;
        }
        .im-result-title {
          font-size: 14px;
          font-weight: 800;
          color: #ffffff;
        }
        .im-score-circle {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .im-score-val {
          font-size: 48px;
          font-weight: 900;
          color: #ffffff;
          line-height: 1;
        }
        .im-score-sub {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.8);
          font-weight: 700;
        }

        /* One per row: two columns left each comment in a column too narrow to
           read, breaking the sentences into a word or two per line. */
        .im-examiner-actions { display: flex; gap: 6px; margin-top: 8px; }

        .im-section { display: flex; flex-direction: column; gap: 10px; }
        .im-section-title {
          font-size: 15px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #10b981;
          margin: 0;
        }

        .im-subscores-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        .im-subscore-item {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .im-subscore-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .im-subscore-name {
          font-size: 13px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.72);
        }
        .im-subscore-band {
          font-size: 20px;
          font-weight: 800;
          color: #10b981;
        }
        .im-subscore-comment {
          font-size: 14px;
          line-height: 1.65;
          color: rgba(255, 255, 255, 0.88);
          margin: 0;
        }

        .im-advice-card {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 16px;
        }
        .im-advice-card h3 {
          font-size: 15px;
          font-weight: 800;
          color: #ffffff;
          margin: 0 0 6px 0;
        }
        .im-actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 10px;
        }
      `}</style>
    </div>
  );
}
