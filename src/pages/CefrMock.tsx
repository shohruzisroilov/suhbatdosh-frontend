import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Award,
  ChevronRight,
  HelpCircle,
  BookOpen,
} from 'lucide-react';
import {
  getCefrStatus,
  createCefrTest,
  sendCefrAnswer,
  finishCefrTest,
  abandonCefrTest,
} from '../api/endpoints';
import { useAuth } from '../hooks/useAuth';
import { tapHaptic, notifyHaptic } from '../utils/haptics';

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

export default function CefrMock({ navigate }: CefrMockProps) {
  const { user } = useAuth();

  // Test status
  const [testStatus, setTestStatus] = useState<'loading' | 'idle' | 'testing' | 'grading' | 'results'>('loading');
  const [testId, setTestId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<StepData | null>(null);
  const [totalSteps, setTotalSteps] = useState<number>(9);

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
    setTestStatus('loading');
    setErrorMsg(null);
    try {
      const res = await getCefrStatus();
      setQuota(res.quota);
      if (res.activeTest) {
        setTestId(res.activeTest.id);
      }
      setTestStatus('idle');
    } catch (err: any) {
      console.error('CEFR Status error:', err);
      setErrorMsg('CEFR holatini yuklashda xatolik yuz berdi.');
      setTestStatus('idle');
    }
  };

  const handleStartTest = async () => {
    tapHaptic('medium');
    setTestStatus('loading');
    setErrorMsg(null);
    try {
      const res = await createCefrTest('full');
      setTestId(res.testId);
      setTotalSteps(res.totalSteps || 9);
      setCurrentStep(res.step);
      setTestStatus('testing');

      if (res.step) {
        handleStepTransition(res.step);
      }
    } catch (err: any) {
      console.error('Start CEFR test error:', err);
      const msg = err?.response?.data?.error || 'Imtihonni boshlashda xatolik yuz berdi.';
      setErrorMsg(msg);
      setTestStatus('idle');
    }
  };

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

  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-GB';
    utterance.rate = 0.95;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeech = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  const toggleSound = () => {
    tapHaptic('light');
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

  const handleAbandon = async () => {
    if (!testId) return;
    tapHaptic('light');
    if (!window.confirm('Imtihondan chiqmoqchimisiz? Ushbu urinish bekor qilinadi.')) return;

    try {
      await abandonCefrTest(testId);
      setTestId(null);
      setTestStatus('idle');
      fetchStatus();
    } catch (err) {
      console.error('Abandon error:', err);
    }
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
      <div className="im-header">
        <button className="im-icon-btn" onClick={() => { tapHaptic('light'); navigate('home'); }}>
          <ArrowLeft size={20} />
        </button>
        <div className="im-header-title">
          <h2>🇺🇿 CEFR Multilevel Speaking</h2>
          <span className="im-badge">National Certificate</span>
        </div>
        <button className="im-icon-btn" onClick={toggleSound}>
          {soundEnabled ? <Volume2 size={20} className="text-sky-400" /> : <VolumeX size={20} className="text-gray-400" />}
        </button>
      </div>

      {errorMsg && (
        <div className="im-error-banner">
          <AlertTriangle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 1. LOADING STATE */}
      {testStatus === 'loading' && (
        <div className="im-center-box">
          <div className="im-spinner" />
          <p>CEFR Multilevel tayyorlanmoqda...</p>
        </div>
      )}

      {/* 2. IDLE / START SCREEN */}
      {testStatus === 'idle' && (
        <div className="im-start-card">
          <div className="im-hero-ico" style={{ background: 'rgba(16, 185, 129, 0.16)', color: '#10b981' }}>
            <Award size={40} />
          </div>
          <h3>Uzbekistan National Certificate Speaking</h3>
          <p className="im-desc">
            Milliy Sertifikat formati bo'yicha (Part 1.1, Part 1.2 Rasm tahlili, Part 2 B2, va Part 3 C1) to'liq AI topshirish va darajani aniqlash.
          </p>

          {quota && (
            <div className="im-quota-badge">
              <Sparkles size={16} />
              <span>
                {quota.isPremium
                  ? `Kunlik limit: ${quota.used}/${quota.limit} (Qolgani: ${quota.remaining})`
                  : `Bepul sinov: ${quota.used}/${quota.limit} (Qolgani: ${quota.remaining})`}
              </span>
            </div>
          )}

          <div className="im-info-list">
            <div className="im-info-item">
              <Clock size={16} />
              <span>Davomiyligi: ~11-14 daqiqa</span>
            </div>
            <div className="im-info-item">
              <BookOpen size={16} />
              <span>Part 1.1 (A1-A2) + Part 1.2 (B1 Rasm) + Part 2 (B2) + Part 3 (C1)</span>
            </div>
            <div className="im-info-item">
              <HelpCircle size={16} />
              <span>Maksimal ball: 75 / CEFR Daraja: A1-C1</span>
            </div>
          </div>

          <button
            className="im-btn im-btn--primary"
            onClick={handleStartTest}
            disabled={quota ? quota.remaining <= 0 : false}
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
          >
            <Sparkles size={20} />
            <span>CEFR Mock Imtihonni Boshlash</span>
          </button>
        </div>
      )}

      {/* 3. TESTING STATE */}
      {testStatus === 'testing' && currentStep && (
        <div className="im-test-box">
          {/* Progress Tracker */}
          <div className="im-progress-bar-wrap">
            <div className="im-progress-info">
              <span>
                Part {currentStep.part} ({currentStep.i + 1} / {totalSteps})
              </span>
              <span>{Math.round(((currentStep.i + 1) / totalSteps) * 100)}%</span>
            </div>
            <div className="im-progress-bar">
              <div
                className="im-progress-fill"
                style={{ width: `${((currentStep.i + 1) / totalSteps) * 100}%`, background: '#10b981' }}
              />
            </div>
          </div>

          {/* Examiner Audio Speaking Animation */}
          {isSpeaking && (
            <div className="im-examiner-speaking">
              <Volume2 size={18} className="animate-pulse text-emerald-400" />
              <span>AI Examiner savolni o'qimoqda...</span>
            </div>
          )}

          {/* 1.2 Comparison Pictures Display */}
          {currentStep.pictures?.type === 'comparison' && (
            <div className="im-pictures-grid">
              <div className="im-picture-card">
                <span className="im-pic-tag">Rasm 1</span>
                <p>{currentStep.pictures.pic1Alt}</p>
              </div>
              <div className="im-picture-card">
                <span className="im-pic-tag">Rasm 2</span>
                <p>{currentStep.pictures.pic2Alt}</p>
              </div>
            </div>
          )}

          {/* 2 Contextual Picture Display */}
          {currentStep.pictures?.type === 'contextual' && (
            <div className="im-picture-card im-picture-card--full">
              <span className="im-pic-tag">Mavzu Rasmi</span>
              <p>{currentStep.pictures.pic1Alt}</p>
            </div>
          )}

          {/* Question / Task Card */}
          <div className="im-question-card">
            <span className="im-part-tag">PART {currentStep.part}</span>
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

          {/* Prep Timer Card */}
          {isPrepping ? (
            <div className="im-prep-card">
              <Clock size={24} className="animate-spin text-emerald-400" />
              <div>
                <h4>Tayyorgarlik vaqti ketmoqda: {prepTimeLeft} soniya</h4>
                <p>Eslatmalar yozib olishingiz mumkin. Vaqt tugagach nutqni boshlang.</p>
              </div>
            </div>
          ) : submittingAnswer ? (
            <div className="im-submitting-box">
              <div className="im-spinner" />
              <span>Javobingiz tahlil qilinmoqda...</span>
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
        <div className="im-center-box">
          <div className="im-spinner" style={{ borderColor: '#10b981 transparent transparent transparent' }} />
          <h3>Natijalar baholanmoqda...</h3>
          <p>Milliy sertifikat CEFR mezonlari bo'yicha to'liq tahlil etilmoqda.</p>
        </div>
      )}

      {/* 5. RESULTS STATE */}
      {testStatus === 'results' && feedback && (
        <div className="im-results-card">
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
                  <span className="im-subscore-name" style={{ color: '#10b981' }}>💪 Kuchli tomonlar (Strengths)</span>
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
                  <span className="im-subscore-name" style={{ color: '#ef4444' }}>⚠️ Kamchiliklar (Weaknesses)</span>
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
              <h3>💡 Rivojlantirish rejasi (Action Plan)</h3>
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
              <span>Yangi CEFR imtihon topshirish</span>
            </button>
            <button className="im-btn im-btn--ghost" onClick={() => navigate('home')}>
              <span>Bosh sahifaga qaytish</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
