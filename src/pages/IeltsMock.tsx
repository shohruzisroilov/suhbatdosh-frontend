import { useState, useEffect, useRef } from 'react';
import useAppStore from '../store/useAppStore';
import {
  getIeltsStatus,
  startIeltsTest,
  getIeltsTest,
  sendIeltsAnswer,
  finishIeltsTest,
  abandonIeltsTest,
} from '../api/endpoints';
import { tapHaptic, notifyHaptic } from '../utils/haptics';
import {
  Award,
  Clock,
  Mic,
  MicOff,
  Sparkles,
  ChevronRight,
  ArrowLeft,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Volume2,
  VolumeX,
} from 'lucide-react';

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
  const { navigate, user } = useAppStore();

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
  const [totalSteps, setTotalSteps] = useState<number>(0);
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
    try {
      const data = await getIeltsStatus();
      setStatus(data);
      if (data.active) {
        setTestId(data.active);
        loadActiveTest(data.active);
      }
    } catch (err: any) {
      console.error('Failed to load IELTS status', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  const loadActiveTest = async (id: string) => {
    try {
      const data = await getIeltsTest(id);
      if (data.status === 'active' && data.step) {
        setTestId(id);
        setCurrentStep(data.step);
        setTotalSteps(data.total || 0);
        setStepIndex(data.step.i || 0);
        setTestStatus('testing');
        speakText(data.step.say || data.step.cardSay);
      } else if (data.feedback) {
        setFeedback(data.feedback);
        setTestStatus('results');
      }
    } catch (err: any) {
      console.error('Failed to load active test', err);
    }
  };

  const handleStartTest = async () => {
    tapHaptic('medium');
    setErrorMsg(null);
    try {
      const data = await startIeltsTest({ mode: 'full' });
      setTestId(data.testId);
      setCurrentStep(data.step);
      setTotalSteps(data.total || 0);
      setStepIndex(0);
      setTestStatus('testing');
      speakText(data.step.say || data.step.cardSay);
    } catch (err: any) {
      console.error('Failed to start test', err);
      const msg = err.response?.data?.error || 'Imtihonni boshlashda xatolik yuz berdi.';
      setErrorMsg(msg);
    }
  };

  const handleAbandon = async () => {
    if (!testId) return;
    tapHaptic('light');
    try {
      await abandonIeltsTest(testId);
    } catch (err) {}
    setTestId(null);
    setCurrentStep(null);
    setTestStatus('idle');
    fetchStatus();
  };

  // Speech synthesis for AI Examiner voice
  const speakText = (text?: string) => {
    if (!soundEnabled || !text || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.95; // Clear natural speed
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  };

  const stopSpeech = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
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
    if (!mediaRecorderRef.current || !isRecording) return;
    tapHaptic('medium');
    stopSpeech();

    const duration = Date.now() - recordingStartTimeRef.current;
    clearInterval(recordTimerRef.current);
    setIsRecording(false);
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

  // ── Part 2 Cue Card Timer ──
  const startPrepTimer = () => {
    stopSpeech();
    tapHaptic('medium');
    setIsPrepping(true);
    setPrepTimeLeft(60);

    prepTimerRef.current = setInterval(() => {
      setPrepTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(prepTimerRef.current);
          setIsPrepping(false);
          notifyHaptic('success');
          // Speak start signal when prep time ends
          if (currentStep?.startSay) {
            speakText(currentStep.startSay);
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

  // Render Header
  const renderHeader = () => (
    <div className="im-header">
      <button className="im-back-btn" onClick={() => navigate('home')}>
        <ArrowLeft size={18} />
      </button>
      <div className="im-header__title">
        <Sparkles size={16} className="im-sparkle" />
        <span>IELTS AI Mock Examiner</span>
      </div>
      <button
        className="im-sound-btn"
        onClick={() => {
          const next = !soundEnabled;
          setSoundEnabled(next);
          if (!next) stopSpeech();
        }}
      >
        {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
      </button>
    </div>
  );

  // 1. IDLE SCREEN (Quota & Start)
  if (testStatus === 'idle') {
    return (
      <div className="im-page">
        {renderHeader()}

        <div className="im-content">
          <div className="im-hero-card">
            <div className="im-badge">Official Format</div>
            <div className="im-avatar-wrapper">
              <div className="im-avatar">🎙️</div>
              <div className="im-avatar-ring" />
            </div>
            <h1 className="im-title">IELTS Speaking Mock Exam</h1>
            <p className="im-desc">
              Rasmiy IELTS Speaking formati bo'yicha 3 ta bo'limdan iborat to'liq imtihon topshiring. AI Examiner sizning bahoingizni 0-9 band shkalasida aniqlab beradi.
            </p>
          </div>

          {/* Quota Card */}
          <div className="im-quota-card">
            <div className="im-quota-info">
              <span className="im-quota-label">
                {status?.isPremium ? 'Kunlik Limit (Premium)' : 'Bepul Limit (Free)'}
              </span>
              <span className="im-quota-value">
                {status?.remaining ?? 0} / {status?.limit ?? 3} ta imtihon qoldi
              </span>
            </div>
            {!status?.isPremium && (
              <p className="im-quota-hint">
                Oddiy foydalanuvchilar jami 3 marotaba, Premium foydalanuvchilar kuniga 3 marotaba topshirishi mumkin.
              </p>
            )}
          </div>

          {/* Error notice */}
          {errorMsg && (
            <div className="im-error-box">
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="im-actions">
            {status?.active ? (
              <>
                <button className="im-btn im-btn--primary" onClick={() => loadActiveTest(status.active!)}>
                  <span>Tugallanmagan imtihonni davom ettirish</span>
                  <ChevronRight size={18} />
                </button>
                <button className="im-btn im-btn--ghost" onClick={handleAbandon}>
                  <span>Voz kechish va yangi imtihon boshlash</span>
                </button>
              </>
            ) : (
              <button
                className="im-btn im-btn--primary"
                onClick={handleStartTest}
                disabled={loadingStatus || (status?.remaining ?? 0) <= 0}
              >
                <Sparkles size={18} />
                <span>Imtihonni Boshlash</span>
                <ChevronRight size={18} />
              </button>
            )}
          </div>
        </div>
        <style>{css}</style>
      </div>
    );
  }

  // 2. TESTING SCREEN (Part 1, 2, 3 questions)
  if (testStatus === 'testing' && currentStep) {
    const isCueCard = currentStep.kind === 'cue';
    const isFrame = currentStep.kind === 'frame' || currentStep.kind === 'closing';

    return (
      <div className="im-page">
        {renderHeader()}

        {/* Progress Bar */}
        <div className="im-progress">
          <div className="im-progress__bar" style={{ width: `${((stepIndex + 1) / (totalSteps || 1)) * 100}%` }} />
          <div className="im-progress__info">
            <span>Part {currentStep.part}</span>
            <span>{stepIndex + 1} / {totalSteps}</span>
          </div>
        </div>

        <div className="im-test-container">
          {/* Examiner Box */}
          <div className="im-examiner-box">
            <div className={`im-examiner-avatar${isSpeaking ? ' is-speaking' : ''}`}>
              🎙️
            </div>
            <div className="im-examiner-speech">
              <span className="im-examiner-name">AI Examiner</span>
              <p className="im-examiner-text">
                {currentStep.say || currentStep.cardSay}
              </p>
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
                  <span>Tayyorgarlik vaqti (1 min): </span>
                  <strong className="im-prep-timer__time">{prepTimeLeft}s</strong>
                </div>
                {!isPrepping && prepTimeLeft > 0 ? (
                  <button className="im-prep-btn" onClick={startPrepTimer}>
                    Tayyorgarlikni boshlash
                  </button>
                ) : isPrepping ? (
                  <span className="im-prep-active">O'ylash va notes olish vaqti ketmoqda...</span>
                ) : null}
              </div>
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
                <span>Javob yuborilmoqda...</span>
              </div>
            ) : isFrame ? (
              <button className="im-btn im-btn--primary" onClick={handleNextFrame}>
                <span>Tushundim, davom etamiz</span>
                <ChevronRight size={18} />
              </button>
            ) : (
              <div className="im-recording-controls">
                {!isRecording ? (
                  <button className="im-rec-btn im-rec-btn--start" onClick={startRecording}>
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
              Imtihonni to'xtatish
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
      <div className="im-page im-page--center">
        <div className="im-grading-card">
          <div className="im-grading-spinner" />
          <h2 className="im-grading-title">AI Examiner Baholamoqda...</h2>
          <p className="im-grading-sub">
            Aytgan gaplaringiz Fluency, Lexical Resource, Grammar va Pronunciation mezonlari bo'yicha tahlil qilinmoqda. Biroz kuting.
          </p>
        </div>
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
                    <span className="im-subscore-name" style={{ color: '#10b981' }}>💪 Strong Points</span>
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
                    <span className="im-subscore-name" style={{ color: '#ef4444' }}>⚠️ Main Problems</span>
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
              <h3 style={{ color: '#38bdf8' }}>✏️ Better Answer Example</h3>
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
                      <span className="im-fix-label">Siz aytgan so'z:</span>
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
              <h3>💡 Keyingi qadam uchun maslahat</h3>
              <p>{feedback.advice}</p>
            </div>
          )}

          {/* Result Actions */}
          <div className="im-actions">
            <button className="im-btn im-btn--primary" onClick={() => { setTestStatus('idle'); fetchStatus(); }}>
              <RotateCcw size={18} />
              <span>Yangi imtihon topshirish</span>
            </button>
            <button className="im-btn im-btn--ghost" onClick={() => navigate('home')}>
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

  .im-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.08);
    background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(12px);
    position: sticky; top: 0; z-index: 10;
  }
  .im-back-btn, .im-sound-btn {
    width: 36px; height: 36px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,0.08); color: #fff; border: none; cursor: pointer;
  }
  .im-header__title {
    display: flex; align-items: center; gap: 8px;
    font-size: 15px; font-weight: 700; color: #fff;
  }
  .im-sparkle { color: #38bdf8; }

  .im-content {
    padding: 16px; display: flex; flex-direction: column; gap: 16px; max-width: 500px; margin: 0 auto; width: 100%;
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
  .im-grading-card {
    display: flex; flex-direction: column; align-items: center; text-align: center; gap: 16px;
    max-width: 320px;
  }
  .im-grading-spinner {
    width: 56px; height: 56px; border: 4px solid rgba(255,255,255,0.1);
    border-top-color: #38bdf8; border-radius: 50%; animation: spin 1s linear infinite;
  }
  .im-grading-title { font-size: 20px; font-weight: 800; margin: 0; }
  .im-grading-sub { font-size: 13px; color: rgba(255,255,255,0.6); line-height: 1.5; margin: 0; }

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
