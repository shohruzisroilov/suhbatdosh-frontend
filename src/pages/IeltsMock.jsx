import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, X, RotateCcw, Check, AlertTriangle, GraduationCap, Clock, MicOff, Zap, Award } from 'lucide-react';
import useAppStore from '../store/useAppStore.js';
import { useT } from '../i18n/index.js';
import { useSpeech } from '../hooks/useSpeech.js';
import { useRecorder } from '../hooks/useRecorder.js';
import ReviewPrompt from '../components/ReviewPrompt.jsx';
import BandScale from '../components/BandScale.jsx';
import CertificateModal from '../components/CertificateModal.jsx';
import { tapHaptic, selectionHaptic } from '../utils/haptics.js';
import {
  startIeltsTest,
  getIeltsTest,
  sendIeltsAnswer,
  answerTimeout,
  finishIeltsTest,
  abandonIeltsTest,
} from '../api/endpoints';

/**
 * IELTS Speaking mock.
 *
 * Ekran imtihonni O'TKAZMAYDI — u serverdagi skriptni ijro etadi. Har qadamda
 * server bitta savol beradi; ekran uni o'qib beradi, javobni yozib oladi va
 * qaytaradi. Keyingi savol nima bo'lishini ekran bilmaydi.
 *
 * Nega savol matni ko'rsatilmaydi: haqiqiy imtihonda nomzod savolni FAQAT
 * eshitadi. Ekranda matn tursa mashq boshqa narsaga aylanadi — o'qib javob
 * berishga. Yagona istisno — Part 2 cue card: u haqiqiy imtihonda ham
 * qog'ozda beriladi.
 *
 * Vaqt chegaralari serverdan keladi va qat'iy: Part 2 da roppa-rosa 1 daqiqa
 * tayyorgarlik va maksimum 2 daqiqa nutq. Ularni o'tkazib yuborish yo'li yo'q,
 * chunki imtihonda ham yo'q.
 */

const PART_LABEL = { 1: 'Part 1', 2: 'Part 2', 3: 'Part 3' };

/**
 * Kutishning qat'iy shifti.
 *
 * Qayta urinish o'zi foydali, lekin nazoratsiz qoldirilsa zarari foydasidan
 * ko'p: to'rt urinish × bir daqiqalik timeout imtihon o'rtasida odamni yetti
 * daqiqa qimirlamas ekranga mixlab qo'yadi. Aloqa tiklanmasa buni bir daqiqada
 * bilgan va nazoratni o'z qo'liga olgan afzal.
 *
 * Byudjet butun zanjirga tegishli, bitta urinishga emas: har urinishning
 * timeout'i qolgan vaqtga qisqartiriladi va vaqt tugagach yangisi
 * rejalashtirilmaydi. Ya'ni bu raqamlar — ekranda kutib turish vaqtining
 * yuqori chegarasi, taxmin emas.
 */
const UPLOAD_BUDGET_MS = 75_000;

// Baholash chinakam uzoq ishlaydi — model o'n daqiqalik ovozni tinglaydi —
// shuning uchun byudjet kattaroq. Bu yerda kutish og'riqsizroq ham: imtihon
// tugagan, foydalanuvchi natijani kutyapti va javoblari allaqachon serverda.
const MARK_BUDGET_MS = 240_000;

function fmtClock(ms) {
  const s = Math.max(Math.floor(ms / 1000), 0);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function IeltsMock() {
  const { navigate, ieltsStatus, setIeltsStatus } = useAppStore();
  const t = useT();

  // 'intro' | 'running' | 'marking' | 'report'
  const [stage, setStage] = useState('intro');
  // 'examiner' | 'prep' | 'answering' | 'uploading'
  const [phase, setPhase] = useState('examiner');

  const [test, setTest] = useState(null);       // { testId, title, total, answerable }
  const [step, setStep] = useState(null);
  const [answered, setAnswered] = useState(0);
  const [prepLeft, setPrepLeft] = useState(0);
  const [starting, setStarting] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);
  // Qayta urinilyaptimi — ekranda aytiladi. Jim kutish qotib qolgandan
  // farq qilmaydi: foydalanuvchi ilova ishlayotganini ko'rishi kerak.
  const [retrying, setRetrying] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [fatal, setFatal] = useState(null);     // 'limit' | 'off' | 'short' | 'failed'
  const [showText, setShowText] = useState(false); // TTS ishlamasa savol matni
  const [testMode, setTestMode] = useState('quick'); // 'quick' (3 min) | 'full' (14 min)

  // useSpeech'dan faqat TTS kerak — savolni ekzaminator ovozida o'qish uchun.
  // Nutqni matnga o'girish bu yerda ishlatilmaydi: baholovchiga ovozning
  // o'zi boradi.
  const { speak, cancelSpeech, unlockAudio, ttsSupported } = useSpeech({ lang: 'en-GB' });
  const recorder = useRecorder();

  const testRef = useRef(null);
  // Yuborilmagan javob — tarmoq uzilsa yozuv yo'qolmasligi kerak.
  const pendingRef = useRef(null);
  const finishedRef = useRef(false);
  // Rejalashtirilgan qayta urinish. Bitta ref ikkalasiga yetadi — javob
  // yuborish va baholash bir vaqtda hech qachon kutmaydi. Ekran yopilganda
  // tozalanishi shart, aks holda tashlab ketilgan imtihonga so'rov ketadi.
  const retryTimerRef = useRef(null);

  // ─── Yordamchilar ──────────────────────────────────────────────────────────

  /**
   * Matnni o'qiydi va tugagach hal bo'ladigan promise qaytaradi.
   *
   * Nazorat taymeri bor va u shart: brauzer nutq sintezi ba'zan (ayniqsa
   * Chrome'da, uzunroq matnda) o'rtasida uzilib qoladi va "o'qib bo'ldim"
   * signalini umuman bermaydi. Bunda imtihon shu qadamda abadiy muzlab
   * qolardi. Taymer eng yomon holatda ham keyingi bosqichga o'tkazadi.
   */
  const say = useCallback(
    (text) =>
      new Promise((resolve) => {
        if (!text) { resolve(); return; }

        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          clearTimeout(guard);
          resolve();
        };
        // Taxminiy o'qish vaqti + zaxira. Ingliz nutqi ~14 belgi/soniya.
        const guard = setTimeout(finish, Math.min(6000 + text.length * 90, 60_000));

        if (!ttsSupported) {
          // Ovoz yo'q — savolni yozma ko'rsatishdan boshqa iloj yo'q, aks
          // holda nomzod nimaga javob berishini bilmaydi. O'qish vaqti
          // o'rniga uzunlikka mos pauza beramiz.
          setShowText(true);
          clearTimeout(guard);
          setTimeout(resolve, Math.min(2500 + text.length * 45, 15_000));
          return;
        }
        speak(text, finish);
      }),
    [speak, ttsSupported]
  );

  /** Tayyorgarlik daqiqasi. Bekor qilinsa to'xtaydi. */
  const countdown = useCallback(
    (seconds, isCancelled) =>
      new Promise((resolve) => {
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

  // ─── Baholash ──────────────────────────────────────────────────────────────

  /**
   * @param {{attempt?:number, deadline?:number, manual?:boolean}} opts
   *   `manual` — foydalanuvchi natija ekranidagi tugmani bosdi. Qo'riqchi
   *   faqat avtomatik chaqiruvga tegishli (u imtihon oqimidan ikki marta
   *   kelishi mumkin), qo'lda urinishni to'sib qo'ymasligi kerak.
   */
  const runMarking = useCallback(async ({ attempt = 0, deadline, manual = false } = {}) => {
    if (finishedRef.current && attempt === 0 && !manual) return;
    finishedRef.current = true;
    const until = deadline ?? Date.now() + MARK_BUDGET_MS;

    recorder.release();
    cancelSpeech();
    setRetrying(attempt > 0);
    setStage('marking');
    setIeltsStatus(null); // qolgan urinishlar soni o'zgardi

    try {
      const data = await finishIeltsTest(testRef.current, Math.min(180_000, until - Date.now()));
      setRetrying(false);
      setFeedback(data.feedback);
      setStage('report');
    } catch (err) {
      const status = err?.response?.status;
      const transient = !status || status >= 500 || status === 429;
      // 429 — model kvotasi. U daqiqalik oynada tiklanadi, ya'ni ikki
      // soniyadan keyingi urinish aynan o'sha xatoni qaytaradi va byudjetni
      // behuda yeydi. Server qancha kutishni `Retry-After` da aytadi.
      const hinted = Number(err?.response?.headers?.['retry-after']) * 1000;
      const delay = status === 429
        ? Math.min(Number.isFinite(hinted) && hinted > 0 ? hinted : 30_000, 90_000)
        : 2000 * (attempt + 1);
      // Byudjetda mazmunli urinishga joy qolgandagina davom etamiz — 10
      // soniyadan kam qolganda yangi chaqiruv baribir kesiladi.
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
  }, [recorder, cancelSpeech]);

  // ─── Javobni yuborish ──────────────────────────────────────────────────────

  const upload = useCallback(async (answer, { attempt = 0, deadline } = {}) => {
    const { stepIndex, blob, ms } = answer;
    pendingRef.current = answer;
    const until = deadline ?? Date.now() + UPLOAD_BUDGET_MS;
    setPhase('uploading');
    setUploadFailed(false);
    setRetrying(attempt > 0);

    try {
      const data = await sendIeltsAnswer(
        testRef.current, stepIndex, blob, ms,
        // Urinish byudjetdan uzun yashay olmaydi — shift shu yerda ushlanadi.
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
    } catch (err) {
      const status = err?.response?.status;

      // 413 — yozuv juda katta. Qayta urinish yordam bermaydi, javobsiz
      // o'tamiz: bitta savol yo'qolgani butun imtihonni to'xtatishdan afzal.
      if (status === 413) {
        upload({ stepIndex, blob: null, ms: 0 });
        return;
      }
      // 409 — mijoz va server qadamlari ajralib qolgan (masalan javob
      // yetib borgan, lekin javob paketi yo'qolgan). Serverning holatiga
      // qaytamiz: u haqiqat manbasi.
      if (status === 409) {
        try {
          const fresh = await getIeltsTest(testRef.current);
          pendingRef.current = null;
          setRetrying(false);
          if (!fresh.step) { runMarking(); return; }
          setAnswered(fresh.step.i);
          setStep(fresh.step);
          return;
        } catch { /* pastdagi xato ekraniga tushamiz */ }
      }

      // Qayta urinishga arziydigan xatolar: tarmoq uzilishi yoki timeout
      // (javob umuman kelmagan, status yo'q), serverning o'tkinchi nosozligi
      // (5xx — qayta ishga tushish, proxy 502/504) va rate limit (429).
      // Qolganlari — 400, 401, 404 — takrorlashdan tuzalmaydi, ularda darhol
      // xatoni ko'rsatgan halolroq.
      const transient = !status || status >= 500 || status === 429;
      // 429 ning oynasi bir daqiqalik — bir-ikki soniya kutish limitni ochmaydi.
      const delay = status === 429 ? 8000 : 1500 * (attempt + 1);
      // Byudjetda pauza ustiga hech bo'lmasa besh soniyalik urinish sig'masa,
      // urinmaymiz: foydalanuvchini yana yarim daqiqa kutdirib, oxirida
      // baribir shu xatoni ko'rsatish — eng yomon variant.
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
    // Qo'lda urinish rejalashtirilganini bekor qiladi — ikkitasi birga
    // ketmasin.
    clearTimeout(retryTimerRef.current);
    if (pendingRef.current) upload(pendingRef.current);
  }, [upload]);

  // Ekran yopilgach kutib turgan urinish ishlamasin: imtihon tashlab
  // ketilgan bo'ladi va javob endi hech qayerga bormaydi.
  useEffect(() => () => clearTimeout(retryTimerRef.current), []);

  // ─── Qadamni ijro etish ────────────────────────────────────────────────────
  //
  // Butun qadam bitta effektda: ekzaminator gapiradi -> (Part 2 da)
  // tayyorgarlik -> yozib olish -> yuborish. Qadam almashsa yoki ekran
  // yopilsa `cancelled` orqali oqim uziladi.
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
        // Karta ekranda paydo bo'ladi va ekzaminator mavzuni o'qib beradi —
        // haqiqiy imtihonda ham u kartani berib, mavzuni ovoz chiqarib aytadi.
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
    // recorder/say barqaror emas, lekin qadam indeksi o'zgarmasa oqim qayta
    // ishga tushmasligi kerak — shuning uchun qaramlik faqat qadamga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, step?.i]);

  // ─── Boshlash ──────────────────────────────────────────────────────────────

  /**
   * Imtihonni boshlaydi yoki tugallanmaganini davom ettiradi.
   *
   * Davom ettirish shart: Telegram Mini App ekrani telefon qo'ng'irog'i yoki
   * ilova almashtirishda yopilib qolishi oddiy hol. Bunda o'n daqiqalik
   * mehnat ham, kunlik urinish ham yo'qolib ketmasligi kerak — server qaysi
   * qadamda to'xtaganini biladi.
   */
  const begin = useCallback(async (resumeId, modeOverride) => {
    if (starting) return;
    tapHaptic('medium');
    setStarting(true);

    // iOS ovozni ham, mikrofonni ham faqat foydalanuvchi harakati ichida
    // ochadi — ikkalasini shu bosishda so'raymiz.
    unlockAudio();
    const micReady = await recorder.prime();
    if (!micReady) { setStarting(false); return; }

    try {
      const modeToUse = modeOverride || testMode;
      const data = resumeId ? await getIeltsTest(resumeId) : await startIeltsTest({ mode: modeToUse });
      if (resumeId && (!data.step || data.status !== 'active')) {
        // Server tomonda allaqachon yopilgan — yangisini boshlaymiz.
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
    } catch (err) {
      const status = err?.response?.status;
      setFatal(status === 429 ? 'limit' : status === 503 ? 'off' : 'failed');
    } finally {
      setStarting(false);
    }
  }, [starting, unlockAudio, recorder, ieltsStatus, setIeltsStatus, testMode]);

  // ─── Chiqish ───────────────────────────────────────────────────────────────

  const leave = useCallback(() => {
    cancelSpeech();
    recorder.release();
    if (testRef.current && !finishedRef.current) {
      abandonIeltsTest(testRef.current).catch(() => {});
    }
    // Keshdagi holat endi eskirgan: qolgan urinishlar soni ham, tugallanmagan
    // imtihon ham o'zgardi. null qo'yamiz — karta keyingi ochilishida qayta
    // so'raydi.
    setIeltsStatus(null);
    navigate('home');
  }, [cancelSpeech, recorder, navigate, setIeltsStatus]);

  const confirmLeave = useCallback(() => {
    if (stage !== 'running') { leave(); return; }
    const message = t('ielts.quitConfirm');
    const tg = window.Telegram?.WebApp;
    if (tg?.showConfirm) {
      tg.showConfirm(message, (ok) => { if (ok) leave(); });
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

  // Mikrofon rad etilgan bo'lsa imtihonni boshlashning ma'nosi yo'q.
  const micDenied = recorder.error === 'denied';
  const micBroken = !recorder.supported || recorder.error === 'failed';
  // Tugallanmagan imtihon — Home/Matching allaqachon holatni yuklab qo'ygan.
  const resumeId = ieltsStatus?.active?.testId ?? null;
  const resumeMode = ieltsStatus?.active?.mode ?? null;

  // Davom ettiriladigan imtihon bor bo'lsa, kirish ekrani AYNAN o'sha
  // imtihonni tasvirlashi kerak. Aks holda ekran "3 daqiqa, faqat Part 1"
  // deb turadi-yu, "Davom ettirish" tugmasi to'liq mockni ochadi.
  useEffect(() => {
    if (resumeMode === 'quick' || resumeMode === 'full') setTestMode(resumeMode);
  }, [resumeMode]);

  // ─── Xato ekranlari ────────────────────────────────────────────────────────

  if (fatal && stage !== 'report') {
    const isLimit = fatal === 'limit';
    // Limitga urilgan bepul foydalanuvchiga Premium taklif qilinadi; boshqa
    // barcha holatda faqat uyga qaytish tugmasi bo'ladi.
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

  // ─── Kirish ekrani ─────────────────────────────────────────────────────────

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

          {/* Qadamlar ro'yxati faqat to'liq mockka tegishli. Quick rejimda
              Part 2 va Part 3 umuman yo'q — ularni baribir ko'rsatish
              foydalanuvchiga bo'lmaydigan narsani va'da qilish bo'lardi. */}
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

  // ─── Baholanmoqda ──────────────────────────────────────────────────────────

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

  // ─── Natija ────────────────────────────────────────────────────────────────

  if (stage === 'report') {
    return (
      <Report
        t={t}
        feedback={feedback}
        error={fatal}
        // Baholash uzilib qolgan bo'lsa qayta so'rash deyarli bepul: model
        // ishlab bo'lgan bo'lsa natija serverda saqlangan va darhol qaytadi.
        // Busiz tayyor hisobot yetib bo'lmas joyda qolib ketardi — urinish
        // esa allaqachon sarflangan.
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

  // ─── Imtihon ───────────────────────────────────────────────────────────────

  const isCue = step?.kind === 'cue';
  const timeLeftMs = phase === 'answering' && step ? step.maxSec * 1000 - recorder.elapsedMs : 0;
  // Part 2 da qolgan vaqt haqiqiy imtihondagidek muhim — nomzod 2 daqiqani
  // to'ldirishi kerak. Part 1/3 da esa taymer ko'rsatilmaydi: u nomzodni
  // shoshiradi va ekzaminator ham vaqtni ko'rsatmaydi.
  const showTimer = isCue && phase === 'answering';

  // Yuborilmay qolganda `phase` hamon 'uploading' — yozuv hali qo'limizda va
  // qayta urinilishi mumkin. Lekin ekranda "yuborilmoqda" deb turishi yolg'on
  // bo'lardi: pastda ayni paytda "yuborilmadi" yozuvi turadi.
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
          /* Cue card — haqiqiy imtihonda ham yozma beriladi. */
          <div className="im-card">
            <p className="im-card__cue">{step.card.cue}</p>
            <p className="im-card__lead">{t('ielts.cardLead')}</p>
            <ul className="im-card__list">
              {step.card.bullets.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          </div>
        )}

        {!isCue && (
          <div className={`im-orb im-orb--${phase === 'answering' ? 'listen' : 'speak'}`}>
            {phase === 'answering' ? <Mic size={40} /> : <GraduationCap size={40} />}
          </div>
        )}

        {/* TTS ishlamaydigan qurilmada savol matni — aks holda nomzod
            nimaga javob berishini bilmaydi. */}
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

/* ─── Natija ekrani ───────────────────────────────────────────────────────── */

function Report({ t, feedback, error, onHome, onAgain, onRetryMark }) {
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
          {/* Hisobotni tiklash yangi imtihondan ustun turadi: javoblar
              berib bo'lingan, kerak bo'lgani — faqat natijani olish. */}
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
        {/* Umumiy ball — sahifadagi yagona ulkan raqam, va u chizg'ich
            ustida turadi. Yalang'och "6.5" 9 dan qanchaligini ko'rsatmaydi;
            shkala ko'rsatadi. */}
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

        {/* To'rt mezon — bir xil shkalada, ya'ni qaysi biri orqada
            qolayotgani bir qarashda ko'rinadi. Alohida raqam kartochkalari
            buni ko'rsatmasdi. */}
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
            {feedback.fixes.map((f, i) => (
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

        {/* Ball chiqqan lahza — odam mahsulotdan aynan nima olganini endigina
            ko'rdi. Review so'rash uchun eng to'g'ri payt shu. */}
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

/* ─── Umumiy karkas ───────────────────────────────────────────────────────── */

function Shell({ title, onClose, children }) {
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

// Yozib olish paytida ovoz darajasi soniyasiga 10 marta yangilanadi va
// butun ekranni qayta chizadi. Uslublar bunga aloqasi yo'q — memo ularni
// har tikda qayta qurishdan saqlaydi.
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

      /* ─── Kirish ─── */
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

      /* ─── Mode Select ─── */
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

      /* ─── Imtihon ─── */
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
      /* Mikrofon yoniqligi hech qachon shubhali bo'lmasligi kerak —
         bu maxfiylik masalasi, shuning uchun eng ko'zga tashlanadigan holat. */
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

      /* ─── Cue card ─── */
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

      /* ─── Natija ─── */
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

      /* ─── Pastki panel ─── */
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
