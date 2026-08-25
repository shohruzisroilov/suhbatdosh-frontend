import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, X, RotateCcw, Check, AlertTriangle, GraduationCap, Clock, MicOff, Zap, Award } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { useT } from '../i18n';
import { useSpeech } from '../hooks/useSpeech';
import { useRecorder } from '../hooks/useRecorder';
import ReviewPrompt from '../components/ReviewPrompt';
import BandScale from '../components/BandScale';
import CertificateModal from '../components/CertificateModal';
import { tapHaptic, selectionHaptic } from '../utils/haptics';
import {
  startIeltsTest,
  getIeltsTest,
  sendIeltsAnswer,
  answerTimeout,
  finishIeltsTest,
  abandonIeltsTest,
} from '../api/endpoints';

const PART_LABEL: Record<number, string> = { 1: 'Part 1', 2: 'Part 2', 3: 'Part 3' };
const UPLOAD_BUDGET_MS = 75_000;
const MARK_BUDGET_MS = 240_000;

function fmtClock(ms: number): string {
  const s = Math.max(Math.floor(ms / 1000), 0);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function IeltsMock() {
  const { navigate, ieltsStatus, setIeltsStatus } = useAppStore();
  const t = useT();

  const [stage, setStage] = useState<'intro' | 'running' | 'marking' | 'report'>('intro');
  const [phase, setPhase] = useState<'examiner' | 'prep' | 'answering' | 'uploading'>('examiner');

  const [test, setTest] = useState<any>(null);
  const [step, setStep] = useState<any>(null);
  const [answered, setAnswered] = useState(0);
  const [prepLeft, setPrepLeft] = useState(0);
  const [starting, setStarting] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [feedback, setFeedback] = useState<any>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [showText, setShowText] = useState(false);
  const [testMode, setTestMode] = useState<'quick' | 'full'>('quick');

  const { speak, cancelSpeech, unlockAudio, ttsSupported } = useSpeech({ lang: 'en-GB' });
  const recorder = useRecorder();

  const testRef = useRef<any>(null);
  const pendingRef = useRef<any>(null);
  const finishedRef = useRef(false);
  const retryTimerRef = useRef<any>(null);

  const say = useCallback(
    (text: string) =>
      new Promise<void>((resolve) => {
        if (!text) { resolve(); return; }

        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          clearTimeout(guard);
          resolve();
        };
        const guard = setTimeout(finish, Math.min(6000 + text.length * 90, 60_000));

        if (!ttsSupported) {
          setShowText(true);
          clearTimeout(guard);
          setTimeout(resolve, Math.min(2500 + text.length * 45, 15_000));
          return;
        }
        speak(text, finish);
      }),
    [speak, ttsSupported]
  );

  const countdown = useCallback(
    (seconds: number, isCancelled: () => boolean) =>
      new Promise<void>((resolve) => {
        let left = seconds;
        setPrepLeft(left);
        const id = setInterval(() => {
          if (isCancelled()) { clearInterval(id); resolve(); return; }
          left -= 1;
          setPrepLeft(left);
          if (left <= 0) { clearInterval(id); resolve(); }
        }, 1000);
      }),
    []
  );

  const runMarking = useCallback(async ({ attempt = 0, deadline, manual = false }: { attempt?: number; deadline?: number; manual?: boolean } = {}) => {
    if (finishedRef.current && attempt === 0 && !manual) return;
    finishedRef.current = true;
    const until = deadline ?? Date.now() + MARK_BUDGET_MS;

    recorder.release();
    cancelSpeech();
    setRetrying(attempt > 0);
    setStage('marking');
    setIeltsStatus(null);

    try {
      const data = await finishIeltsTest(testRef.current, Math.min(180_000, until - Date.now()));
      setRetrying(false);
      setFeedback(data.feedback);
      setStage('report');
    } catch (err: any) {
      const status = err?.response?.status;
      const transient = !status || status >= 500 || status === 429;
      const hinted = Number(err?.response?.headers?.['retry-after']) * 1000;
      const delay = status === 429
        ? Math.min(Number.isFinite(hinted) && hinted > 0 ? hinted : 30_000, 90_000)
        : 2000 * (attempt + 1);

      if (transient && attempt < 3 && until - Date.now() > delay + 10_000) {
        retryTimerRef.current = setTimeout(() => {
          runMarking({ attempt: attempt + 1, deadline: until });
        }, delay);
        return;
      }
      setRetrying(false);
      setFatal(status === 400 ? 'short' : status === 503 ? 'off' : 'failed');
      setStage('report');
    }
  }, [recorder, cancelSpeech, setIeltsStatus]);

  const upload = useCallback(async (answer: any, { attempt = 0, deadline }: { attempt?: number; deadline?: number } = {}) => {
    const { stepIndex, blob, ms } = answer;
    pendingRef.current = answer;
    const until = deadline ?? Date.now() + UPLOAD_BUDGET_MS;
    setPhase('uploading');
    setUploadFailed(false);
    setRetrying(attempt > 0);

    try {
      const data = await sendIeltsAnswer(
        testRef.current, stepIndex, blob, ms,
        Math.min(answerTimeout(blob?.size ?? 0), until - Date.now()),
      );
      pendingRef.current = null;
      setRetrying(false);
      setAnswered((n) => n + 1);
      if (data.done || !data.step) {
        runMarking();
      } else {
        setStep(data.step);
      }
    } catch (err: any) {
      const status = err?.response?.status;

      if (status === 413) {
        upload({ stepIndex, blob: null, ms: 0 });
        return;
      }
      if (status === 409) {
        try {
          const fresh = await getIeltsTest(testRef.current);
          pendingRef.current = null;
          setRetrying(false);
          if (!fresh.step) { runMarking(); return; }
          setAnswered(fresh.step.i);
          setStep(fresh.step);
          return;
        } catch { /* proceed to fail */ }
      }

      const transient = !status || status >= 500 || status === 429;
      const delay = status === 429 ? 8000 : 1500 * (attempt + 1);
      if (transient && attempt < 3 && until - Date.now() > delay + 5000) {
        retryTimerRef.current = setTimeout(() => {
          upload(answer, { attempt: attempt + 1, deadline: until });
        }, delay);
        return;
      }

      setRetrying(false);
      setUploadFailed(true);
    }
  }, [runMarking]);

  const retryUpload = useCallback(() => {
    tapHaptic('medium');
    clearTimeout(retryTimerRef.current);
    if (pendingRef.current) upload(pendingRef.current);
  }, [upload]);

  useEffect(() => () => clearTimeout(retryTimerRef.current), []);

  useEffect(() => {
    if (stage !== 'running' || !step) return;

    let cancelled = false;
    const isCancelled = () => cancelled;

    (async () => {
      setPhase('examiner');
      await say(step.say);
      if (cancelled) return;

      if (step.kind === 'closing') { runMarking(); return; }

      if (step.kind === 'cue') {
        await say(step.cardSay);
        if (cancelled) return;

        setPhase('prep');
        await countdown(step.prepSec, isCancelled);
        if (cancelled) return;
        setPhase('examiner');
        await say(step.startSay);
        if (cancelled) return;
      }

      setPhase('answering');
      recorder.start({
        maxSec: step.maxSec,
        onDone: (blob, ms) => {
          if (cancelled) return;
          upload({ stepIndex: step.i, blob, ms });
        },
      });
    })();

    return () => {
      cancelled = true;
      cancelSpeech();
      recorder.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, step?.i]);

  const begin = useCallback(async (resumeId?: string, modeOverride?: 'quick' | 'full') => {
    if (starting) return;
    tapHaptic('medium');
    setStarting(true);

    unlockAudio();
    const micReady = await recorder.prime();
    if (!micReady) { setStarting(false); return; }

    try {
      const modeToUse = modeOverride || testMode;
      const data = resumeId ? await getIeltsTest(resumeId) : await startIeltsTest({ mode: modeToUse });
      if (resumeId && (!data.step || data.status !== 'active')) {
        setStarting(false);
        setIeltsStatus({ ...ieltsStatus, active: null });
        return begin();
      }
      testRef.current = data.testId;
      finishedRef.current = false;
      setTest({ testId: data.testId, title: data.title, answerable: data.answerable });
      setAnswered(data.step.i);
      setStep(data.step);
      setStage('running');
    } catch (err: any) {
      const status = err?.response?.status;
      setFatal(status === 429 ? 'limit' : status === 503 ? 'off' : 'failed');
    } finally {
      setStarting(false);
    }
  }, [starting, unlockAudio, recorder, ieltsStatus, setIeltsStatus, testMode]);

  const leave = useCallback(() => {
    cancelSpeech();
    recorder.release();
    if (testRef.current && !finishedRef.current) {
      abandonIeltsTest(testRef.current).catch(() => {});
    }
    setIeltsStatus(null);
    navigate('home');
  }, [cancelSpeech, recorder, navigate, setIeltsStatus]);

  const confirmLeave = useCallback(() => {
    if (stage !== 'running') { leave(); return; }
    const message = t('ielts.quitConfirm');
    const tg = window.Telegram?.WebApp;
    if (tg?.showConfirm) {
      tg.showConfirm(message, (ok: boolean) => { if (ok) leave(); });
    } else if (window.confirm(message)) {
      leave();
    }
  }, [stage, leave, t]);

  const confirmLeaveRef = useRef(confirmLeave);
  confirmLeaveRef.current = confirmLeave;

  useEffect(() => {
    const back = window.Telegram?.WebApp?.BackButton;
    if (!back) return;
    const handleBack = () => confirmLeaveRef.current?.();
    back.onClick(handleBack);
    back.show();
    return () => {
      back.offClick(handleBack);
      back.hide();
    };
  }, []);

  const micDenied = recorder.error === 'denied';
  const micBroken = !recorder.supported || recorder.error === 'failed';
  const resumeId = ieltsStatus?.active?.testId ?? null;
  const resumeMode = ieltsStatus?.active?.mode ?? null;

  useEffect(() => {
    if (resumeMode === 'quick' || resumeMode === 'full') setTestMode(resumeMode);
  }, [resumeMode]);

  if (fatal && stage !== 'report') {
    const isLimit = fatal === 'limit';
    const upsell = isLimit && !ieltsStatus?.isPremium;
    return (
      <Shell onClose={() => navigate('home')} title={t('ielts.title')}>
        <div className="im-center">
          <span className="im-glyph">{isLimit ? <Clock size={28} /> : <GraduationCap size={28} />}</span>
          <h2 className="im-h2">{t(isLimit ? 'ielts.limitTitle' : 'ielts.offTitle')}</h2>
          <p className="im-p">
            {isLimit
              ? (upsell ? t('ielts.limitDesc') : t('ielts.limitDescPremium'))
              : t('ielts.offDesc')}
          </p>
          {upsell && (
            <button className="im-btn im-btn--primary" onClick={() => navigate('premium', { from: 'home' })}>
              {t('ielts.getPremium')}
            </button>
          )}
          <button className="im-btn" onClick={() => navigate('home')}>{t('common.goHome')}</button>
        </div>
      </Shell>
    );
  }

  if (stage === 'intro') {
    return (
      <Shell onClose={() => navigate('home')} title={t('ielts.title')}>
        <div className="im-scroll">
          <div className="im-hero">
            <span className="im-hero__ico"><GraduationCap size={26} /></span>
            <h2 className="im-hero__title">{t('ielts.introTitle')}</h2>
            <p className="im-hero__sub">
              {testMode === 'quick' ? t('ielts.introSubQuick') : t('ielts.introSub')}
            </p>
          </div>

          <div className="im-mode-select">
            <p className="eyebrow">{t('ielts.modeTitle')}</p>
            <div className="im-mode-grid">
              <button
                type="button"
                aria-pressed={testMode === 'quick'}
                className={`im-mode-card${testMode === 'quick' ? ' im-mode-card--active' : ''}`}
                onClick={() => { selectionHaptic(); setTestMode('quick'); }}
              >
                <span className="im-mode-card__badge">{t('ielts.modeQuickBadge')}</span>
                <span className="im-mode-card__ico"><Zap size={22} /></span>
                <span className="im-mode-card__title">{t('ielts.modeQuickName')}</span>
                <span className="im-mode-card__desc">{t('ielts.modeQuickDesc')}</span>
              </button>

              <button
                type="button"
                aria-pressed={testMode === 'full'}
                className={`im-mode-card${testMode === 'full' ? ' im-mode-card--active' : ''}`}
                onClick={() => { selectionHaptic(); setTestMode('full'); }}
              >
                <span className="im-mode-card__ico"><GraduationCap size={22} /></span>
                <span className="im-mode-card__title">{t('ielts.modeFullName')}</span>
                <span className="im-mode-card__desc">{t('ielts.modeFullDesc')}</span>
              </button>
            </div>
          </div>

          {testMode === 'full' ? (
            <ol className="im-steps">
              <li><b>{t('ielts.p1Name')}</b> — {t('ielts.p1Desc')}</li>
              <li><b>{t('ielts.p2Name')}</b> — {t('ielts.p2Desc')}</li>
              <li><b>{t('ielts.p3Name')}</b> — {t('ielts.p3Desc')}</li>
            </ol>
          ) : (
            <ol className="im-steps">
              <li><b>{t('ielts.p1Name')}</b> — {t('ielts.p1Desc')}</li>
            </ol>
          )}

          {testMode === 'quick' && (
            <p className="im-note">{t('ielts.modeQuickNote')}</p>
          )}

          <div className="im-rules">
            <p className="im-rules__title">{t('ielts.rulesTitle')}</p>
            <p>{t('ielts.rule1')}</p>
            <p>{t('ielts.rule2')}</p>
            <p>{t('ielts.rule3')}</p>
          </div>

          {micDenied && (
            <p className="im-warn"><AlertTriangle size={14} /> {t('ielts.micDenied')}</p>
          )}
          {micBroken && (
            <p className="im-warn"><AlertTriangle size={14} /> {t('ielts.micUnsupported')}</p>
          )}
        </div>

        <footer className="im-foot">
          {resumeId && (
            <button
              className="im-btn im-btn--primary"
              onClick={() => begin(resumeId)}
              disabled={starting || micBroken}
            >
              {starting ? t('ielts.starting') : t('ielts.resumeBtn')}
            </button>
          )}
          <button
            className={`im-btn${resumeId ? '' : ' im-btn--primary'}`}
            onClick={() => begin()}
            disabled={starting || micBroken}
          >
            {starting && !resumeId ? t('ielts.starting') : t('ielts.startBtn')}
          </button>
          <p className="im-note">{resumeId ? t('ielts.resumeNote') : t('ielts.introNote')}</p>
        </footer>
      </Shell>
    );
  }

  if (stage === 'marking') {
    return (
      <Shell title={t('ielts.title')}>
        <div className="im-center">
          <div className="im-orb im-orb--think"><GraduationCap size={40} /></div>
          <h2 className="im-h2">{t('ielts.markingTitle')}</h2>
          <p className="im-p">{retrying ? t('ielts.retrying') : t('ielts.markingDesc')}</p>
        </div>
      </Shell>
    );
  }

  if (stage === 'report') {
    return (
      <Report
        t={t}
        feedback={feedback}
        error={fatal}
        onRetryMark={
          fatal === 'short' || fatal === 'off'
            ? null
            : () => { setFatal(null); runMarking({ manual: true }); }
        }
        onHome={() => navigate('home')}
        onAgain={() => {
          if (testRef.current) {
            abandonIeltsTest(testRef.current).catch(() => {});
          }
          finishedRef.current = false;
          testRef.current = null;
          setFeedback(null);
          setFatal(null);
          setStep(null);
          setAnswered(0);
          setIeltsStatus(null);
          setStage('intro');
        }}
      />
    );
  }

  const isCue = step?.kind === 'cue';
  const timeLeftMs = phase === 'answering' && step ? step.maxSec * 1000 - recorder.elapsedMs : 0;
  const showTimer = isCue && phase === 'answering';

  const stateLabel =
    uploadFailed ? t('ielts.sendHeld')
    : phase === 'uploading' && retrying ? t('ielts.retrying')
    : phase === 'uploading' ? t('ielts.sending')
    : phase === 'prep' ? t('ielts.prepLabel')
    : phase === 'answering' ? t('ielts.yourTurn')
    : t('ielts.examinerSpeaking');

  return (
    <Shell onClose={confirmLeave} title={PART_LABEL[step?.part] || t('ielts.title')}>
      <div className="im-progress">
        <div className="im-progress__bar">
          <span style={{ width: `${Math.min((answered / (test?.answerable || 1)) * 100, 100)}%` }} />
        </div>
        <p className="im-progress__text">
          {t('ielts.progress', { n: answered, total: test?.answerable ?? 0 })}
        </p>
      </div>

      <div className="im-stage">
        {isCue && step.card && (
          <div className="im-card">
            <p className="im-card__cue">{step.card.cue}</p>
            <p className="im-card__lead">{t('ielts.cardLead')}</p>
            <ul className="im-card__list">
              {step.card.bullets.map((b: string, i: number) => <li key={i}>{b}</li>)}
            </ul>
          </div>
        )}

        {!isCue && (
          <div className={`im-orb im-orb--${phase === 'answering' ? 'listen' : 'speak'}`}>
            {phase === 'answering' ? <Mic size={40} /> : <GraduationCap size={40} />}
          </div>
        )}

        {showText && step && phase !== 'prep' && (
          <p className="im-question">{step.say}</p>
        )}

        <p className={`im-state${phase === 'answering' ? ' im-state--live' : ''}`}>{stateLabel}</p>

        {phase === 'prep' && (
          <div className="im-timer im-timer--big">{fmtClock(prepLeft * 1000)}</div>
        )}
        {showTimer && (
          <div className={`im-timer${timeLeftMs < 20_000 ? ' im-timer--low' : ''}`}>
            {fmtClock(timeLeftMs)}
          </div>
        )}

        {phase === 'answering' && (
          <div className="im-level">
            <span style={{ transform: `scaleX(${Math.max(recorder.level, 0.04)})` }} />
          </div>
        )}
      </div>

      <footer className="im-foot">
        {uploadFailed ? (
          <>
            <p className="im-warn"><AlertTriangle size={14} /> {t('ielts.uploadFailed')}</p>
            <button className="im-btn im-btn--primary" onClick={retryUpload}>
              <RotateCcw size={16} /> {t('common.tryAgain')}
            </button>
          </>
        ) : phase === 'answering' ? (
          <>
            <button className="im-btn im-btn--primary" onClick={() => { tapHaptic('light'); recorder.stop(); }}>
              <Check size={17} /> {t('ielts.doneAnswer')}
            </button>
            <p className="im-note">{t('ielts.autoStopHint')}</p>
          </>
        ) : phase === 'prep' ? (
          <p className="im-note">{t('ielts.prepHint')}</p>
        ) : (
          <p className="im-note">{t('ielts.listenHint')}</p>
        )}
      </footer>
    </Shell>
  );
}

function Report({ t, feedback, error, onHome, onAgain, onRetryMark }: any) {
  const { user } = useAppStore();
  const [showCert, setShowCert] = useState(false);

  if (error || !feedback) {
    const short = error === 'short';
    return (
      <Shell onClose={onHome} title={t('ielts.title')}>
        <div className="im-center">
          <span className="im-glyph">{short ? <MicOff size={28} /> : <AlertTriangle size={28} />}</span>
          <h2 className="im-h2">{t(short ? 'ielts.shortTitle' : 'ielts.markFailTitle')}</h2>
          <p className="im-p">{t(short ? 'ielts.shortDesc' : 'ielts.markFailDesc')}</p>
          {onRetryMark && (
            <button className="im-btn im-btn--primary" onClick={onRetryMark}>
              <RotateCcw size={16} /> {t('ielts.markRetry')}
            </button>
          )}
          <button className={`im-btn${onRetryMark ? '' : ' im-btn--primary'}`} onClick={onAgain}>
            {t('ielts.again')}
          </button>
          <button className="im-btn" onClick={onHome}>{t('common.goHome')}</button>
        </div>
      </Shell>
    );
  }

  const criteria = [
    { key: 'fluency',       label: t('ielts.critFluency'),  data: feedback.fluency },
    { key: 'lexical',       label: t('ielts.critLexical'),  data: feedback.lexical },
    { key: 'grammar',       label: t('ielts.critGrammar'),  data: feedback.grammar },
    { key: 'pronunciation', label: t('ielts.critPron'),     data: feedback.pronunciation },
  ];

  const notes = [
    { label: t('ielts.p1Name'), text: feedback.partNotes?.part1 },
    { label: t('ielts.p2Name'), text: feedback.partNotes?.part2 },
    { label: t('ielts.p3Name'), text: feedback.partNotes?.part3 },
  ].filter((n) => n.text);

  return (
    <Shell onClose={onHome} title={t('ielts.reportTitle')}>
      <div className="im-scroll">
        <div className="im-band">
          <span className="eyebrow">{t('ielts.overall')}</span>
          <span className="im-band__value num">{feedback.overall}</span>
          <BandScale value={feedback.overall} size="lg" />
          <span className="im-band__note">{t('ielts.overallNote')}</span>

          <button
            type="button"
            className="im-btn im-btn--cert"
            onClick={() => { tapHaptic('medium'); setShowCert(true); }}
          >
            <Award size={18} />
            <span>{t('ielts.certificate')}</span>
          </button>
        </div>

        {showCert && (
          <CertificateModal
            user={user}
            feedback={feedback}
            onClose={() => setShowCert(false)}
          />
        )}

        <section className="im-block">
          <h3 className="eyebrow">{t('ielts.byCriteria')}</h3>
          <div className="im-crits">
            {criteria.map((c) => (
              <BandScale key={c.key} value={c.data?.band} label={c.label} size="sm" showEnds={false} />
            ))}
          </div>
        </section>

        {criteria.map((c) => c.data?.comment ? (
          <section key={c.key} className="im-block">
            <h3 className="im-block__title">{c.label} · {c.data.band}</h3>
            <p className="im-block__body">{c.data.comment}</p>
          </section>
        ) : null)}

        {notes.length > 0 && (
          <section className="im-block">
            <h3 className="im-block__title">{t('ielts.byPart')}</h3>
            {notes.map((n) => (
              <p key={n.label} className="im-block__body"><b>{n.label}:</b> {n.text}</p>
            ))}
          </section>
        )}

        {feedback.fixes?.length > 0 && (
          <section className="im-block">
            <h3 className="im-block__title">{t('ielts.fixes')}</h3>
            {feedback.fixes.map((f: any, i: number) => (
              <div key={i} className="im-fix">
                <p className="im-fix__said">{f.said}</p>
                <p className="im-fix__better">{f.better}</p>
                {f.why && <p className="im-fix__why">{f.why}</p>}
              </div>
            ))}
          </section>
        )}

        {feedback.advice && (
          <section className="im-block im-block--accent">
            <h3 className="im-block__title">{t('ielts.next')}</h3>
            <p className="im-block__body">{feedback.advice}</p>
          </section>
        )}

        <p className="im-note">{t('ielts.reportDisclaimer')}</p>
        <ReviewPrompt />
      </div>

      <footer className="im-foot im-foot--row">
        <button className="im-btn" onClick={onHome}>{t('common.goHome')}</button>
        <button className="im-btn im-btn--primary" onClick={onAgain}>{t('ielts.again')}</button>
      </footer>
      <Styles />
    </Shell>
  );
}

function Shell({ title, onClose, children }: { title: string; onClose?: () => void; children: React.ReactNode }) {
  return (
    <div className="im-screen">
      <header className="im-head">
        <p className="im-head__title">{title}</p>
        {onClose && (
          <button className="im-head__close" onClick={onClose} aria-label="Close">
            <X size={19} />
          </button>
        )}
      </header>
      {children}
      <Styles />
    </div>
  );
}

const Styles = React.memo(function Styles() {
  return (
    <style>{`
      .im-screen { display: flex; flex-direction: column; height: 100%; overflow: hidden; background: var(--bg); }

      .im-head {
        display: flex; align-items: center; justify-content: space-between;
        padding: var(--space-3) var(--space-4);
        border-bottom: 1px solid var(--border); flex-shrink: 0;
      }
      .im-head__title { font-size: var(--text-base); font-weight: var(--weight-bold); letter-spacing: -0.2px; }
      .im-head__close {
        width: 34px; height: 34px; border-radius: var(--radius-full);
        display: flex; align-items: center; justify-content: center;
        color: var(--text-secondary); transition: background var(--t);
      }
      .im-head__close:active { background: var(--bg-secondary); }

      .im-scroll {
        flex: 1; overflow-y: auto; padding: var(--space-4);
        display: flex; flex-direction: column; gap: var(--space-3);
      }
      .im-center {
        flex: 1; display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: var(--space-3);
        padding: var(--space-6) var(--space-5); text-align: center;
      }
      .im-glyph {
        width: 62px; height: 62px; border-radius: var(--radius-full);
        display: flex; align-items: center; justify-content: center;
        background: var(--surface-2); color: var(--text-secondary);
      }
      .im-h2 {
        font-family: var(--font-display);
        font-size: var(--text-lg); font-weight: var(--weight-heavy); letter-spacing: -0.02em;
      }
      .im-p  { font-size: var(--text-base); color: var(--text-secondary); line-height: 1.6; max-width: 300px; }

      .im-hero { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); text-align: center; padding: var(--space-4) 0 var(--space-2); }
      .im-hero__ico {
        width: 56px; height: 56px; border-radius: var(--radius-full);
        display: flex; align-items: center; justify-content: center;
        background: var(--btn-bg-soft); color: var(--btn-bg);
      }
      .im-hero__title {
        font-family: var(--font-display);
        font-size: var(--text-xl); font-weight: var(--weight-heavy); letter-spacing: -0.03em;
      }
      .im-hero__sub { font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.6; max-width: 300px; }

      .im-mode-select {
        display: flex; flex-direction: column; gap: var(--space-2);
        margin: var(--space-1) 0;
      }
      .im-mode-grid {
        display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2);
      }
      .im-mode-card {
        position: relative;
        display: flex; flex-direction: column; align-items: flex-start;
        padding: var(--space-3);
        background: var(--bg-secondary); border: 2px solid var(--border);
        border-radius: var(--radius-md); text-align: left;
        transition: border-color 0.15s, background 0.15s, transform 0.1s;
      }
      .im-mode-card:active { transform: scale(0.98); }
      .im-mode-card--active {
        background: rgba(56, 189, 248, 0.1);
        border-color: var(--btn-bg);
        box-shadow: 0 4px 14px rgba(42, 171, 238, 0.2);
      }
      .im-mode-card__badge {
        font-size: 10px; font-weight: var(--weight-bold);
        color: #38BDF8; background: rgba(56, 189, 248, 0.2);
        padding: 2px 6px; border-radius: 99px; margin-bottom: 6px;
      }
      .im-mode-card__ico {
        color: var(--btn-bg); margin-bottom: 4px;
      }
      .im-mode-card__title {
        font-size: var(--text-sm); font-weight: var(--weight-bold); color: var(--text-primary);
      }
      .im-mode-card__desc {
        font-size: 11px; color: var(--text-secondary); margin-top: 2px; line-height: 1.3;
      }

      .im-btn--cert {
        margin-top: var(--space-3);
        background: linear-gradient(135deg, #0284c7, #7e22ce);
        color: #fff; border: none; font-weight: var(--weight-bold);
        display: flex; align-items: center; justify-content: center; gap: 8px;
        box-shadow: 0 4px 14px rgba(126, 34, 206, 0.35);
      }

      .im-steps {
        list-style: none; counter-reset: p;
        display: flex; flex-direction: column; gap: var(--space-2);
      }
      .im-steps li {
        counter-increment: p; position: relative;
        padding: var(--space-3) var(--space-4) var(--space-3) calc(var(--space-4) + 26px);
        background: var(--bg-secondary); border: 1px solid var(--border);
        border-radius: var(--radius-md);
        font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.5;
      }
      .im-steps li b { color: var(--text-primary); font-weight: var(--weight-bold); }
      .im-steps li::before {
        content: counter(p);
        position: absolute; left: var(--space-4); top: var(--space-3);
        width: 20px; height: 20px; border-radius: 50%;
        background: var(--btn-bg); color: var(--btn-text);
        font-size: 11px; font-weight: var(--weight-heavy);
        display: flex; align-items: center; justify-content: center;
      }

      .im-rules {
        padding: var(--space-3) var(--space-4); border-radius: var(--radius-md);
        border: 1px solid var(--border); border-left: 3px solid var(--btn-bg);
        display: flex; flex-direction: column; gap: var(--space-1);
      }
      .im-rules__title {
        font-size: var(--text-xs); font-weight: var(--weight-bold);
        text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary);
        margin-bottom: 2px;
      }
      .im-rules p { font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.55; }

      .im-progress { padding: var(--space-3) var(--space-4) 0; flex-shrink: 0; }
      .im-progress__bar {
        height: 4px; border-radius: var(--radius-full);
        background: var(--bg-secondary); overflow: hidden;
      }
      .im-progress__bar span {
        display: block; height: 100%; background: var(--btn-bg);
        transition: width 0.4s ease;
      }
      .im-progress__text {
        margin-top: 6px; font-size: var(--text-xs); color: var(--text-secondary);
        text-align: center; font-variant-numeric: tabular-nums;
      }

      .im-stage {
        flex: 1; overflow-y: auto;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        gap: var(--space-4); padding: var(--space-5) var(--space-4);
      }

      .im-orb {
        width: 130px; height: 130px; border-radius: 50%; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        background: var(--surface-2); border: 2px solid var(--border);
        color: var(--text-secondary);
        transition: border-color var(--t), background var(--t);
      }
      .im-orb--listen {
        border-color: var(--danger); color: var(--danger);
        background: color-mix(in srgb, var(--danger) 12%, transparent);
        animation: pulse 1.6s ease-in-out infinite;
      }
      .im-orb--speak {
        border-color: transparent; color: var(--btn-text);
        background: var(--grad-primary);
        animation: pulse 2.4s ease-in-out infinite;
      }
      .im-orb--think { animation: imSpin 2.4s linear infinite; }
      @keyframes imSpin { to { transform: rotate(360deg); } }

      .im-state {
        font-family: var(--font-display);
        font-size: var(--text-md); font-weight: var(--weight-heavy);
        letter-spacing: -0.01em; text-align: center;
      }
      .im-state--live { color: var(--danger); }
      .im-question {
        font-size: var(--text-base); line-height: 1.55; text-align: center;
        color: var(--text-secondary); max-width: 320px;
      }

      .im-timer {
        font-family: var(--font-display);
        font-size: var(--text-lg); font-weight: var(--weight-heavy);
        font-variant-numeric: tabular-nums; letter-spacing: 0.02em;
        color: var(--text-secondary);
        padding: var(--space-1) var(--space-4); border-radius: var(--radius-full);
        background: var(--bg-secondary); border: 1px solid var(--border);
      }
      .im-timer--big { font-size: var(--text-2xl); padding: var(--space-2) var(--space-5); }
      .im-timer--low { color: var(--danger); border-color: var(--danger); }

      .im-level {
        width: 160px; height: 4px; border-radius: var(--radius-full);
        background: var(--bg-secondary); overflow: hidden;
      }
      .im-level span {
        display: block; width: 100%; height: 100%;
        background: var(--danger); transform-origin: center;
        transition: transform 0.1s linear;
      }

      .im-card {
        width: 100%; max-width: 340px;
        padding: var(--space-4); border-radius: var(--radius-lg);
        background: var(--bg-secondary); border: 1px solid var(--border);
        display: flex; flex-direction: column; gap: var(--space-2);
      }
      .im-card__cue { font-size: var(--text-base); font-weight: var(--weight-bold); line-height: 1.4; }
      .im-card__lead { font-size: var(--text-sm); color: var(--text-secondary); }
      .im-card__list { list-style: none; display: flex; flex-direction: column; gap: 4px; }
      .im-card__list li {
        font-size: var(--text-sm); color: var(--text-primary); line-height: 1.5;
        padding-left: var(--space-3); position: relative;
      }
      .im-card__list li::before {
        content: '•'; position: absolute; left: 0; color: var(--text-secondary);
      }

      .im-band {
        display: flex; flex-direction: column; align-items: center; gap: var(--space-2);
        padding: var(--space-5) var(--space-4);
        border-radius: var(--radius-xl);
        background: var(--bg-secondary); border: 1px solid var(--border);
      }
      .im-band__value {
        font-family: var(--font-display);
        font-size: var(--text-3xl); font-weight: var(--weight-heavy);
        letter-spacing: -0.04em; line-height: 1;
        margin-bottom: var(--space-1);
      }
      .im-band__note {
        font-size: var(--text-xs); color: var(--text-secondary);
        text-align: center; line-height: 1.5; margin-top: var(--space-1);
      }

      .im-crits { display: flex; flex-direction: column; gap: var(--space-4); }

      .im-block {
        padding: var(--space-4); border-radius: var(--radius-lg);
        background: var(--bg-secondary); border: 1px solid var(--border);
        display: flex; flex-direction: column; gap: var(--space-2);
      }
      .im-block--accent { border-left: 3px solid var(--btn-bg); }
      .im-block__title {
        font-size: var(--text-xs); font-weight: var(--weight-bold);
        text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-secondary);
      }
      .im-block__body { font-size: var(--text-sm); line-height: 1.65; }

      .im-fix {
        display: flex; flex-direction: column; gap: 2px;
        padding: var(--space-2) 0; border-top: 1px solid var(--border);
      }
      .im-fix:first-of-type { border-top: none; padding-top: 0; }
      .im-fix__said   { font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.5; text-decoration: line-through; text-decoration-color: var(--border); }
      .im-fix__better { font-size: var(--text-sm); color: var(--success, #34c759); line-height: 1.5; font-weight: var(--weight-semi); }
      .im-fix__why    { font-size: var(--text-xs); color: var(--text-secondary); }

      .im-foot {
        flex-shrink: 0; border-top: 1px solid var(--border);
        padding: var(--space-3) var(--space-4) calc(var(--space-3) + env(safe-area-inset-bottom, 0px));
        display: flex; flex-direction: column; gap: var(--space-2); background: var(--bg);
      }
      .im-foot--row { flex-direction: row; }
      .im-foot--row .im-btn { flex: 1; }

      .im-btn {
        display: flex; align-items: center; justify-content: center; gap: var(--space-2);
        width: 100%; padding: var(--space-3) var(--space-4);
        border-radius: var(--radius-md);
        background: var(--bg-secondary); border: 1px solid var(--border);
        color: var(--text-primary); font-size: var(--text-base); font-weight: var(--weight-bold);
        transition: transform var(--t), opacity var(--t);
      }
      .im-btn:active { transform: scale(0.98); }
      .im-btn:disabled { opacity: 0.45; }
      .im-btn--primary { background: var(--btn-bg); color: var(--btn-text); border-color: transparent; }

      .im-note {
        font-size: var(--text-xs); color: var(--text-secondary);
        text-align: center; line-height: 1.5;
      }
      .im-warn {
        display: flex; align-items: center; justify-content: center; gap: 6px;
        font-size: var(--text-xs); color: var(--danger); text-align: center; line-height: 1.5;
      }
    `}</style>
  );
});
