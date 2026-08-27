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
import { MockHeader, MockIntroCard, MockLoading, type MockBusyAction } from '../components/MockIntro';
import { AlertCircle, AlertTriangle, ArrowLeft, Award, BookOpen, CheckCircle2, ChevronRight, Clock, Lightbulb, Mic, Mic2, MicOff, PenLine, RotateCcw, Sparkles, ThumbsUp, Volume2, VolumeX } from 'lucide-react';

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
  strongPoints?: string[];
  mainProblems?: string[];
  fixes?: Array<{ said: string; better: string; why: string }>;
  advice?: string;
  betterAnswer?: { original: string; improved: string; explanation: string };
}

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

  // Which start-screen button is mid-flight, so it can say so instead of sitting
  // there looking untapped.
  const [busyAction, setBusyAction] = useState<MockBusyAction>(null);

  useEffect(() => {
    fetchStatus();
    return () => {
      stopRecordingSilently();
      stopPrepTimer();
      stopSpeech();
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
      setTestId(data.active);
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

  const loadActiveTest = (id: string) =>
    runAction('resume', async () => {
      tapHaptic('medium');
      setErrorMsg(null);
      try {
        const data = await getIeltsTest(id);
        if (data.status === 'active' && data.step) {
          setTestId(id);
          setCurrentStep(data.step);
          setTotalSteps(data.total || 0);
          setEstimatedMinutes(data.estimatedMinutes || 0);
          setStepIndex(data.step.i || 0);
          setTestStatus('testing');
          beginStep(data.step);
        } else if (data.feedback) {
          setFeedback(data.feedback);
          setTestStatus('results');
        }
      } catch (err: any) {
        console.error('Failed to load active test', err);
        setErrorMsg(err.response?.data?.error || 'Could not open your test. Please try again.');
      }
    });

  const handleStartTest = () =>
    runAction('start', async () => {
      tapHaptic('medium');
      setErrorMsg(null);
      try {
        const data = await startIeltsTest({ mode: 'full' });
        setTestId(data.testId);
        setCurrentStep(data.step);
        setTotalSteps(data.total || 0);
        setEstimatedMinutes(data.estimatedMinutes || 0);
        setStepIndex(0);
        setTestStatus('testing');
        beginStep(data.step);
      } catch (err: any) {
        console.error('Failed to start test', err);
        const msg = err.response?.data?.error || 'Could not start the test. Please try again.';
        setErrorMsg(msg);
      }
    });

  const handleAbandon = () => {
    if (!testId) return;
    stopSpeech();
    stopRecordingSilently();
    stopPrepTimer();
    return runAction('discard', async () => {
      tapHaptic('light');
      try {
        await abandonIeltsTest(testId);
      } catch (err) {}
      setTestId(null);
      setCurrentStep(null);
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

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Speech synthesis for AI Examiner voice (High Quality AI Voice TTS with Web Speech API fallback)
  const speakText = async (text?: string, onDone?: () => void) => {
    if (!text) return;
    // With sound off or unmounted there is nothing to wait for, so hand control straight back.
    if (!soundEnabled || !mountedRef.current) {
      onDone?.();
      return;
    }
    stopSpeech();
    speechTokenRef.current += 1;
    const token = speechTokenRef.current;

    try {
      const res = await getTTSAudio(text);
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
  const startRecording = async () => {
    stopSpeech();
    tapHaptic('medium');
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/aac';

      const recorder = new MediaRecorder(stream, { mimeType });
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

      const maxMs = (currentStep?.maxSec || 60) * 1000;
      recordTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - recordingStartTimeRef.current;
        setRecordingMs(elapsed);
        if (elapsed >= maxMs) {
          clearInterval(recordTimerRef.current);
          // A real examiner cuts you off out loud rather than the recording just
          // stopping. Submission waits for that line so it does not clip it.
          speakText('Thank you.', () => stopRecordingAndSend());
        }
      }, 200);
    } catch (err: any) {
      console.error('Mic access error:', err);
      setErrorMsg('Microphone access was refused. Allow it in your settings to take the test.');
    }
  };

  const stopRecordingAndSend = async () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    tapHaptic('medium');
    stopSpeech();

    const duration = Date.now() - recordingStartTimeRef.current;
    clearInterval(recordTimerRef.current);
    setIsRecording(false);
    isRecordingRef.current = false;
    setSubmittingAnswer(true);

    const recorder = mediaRecorderRef.current;

    await new Promise<void>((resolve) => {
      recorder.onstop = () => {
        recorder.stream.getTracks().forEach((track) => track.stop());
        resolve();
      };
      recorder.stop();
    });

    const blob = new Blob(audioChunksRef.current, {
      type: recorder.mimeType || 'audio/webm',
    });

    await submitAnswer(blob, duration);
  };

  const stopRecordingSilently = () => {
    if (mediaRecorderRef.current && isRecording) {
      try {
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    clearInterval(recordTimerRef.current);
    setIsRecording(false);
    isRecordingRef.current = false;
  };

  const submitAnswer = async (blob: Blob | null, durationMs: number) => {
    if (!testId || !currentStep) return;
    setErrorMsg(null);

    try {
      const res = await sendIeltsAnswer(testId, currentStep.i, blob, durationMs);
      setSubmittingAnswer(false);

      if (res.done) {
        // All steps finished -> trigger finish & grading!
        finishTestGrading();
      } else if (res.step) {
        setCurrentStep(res.step);
        setStepIndex(res.step.i);
        setRecordingMs(0);
        speakText(res.step.say || res.step.cardSay);
      }
    } catch (err: any) {
      setSubmittingAnswer(false);
      console.error('Failed to submit answer:', err);
      const msg = err.response?.data?.error || 'Javobni yuborishda xatolik. Qaytadan urinib ko\'ring.';
      setErrorMsg(msg);
    }
  };

  const handleNextFrame = async () => {
    tapHaptic('light');
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
    const spoken = step.say || step.cardSay;

    speakText(spoken, () => {
      if (!mountedRef.current) return;

      if (step.kind === 'cue') {
        // The card is on screen; the preparation minute starts by itself.
        startPrepTimer();
        return;
      }
      if (step.kind === 'frame' || step.kind === 'closing') {
        // Examiner framing needs no answer — move on rather than waiting for a tap.
        window.setTimeout(() => { if (mountedRef.current) handleNextFrame(); }, 700);
        return;
      }
      // A short beat, then the microphone opens.
      window.setTimeout(() => {
        if (mountedRef.current && !isRecordingRef.current) startRecording();
      }, 400);
    });
  };

  // ── Part 2 Cue Card Timer ──
  const startPrepTimer = () => {
    if (isPreppingRef.current) return;
    setIsPrepping(true);
    isPreppingRef.current = true;
    setPrepTimeLeft(60);

    prepTimerRef.current = setInterval(() => {
      setPrepTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(prepTimerRef.current);
          setIsPrepping(false);
          isPreppingRef.current = false;
          notifyHaptic('success');
          // Speak start signal when prep time ends
          if (currentStep?.startSay) {
            speakText(currentStep.startSay, () => {
              if (mountedRef.current && !isRecordingRef.current) startRecording();
            });
          } else if (mountedRef.current && !isRecordingRef.current) {
            startRecording();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopPrepTimer = () => {
    if (prepTimerRef.current) {
      clearInterval(prepTimerRef.current);
      prepTimerRef.current = null;
    }
    setIsPrepping(false);
  };

  // ── Test Finish & AI Marking ──
  const finishTestGrading = async () => {
    if (!testId) return;
    stopSpeech();
    setTestStatus('grading');

    try {
      const res = await finishIeltsTest(testId);
      setFeedback(res.feedback);
      setTestStatus('results');
      notifyHaptic('success');
    } catch (err: any) {
      console.error('Grading error:', err);
      setTestStatus('testing');
      const msg = err.response?.data?.error || 'Baholashda xatolik yuz berdi. Qaytadan urinib ko\'ring.';
      setErrorMsg(msg);
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
    if (part === 1) return 'PART 1 • Kirish & Shaxsiy Savollar';
    if (part === 2) return 'PART 2 • Cue Card Topshirig\'i';
    if (part === 3) return 'PART 3 • Erkin Muhokama & Tahlil';
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
          description="A full IELTS Speaking test — Part 1, the Part 2 cue card and the Part 3 discussion — marked by an AI examiner on the four official criteria."
          details={[
            {
              icon: <Clock size={15} aria-hidden="true" />,
              label: 'Davomiyligi',
              value: estimatedMinutes ? t('mock.durationMins', { n: estimatedMinutes }) : t('mock.duration'),
            },
            {
              icon: <Award size={15} aria-hidden="true" />,
              label: 'Baholash',
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
              label: 'Kunlik Limit',
              value: status ? `${status.remaining} / ${status.limit} ta imtihon qoldi` : '—',
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
                  onClick={() => speakText(currentStep.say || currentStep.cardSay)}
                  disabled={isSpeaking}
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
                <div className="im-prep-timer__info">
                  <Clock size={16} />
                  <span>Preparation: </span>
                  <strong className="im-prep-timer__time">{prepTimeLeft}s</strong>
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
            {submittingAnswer ? (
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
                  <button className="im-rec-btn im-rec-btn--stop" onClick={stopRecordingAndSend}>
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
    return (
      <div className="im-page">
        <MockLoading
          accent="ielts"
          label="AI Examiner baholamoqda…"
          sublabel="Your answers are being marked on Fluency, Lexical Resource, Grammar and Pronunciation. This takes a moment."
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

          {/* Strong Points & Main Problems */}
          {((feedback.strongPoints && feedback.strongPoints.length > 0) || (feedback.mainProblems && feedback.mainProblems.length > 0)) && (
            <div className="im-subscores-grid">
              {feedback.strongPoints && feedback.strongPoints.length > 0 && (
                <div className="im-subscore-item" style={{ borderLeft: '3px solid #10b981' }}>
                  <div className="im-subscore-head">
                    <span className="im-subscore-name" style={{ color: '#10b981' }}><ThumbsUp size={13} aria-hidden="true" /> {t('mock.strongPoints')}</span>
                  </div>
                  <ul style={{ margin: '4px 0 0', paddingLeft: '16px', fontSize: '11px', lineHeight: '1.5', color: 'rgba(255,255,255,0.9)' }}>
                    {feedback.strongPoints.map((pt, idx) => (
                      <li key={idx}>{pt}</li>
                    ))}
                  </ul>
                </div>
              )}
              {feedback.mainProblems && feedback.mainProblems.length > 0 && (
                <div className="im-subscore-item" style={{ borderLeft: '3px solid #ef4444' }}>
                  <div className="im-subscore-head">
                    <span className="im-subscore-name" style={{ color: '#ef4444' }}><AlertTriangle size={13} aria-hidden="true" /> {t('mock.mainProblems')}</span>
                  </div>
                  <ul style={{ margin: '4px 0 0', paddingLeft: '16px', fontSize: '11px', lineHeight: '1.5', color: 'rgba(255,255,255,0.9)' }}>
                    {feedback.mainProblems.map((pr, idx) => (
                      <li key={idx}>{pr}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Better Answer Example */}
          {feedback.betterAnswer && (
            <div className="im-advice-card" style={{ background: 'rgba(56, 189, 248, 0.08)', borderColor: 'rgba(56, 189, 248, 0.25)' }}>
              <h3 style={{ color: '#38bdf8' }}><PenLine size={14} aria-hidden="true" /> {t('mock.betterAnswer')}</h3>
              <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div><strong style={{ color: '#fca5a5' }}>Original:</strong> "{feedback.betterAnswer.original}"</div>
                <div><strong style={{ color: '#86efac' }}>Improved (Band 7.5+):</strong> "{feedback.betterAnswer.improved}"</div>
                {feedback.betterAnswer.explanation && (
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontStyle: 'italic' }}>
                    Tahlil: {feedback.betterAnswer.explanation}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Fixes & Corrections */}
          {feedback.fixes && feedback.fixes.length > 0 && (
            <div className="im-section">
              <h3 className="im-section-title">
                <CheckCircle2 size={18} />
                <span>Xatolar tahlili va yaxshiroq iboralar (Fixes)</span>
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
          {feedback.advice && (
            <div className="im-advice-card">
              <h3><Lightbulb size={14} aria-hidden="true" /> {t('mock.advice')}</h3>
              <p>{feedback.advice}</p>
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
    background: var(--bg, #090d16); color: #fff;
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
    padding: 3px 8px; border-radius: 99px; font-size: 10px; font-weight: 700;
  }
  .im-avatar-wrapper { position: relative; width: 64px; height: 64px; }
  .im-avatar {
    width: 64px; height: 64px; border-radius: 50%; background: #fff;
    display: flex; align-items: center; justify-content: center; font-size: 30px;
  }
  .im-title { font-size: 20px; font-weight: 800; margin: 0; }
  .im-desc { font-size: 13px; line-height: 1.5; color: rgba(255,255,255,0.9); margin: 0; }

  .im-quota-card {
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 16px; padding: 14px 16px; display: flex; flex-direction: column; gap: 6px;
  }
  .im-quota-info { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
  .im-quota-label { color: rgba(255,255,255,0.6); }
  .im-quota-value { font-weight: 700; color: #38bdf8; }
  .im-quota-hint { font-size: 11px; color: rgba(255,255,255,0.4); margin: 0; line-height: 1.4; }

  .im-error-box {
    background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5; padding: 10px 14px; border-radius: 12px; font-size: 13px;
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
  .im-btn--ghost { background: rgba(255,255,255,0.08); color: #fff; }

  /* Progress Bar */
  .im-progress {
    position: relative; background: rgba(255,255,255,0.06); height: 28px;
    display: flex; align-items: center; padding: 0 14px; overflow: hidden;
  }
  .im-progress__bar {
    position: absolute; left: 0; top: 0; bottom: 0; background: #0284c7;
    transition: width 0.3s ease; opacity: 0.4;
  }
  .im-progress__info {
    position: relative; z-index: 1; width: 100%; display: flex; justify-content: space-between;
    font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.8);
  }

  /* Test Interface */
  .im-test-container {
    padding: 16px; display: flex; flex-direction: column; gap: 16px; flex: 1; max-width: 500px; margin: 0 auto; width: 100%;
  }
  .im-examiner-box {
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 18px; padding: 16px; display: flex; gap: 14px; align-items: flex-start;
  }
  .im-examiner-avatar {
    width: 44px; height: 44px; border-radius: 50%; background: #0284c7;
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
  .im-examiner-text { font-size: 15px; line-height: 1.5; margin: 0; color: #fff; }

  .im-cue-card {
    background: linear-gradient(145deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.9) 100%);
    border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 18px; padding: 18px;
    display: flex; flex-direction: column; gap: 12px;
  }
  .im-cue-card__header { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: #38bdf8; }
  .im-cue-card__title { font-size: 16px; font-weight: 700; margin: 0; color: #fff; line-height: 1.4; }
  .im-cue-card__bullets { background: rgba(0,0,0,0.2); padding: 12px 14px; border-radius: 12px; }
  .im-cue-card__bullets-title { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.6); margin: 0 0 6px; }
  .im-cue-card__bullets ul { margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.6; }

  .im-prep-timer {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    background: rgba(255,255,255,0.05); padding: 10px 12px; border-radius: 12px;
  }
  .im-prep-timer__info { font-size: 12px; display: flex; align-items: center; gap: 6px; }
  .im-prep-timer__time { font-size: 15px; color: #38bdf8; }
  .im-prep-btn {
    background: #0284c7; color: #fff; border: none; padding: 6px 12px; border-radius: 8px;
    font-size: 12px; font-weight: 700; cursor: pointer;
  }
  .im-prep-active { font-size: 11px; color: #f59e0b; font-weight: 600; }

  .im-controls { margin-top: auto; display: flex; flex-direction: column; gap: 12px; }
  .im-loading-answer {
    display: flex; align-items: center; justify-content: center; gap: 10px; padding: 16px;
    background: rgba(255,255,255,0.05); border-radius: 14px; font-size: 14px; font-weight: 600;
  }
  .im-spinner {
    width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.2);
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
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12);
    color: rgba(255,255,255,0.75);
    font-size: 11px; font-weight: 700;
  }
  .im-mini-btn:disabled { opacity: 0.4; }
  .im-notes {
    width: 100%; margin-top: 10px; padding: 10px;
    border-radius: 10px; resize: vertical;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.12);
    color: #fff; font-size: 13px; line-height: 1.5;
  }
  .im-notes::placeholder { color: rgba(255,255,255,0.35); }
  .im-waiting-note {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    width: 100%; min-height: 48px;
    color: rgba(255,255,255,0.6); font-size: 13px; font-weight: 600;
  }
  .im-rec-btn {
    width: 100%; min-height: 52px; border-radius: 16px; border: none; font-size: 15px; font-weight: 700;
    display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer;
    transition: transform 0.1s;
  }
  .im-rec-btn:active { transform: scale(0.98); }
  .im-rec-btn--start { background: #10b981; color: #fff; box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3); }
  .im-rec-btn--stop { background: #ef4444; color: #fff; box-shadow: 0 4px 16px rgba(239, 68, 68, 0.3); }

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
    background: none; border: none; color: rgba(255,255,255,0.4); font-size: 12px;
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
  .im-overall-badge { font-size: 11px; font-weight: 800; color: #38bdf8; letter-spacing: 1px; }
  .im-score-num { font-size: 54px; font-weight: 900; line-height: 1; color: #fff; }
  .im-score-text { font-size: 13px; color: rgba(255,255,255,0.8); margin: 4px 0 0; }

  .im-subscores-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .im-subscore-item {
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px; padding: 12px; display: flex; flex-direction: column; gap: 6px;
  }
  .im-subscore-head { display: flex; justify-content: space-between; align-items: center; }
  .im-subscore-name { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.6); }
  .im-subscore-band { font-size: 16px; font-weight: 800; color: #38bdf8; }
  .im-subscore-comment { font-size: 11px; line-height: 1.4; color: rgba(255,255,255,0.8); margin: 0; }

  .im-section { display: flex; flex-direction: column; gap: 10px; }
  .im-section-title {
    font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 8px; color: #10b981; margin: 0;
  }
  .im-fixes-list { display: flex; flex-direction: column; gap: 8px; }
  .im-fix-card {
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px; padding: 12px; display: flex; flex-direction: column; gap: 6px; font-size: 12px;
  }
  .im-fix-said { color: #fca5a5; }
  .im-fix-better { color: #86efac; }
  .im-fix-label { font-weight: 700; margin-right: 6px; opacity: 0.8; }
  .im-fix-card p { margin: 2px 0 0; font-weight: 600; }
  .im-fix-why { font-size: 11px; color: rgba(255,255,255,0.5); font-style: italic; }

  .im-advice-card {
    background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.25);
    border-radius: 16px; padding: 14px 16px; display: flex; flex-direction: column; gap: 6px;
  }
  .im-advice-card h3 { font-size: 13px; font-weight: 700; color: #f59e0b; margin: 0; }
  .im-advice-card p { font-size: 13px; line-height: 1.5; color: rgba(255,255,255,0.9); margin: 0; }
`;
