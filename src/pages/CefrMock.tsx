import React, { useState, useEffect, useRef } from 'react';
import { useT } from '../i18n';
import { AlertTriangle, ArrowLeft, Award, BookOpen, CheckCircle2, ChevronRight, Clock, HelpCircle, Image as ImageIcon, Layers, Lightbulb, Mic, Mic2, MicOff, RotateCcw, Sparkles, ThumbsUp, Volume2, VolumeX } from 'lucide-react';
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
import { MockHeader, MockIntroCard, MockLoading, type MockBusyAction } from '../components/MockIntro';

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
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    fetchStatus();
    return () => {
      stopSpeech();
      clearTimers();
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
        setTestId(res.activeTest.id);
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
      try {
        const res = await getCefrTest(id);
        if (res.status === 'completed' && res.feedback) {
          setFeedback(res.feedback);
          setTestStatus('results');
        } else if (res.step) {
          setTestId(res.testId);
          setTotalSteps(res.totalSteps || 9);
          setEstimatedMinutes(res.estimatedMinutes || 0);
          setCurrentStep(res.step);
          setTestStatus('testing');
          handleStepTransition(res.step);
        }
      } catch (err: any) {
        console.error('Load active test error:', err);
        setErrorMsg(err?.response?.data?.error || 'Imtihonni yuklashda xatolik.');
      }
    });

  const handleStartTest = () =>
    runAction('start', async () => {
      tapHaptic('medium');
      setErrorMsg(null);
      try {
        const res = await createCefrTest('full');
        setTestId(res.testId);
        setActiveTestId(res.testId);
        setTotalSteps(res.totalSteps || 9);
        setEstimatedMinutes(res.estimatedMinutes || 0);
        setCurrentStep(res.step);
        setTestStatus('testing');

        if (res.step) {
          handleStepTransition(res.step);
        }
      } catch (err: any) {
        console.error('Start CEFR test error:', err);
        const msg = err?.response?.data?.error || 'Imtihonni boshlashda xatolik yuz berdi.';
        setErrorMsg(msg);
      }
    });

  const handleStepTransition = (step: StepData) => {
    clearTimers();
    setIsRecording(false);
    setRecordingMs(0);

    // Speak question text if sound enabled
    if (soundEnabled && step.say) {
      speakText(step.say);
    }

    // Check if step requires prep timer (Part 2 or Part 3 task frame)
    if (step.prepSec && step.prepSec > 0) {
      startPrepTimer(step.prepSec);
    } else {
      setIsPrepping(false);
    }
  };

  const startPrepTimer = (sec: number) => {
    setIsPrepping(true);
    setPrepTimeLeft(sec);
    if (prepTimerRef.current) clearInterval(prepTimerRef.current);

    prepTimerRef.current = setInterval(() => {
      setPrepTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(prepTimerRef.current);
          setIsPrepping(false);
          tapHaptic('medium');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechTokenRef = useRef(0);

  const speakText = async (text?: string) => {
    if (!soundEnabled || !text || !mountedRef.current) return;
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
          if (token === speechTokenRef.current && mountedRef.current) setIsSpeaking(false);
        };
        audio.onerror = () => {
          audioRef.current = null;
          if (token === speechTokenRef.current && mountedRef.current) {
            setIsSpeaking(false);
            fallbackSpeech(text, token);
          }
        };
        await audio.play();
        return;
      }
      fallbackSpeech(text, token);
    } catch {
      fallbackSpeech(text, token);
    }
  };

  const fallbackSpeech = (text: string, token?: number) => {
    if (!soundEnabled || !text || !mountedRef.current || (token !== undefined && token !== speechTokenRef.current) || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-GB';
      utterance.rate = 0.95;
      utterance.onstart = () => {
        if (!token || token === speechTokenRef.current) setIsSpeaking(true);
      };
      utterance.onend = () => {
        if (!token || token === speechTokenRef.current) setIsSpeaking(false);
      };
      utterance.onerror = () => {
        if (!token || token === speechTokenRef.current) setIsSpeaking(false);
      };
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
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
      if (currentStep?.say) {
        speakText(currentStep.say);
      }
    }
  };

  const startRecording = async () => {
    tapHaptic('heavy');
    stopSpeech();
    audioChunksRef.current = [];
    setRecordingMs(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: getSupportedMimeType() });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start(100);
      setIsRecording(true);
      recordingStartTimeRef.current = Date.now();

      const maxMs = (currentStep?.maxSec || 60) * 1000;
      recordTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - recordingStartTimeRef.current;
        setRecordingMs(elapsed);
        if (elapsed >= maxMs) {
          stopRecordingAndSend();
        }
      }, 200);
    } catch (err: any) {
      console.error('Mic access error:', err);
      setErrorMsg('Mikrofonga ruxsat berilmadi. Sozlamalardan mikrofonga ruxsat bering.');
    }
  };

  const stopRecordingAndSend = async () => {
    tapHaptic('medium');
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }

    setIsRecording(false);
    setSubmittingAnswer(true);

    setTimeout(async () => {
      const audioBlob =
        audioChunksRef.current.length > 0
          ? new Blob(audioChunksRef.current, { type: audioChunksRef.current[0].type })
          : null;

      await submitAnswer(audioBlob);
      setSubmittingAnswer(false);
    }, 300);
  };

  const submitAnswer = async (audioBlob: Blob | null) => {
    if (!testId || !currentStep) return;

    try {
      const durationMs = recordingMs;
      const res = await sendCefrAnswer(testId, currentStep.i, durationMs, audioBlob);

      if (res.done || !res.step) {
        handleFinishTest();
      } else {
        setCurrentStep(res.step);
        handleStepTransition(res.step);
      }
    } catch (err: any) {
      console.error('Send CEFR answer error:', err);
      setErrorMsg('Javobni yuborishda xatolik. Qaytadan urinib ko\'ring.');
    }
  };

  const handleNextFrame = async () => {
    tapHaptic('light');
    setSubmittingAnswer(true);
    await submitAnswer(null);
    setSubmittingAnswer(false);
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

  const handleFinishTest = async () => {
    if (!testId) return;
    setTestStatus('grading');
    stopSpeech();

    try {
      const res = await finishCefrTest(testId);
      setFeedback(res.feedback);
      setTestStatus('results');
      notifyHaptic('success');
    } catch (err: any) {
      console.error('CEFR Grading error:', err);
      setTestStatus('testing');
      setErrorMsg('Natijalarni hisoblashda xatolik yuz berdi. Qayta urining.');
    }
  };

  const handleAbandon = () => {
    if (!testId) return;
    if (!window.confirm('Imtihondan chiqmoqchimisiz? Ushbu urinish bekor qilinadi.')) return;
    stopSpeech();
    clearTimers();
    return runAction('discard', async () => {
      tapHaptic('light');
      try {
        await abandonCefrTest(testId);
      } catch (err) {
        console.error('Abandon error:', err);
      }
      setTestId(null);
      setActiveTestId(null);
      setCurrentStep(null);
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
              label: 'Kunlik Limit',
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
              <p className="im-examiner-text" style={{ fontSize: '14px', margin: '4px 0 0 0', color: '#f8fafc', lineHeight: 1.4 }}>
                {currentStep.say}
              </p>
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
            <h3 className="im-question-text">{currentStep.say}</h3>

            {/* Prompts list for Part 2 */}
            {currentStep.prompts && (
              <ul className="im-prompts-list">
                {currentStep.prompts.map((pr, idx) => (
                  <li key={idx}>• {pr}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Prep Timer Card / Submitting / Frame / Recording Controls */}
          {isPrepping ? (
            <div className="im-prep-card">
              <Clock size={24} className="animate-spin text-emerald-400" />
              <div>
                <h4>Tayyorgarlik vaqti ketmoqda: {prepTimeLeft} soniya</h4>
                <p>{t('mock.notesHint')}</p>
              </div>
            </div>
          ) : submittingAnswer ? (
            <div className="im-submitting-box">
              <div className="im-spinner" />
              <span>Javobingiz tahlil qilinmoqda...</span>
            </div>
          ) : currentStep.kind === 'frame' || currentStep.kind === 'closing' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
              <div className="im-recording-controls">
                {!isRecording ? (
                  <button className="im-rec-btn im-rec-btn--start" onClick={startRecording} style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                    <Mic size={24} />
                    <span>Javob berish (Ovoz yozish)</span>
                  </button>
                ) : (
                  <div className="im-rec-active">
                    <div className="im-rec-timer">
                      <span className="im-rec-dot" />
                      <span>{formatSecs(recordingMs)} / {formatSecs((currentStep?.maxSec || 60) * 1000)}</span>
                    </div>
                    <button className="im-rec-btn im-rec-btn--stop" onClick={stopRecordingAndSend}>
                      <MicOff size={22} />
                      <span>Javobni tugatish va yuborish</span>
                    </button>
                  </div>
                )}
              </div>
              {!isRecording && (
                <button
                  className="im-btn im-btn--ghost"
                  onClick={handleNextFrame}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <span>Tushundim, keyingisiga o'tish</span>
                  <ChevronRight size={18} />
                </button>
              )}
            </div>
          ) : (
            <div className="im-recording-controls">
              {!isRecording ? (
                <button className="im-rec-btn im-rec-btn--start" onClick={startRecording} style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                  <Mic size={24} />
                  <span>Javob berishni boshlash</span>
                </button>
              ) : (
                <div className="im-rec-active">
                  <div className="im-rec-timer">
                    <span className="im-rec-dot" />
                    <span>{formatSecs(recordingMs)} / {formatSecs((currentStep?.maxSec || 60) * 1000)}</span>
                  </div>
                  <button className="im-rec-btn im-rec-btn--stop" onClick={stopRecordingAndSend}>
                    <MicOff size={22} />
                    <span>Javobni tugatish va yuborish</span>
                  </button>
                </div>
              )}
            </div>
          )}

          <button className="im-abandon-link" onClick={handleAbandon}>
            Imtihonni bekor qilish
          </button>
        </div>
      )}

      {/* 4. GRADING / EVALUATING STATE */}
      {testStatus === 'grading' && (
        <MockLoading accent="cefr" label="Natijalar baholanmoqda…" sublabel={t('mock.cefrGrading')} />
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
                <ul style={{ margin: '4px 0 0', paddingLeft: '16px', fontSize: '11px', lineHeight: '1.5', color: 'rgba(255,255,255,0.9)' }}>
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
                <ul style={{ margin: '4px 0 0', paddingLeft: '16px', fontSize: '11px', lineHeight: '1.5', color: 'rgba(255,255,255,0.9)' }}>
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
              <ol style={{ margin: '6px 0 0', paddingLeft: '18px', fontSize: '12px', lineHeight: '1.6' }}>
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

        .im-subscores-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .im-subscore-item {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          padding: 12px;
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
          font-size: 11px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.6);
        }
        .im-subscore-band {
          font-size: 16px;
          font-weight: 800;
          color: #10b981;
        }
        .im-subscore-comment {
          font-size: 11px;
          line-height: 1.4;
          color: rgba(255, 255, 255, 0.8);
          margin: 0;
        }

        .im-advice-card {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 16px;
        }
        .im-advice-card h3 {
          font-size: 14px;
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
