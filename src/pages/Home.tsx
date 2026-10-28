import { useEffect, useState, useMemo } from 'react';
import { getMe } from '../api/endpoints';
import useAppStore from '../store/useAppStore';
import { useT } from '../i18n';
import { tapHaptic, selectionHaptic } from '../utils/haptics';
import {
  Mic,
  ShieldCheck,
  ChevronRight,
  MessageSquare,
  Users,
  GraduationCap,
  Sparkles,
  Target,
  BookOpen,
  Volume2,
  Users2,
  Trophy,
} from 'lucide-react';

import HomeHeader from '../components/HomeHeader';
import SessionRow from '../components/SessionRow';
import SkeletonRow from '../components/SkeletonRow';
import TopicsLibraryModal from '../components/TopicsLibraryModal';
import MicTestModal from '../components/MicTestModal';
import PrivateRoomModal from '../components/PrivateRoomModal';
import { PART1 } from '../constants/speakingTopics';

/**
 * Bosh sahifa — Conversation-First layout with Mode Selection & Topic of the Day.
 */
export default function Home() {
  const {
    user,
    stats,
    recentSessions,
    setStats,
    setRecentSessions,
    setUser,
    navigate,
    homeLoaded,
    setHomeLoaded,
    partnerPref,
    setPartnerPref,
    waitingCount,
    callMode,
    setCallMode,
    setSpeakingState,
  } = useAppStore();
  const t = useT();

  const [showTopicsLib, setShowTopicsLib] = useState(false);
  const [showMicTest, setShowMicTest] = useState(false);
  const [showPrivateRoom, setShowPrivateRoom] = useState(false);

  const isFemale = user?.gender === 'female';
  const womenOnly = isFemale && partnerPref === 'female';

  // Topic of the day calculation
  const dayIndex = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now.getTime() - start.getTime() + (start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000;
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
    return dayOfYear % PART1.length;
  }, []);
  const todayTopic = PART1[dayIndex] || PART1[0];
  const todayQuestion = todayTopic.questions[0] || 'What is your favorite way to spend a weekend?';

  // Daily goal calculation (15 minutes)
  const dailyGoalMins = 15;
  const todayMins = useMemo(() => {
    if (!recentSessions || recentSessions.length === 0) return stats?.hasPracticedToday ? 15 : 0;
    const todayStr = new Date().toISOString().slice(0, 10);
    let sum = 0;
    for (const s of recentSessions) {
      if (s.ended_at && String(s.ended_at).startsWith(todayStr)) {
        const dur = Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000);
        if (dur > 0) sum += dur;
      }
    }
    return sum || (stats?.hasPracticedToday ? 15 : 0);
  }, [recentSessions, stats]);
  const goalReached = todayMins >= dailyGoalMins || !!stats?.hasPracticedToday;
  const goalPct = Math.min(100, Math.round((todayMins / dailyGoalMins) * 100));

  // Weekly challenge goal calculation (60 minutes)
  const weeklyGoalMins = 60;
  const weeklyMins = useMemo(() => {
    if (!recentSessions || recentSessions.length === 0) return Math.min(60, stats?.total_minutes || 0);
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let sum = 0;
    for (const s of recentSessions) {
      if (s.ended_at && new Date(s.ended_at).getTime() >= oneWeekAgo) {
        const dur = Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000);
        if (dur > 0) sum += dur;
      }
    }
    return sum || Math.min(60, stats?.total_minutes || 0);
  }, [recentSessions, stats]);
  const weeklyGoalReached = weeklyMins >= weeklyGoalMins;
  const weeklyGoalPct = Math.min(100, Math.round((weeklyMins / weeklyGoalMins) * 100));

  useEffect(() => {
    getMe()
      .then((d) => {
        setStats(d.stats);
        setRecentSessions(d.recentSessions);
        if (d.user) setUser(d.user);
      })
      .catch(() => {})
      .finally(() => setHomeLoaded(true));
  }, []);

  return (
    <div className="home">
      <HomeHeader
        user={user}
        streak={stats?.streakCount || 0}
        doneToday={stats?.hasPracticedToday || false}
      />

      <div className="home__scroll">

        {/* Xavfsizlik filtri (Ayollar / Girls uchun eng tepada) */}
        {isFemale && (
          <button
            type="button"
            className={`row${womenOnly ? ' row--on' : ''} fade-up`}
            onClick={() => { selectionHaptic(); setPartnerPref(womenOnly ? 'any' : 'female'); }}
            aria-pressed={womenOnly}
            style={{ marginBottom: '12px' }}
          >
            <span className={`row__ico${womenOnly ? ' row__ico--primary' : ''}`}>
              <ShieldCheck size={18} />
            </span>
            <span className="row__text">
              <span className="row__title">{t('match.pref.womenOnly')}</span>
              <span className="row__sub">{t('match.pref.womenOnlyHint')}</span>
            </span>
            <span className={`switch${womenOnly ? ' switch--on' : ''}`} />
          </button>
        )}


        {/* ── 1. ASOSIY QO'NG'IROQ MARKAZI (Hero Card) ── */}
        <section className="hero fade-up">
          <div className="hero__orb hero__orb--1" aria-hidden="true" />
          <div className="hero__orb hero__orb--2" aria-hidden="true" />
          <div className="hero__orb hero__orb--3" aria-hidden="true" />

          <div className="hero__inner">
            {/* Rejim tanlash (Free Talk yoki IELTS Practice) */}
            <div className="hero-mode-switch">
              <button
                type="button"
                className={`hero-mode-btn ${callMode === 'free' ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  selectionHaptic();
                  setCallMode('free');
                }}
              >
                <MessageSquare size={13} />
                <span>Free Talk</span>
              </button>
              <button
                type="button"
                className={`hero-mode-btn ${callMode === 'ielts' ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  selectionHaptic();
                  setCallMode('ielts');
                }}
              >
                <GraduationCap size={14} />
                <span>IELTS Practice</span>
              </button>
            </div>

            {/* Live badge & presence */}
            <div className="hero__top-row">
              <span className="hero__tag">
                <span className="hero__live-dot" />
                {waitingCount >= 2
                  ? t('home.heroLive', { n: waitingCount })
                  : waitingCount === 1
                    ? t('home.heroLiveOne')
                    : t('home.heroTag')}
              </span>
              {waitingCount > 0 && (
                <span className="hero__online-pill">
                  <Users size={11} />
                  <span>{waitingCount} online</span>
                </span>
              )}
            </div>

            {/* Sarlavha va Tavsif */}
            <div className="hero__content">
              <h1 className="hero__title">
                {callMode === 'ielts' ? 'IELTS Speaking Partner' : t('home.ctaTitle')}
              </h1>
              <p className="hero__sub">
                {callMode === 'ielts'
                  ? 'Practise Part 1, 2, and 3 cue cards with real partners'
                  : t('home.ctaSub')}
              </p>
            </div>

            {/* Boshqaruv tugmalari: Asosiy Sherik Topish + Do'st bilan Xona */}
            <div className="hero__actions-wrap">
              <button
                type="button"
                className="hero__main-btn"
                onClick={() => {
                  tapHaptic('heavy');
                  navigate('matching');
                }}
              >
                <div className="hero__mic-ring">
                  <div className="hero__mic-pulse" />
                  <div className="hero__mic-icon">
                    <Mic size={20} strokeWidth={2.5} />
                  </div>
                </div>
                <span>{callMode === 'ielts' ? 'Start IELTS Call' : t('home.start')}</span>
                <ChevronRight size={18} strokeWidth={2.5} />
              </button>

              <button
                type="button"
                className="hero__friend-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  tapHaptic('medium');
                  setShowPrivateRoom(true);
                }}
              >
                <Users2 size={16} />
                <span>Do'st bilan suhbat (Xona / Havola)</span>
              </button>
            </div>
          </div>
        </section>

        {/* ── 2. KUNLIK VA HAFTALIK MASHQ MAQSADI (Ixcham yagona kartochka) ── */}
        <div className="home-goal-card fade-up">
          <div className="home-goal-top">
            <div className="home-goal-label">
              <Target size={14} className="home-goal-icon" />
              <span>Daily Practice Goal</span>
            </div>
            <div className="home-goal-badges">
              <span className={`home-goal-badge ${goalReached ? 'done' : ''}`}>
                {goalReached ? '🎉 15m Done' : `${todayMins} / 15m`}
              </span>
              <span className={`home-goal-badge weekly ${weeklyGoalReached ? 'done' : ''}`}>
                <Trophy size={11} />
                <span>{weeklyGoalReached ? '🏆 60m' : `${weeklyMins}/60m`}</span>
              </span>
            </div>
          </div>
          <div className="home-goal-track">
            <div
              className={`home-goal-fill ${goalReached ? 'completed' : ''}`}
              style={{ width: `${goalReached ? 100 : Math.max(6, goalPct)}%` }}
            />
          </div>
        </div>

        {/* ── 3. BUGUNGI MAVZU (Icebreaker & Question Bank) ── */}
        <div className="home-topic-card fade-up">
          <div className="home-topic-head">
            <div className="home-topic-tag">
              <Sparkles size={13} />
              <span>Today's Topic · {todayTopic.title}</span>
            </div>
            <button
              type="button"
              className="home-topic-all-btn"
              onClick={() => {
                tapHaptic('light');
                setShowTopicsLib(true);
              }}
            >
              <BookOpen size={12} />
              <span>Question Bank</span>
              <ChevronRight size={12} />
            </button>
          </div>
          <p className="home-topic-question">“{todayQuestion}”</p>
          <span className="home-topic-hint">Break the ice on your next call with this question</span>
        </div>

        {/* ── 4. FOYDALI BO'LIMLAR (2 ta qulay kartochka: E'lonlar va Mikrofon) ── */}
        <div className="home-quick-grid fade-up">
          <button
            type="button"
            className="home-quick-item"
            onClick={() => {
              tapHaptic('medium');
              navigate('listings');
            }}
          >
            <div className="home-quick-icon" style={{ background: 'rgba(255, 159, 10, 0.12)', color: '#FF9F0A' }}>
              <Users size={18} />
            </div>
            <div className="home-quick-info">
              <strong>{t('home.listingsTitle')}</strong>
              <span>Find study partners or tutors</span>
            </div>
          </button>

          <button
            type="button"
            className="home-quick-item"
            onClick={() => {
              tapHaptic('light');
              setShowMicTest(true);
            }}
          >
            <div className="home-quick-icon" style={{ background: 'var(--primary-subtle)', color: 'var(--primary)' }}>
              <Volume2 size={18} />
            </div>
            <div className="home-quick-info">
              <strong>Mikrofonni sinash</strong>
              <span>Real-time audio visualizer</span>
            </div>
          </button>
        </div>

        {/* ── 5. OXIRGI SUHBATLAR TARIXI ── */}
        {!homeLoaded ? (
          <section className="home__section">
            <p className="eyebrow">{t('home.recent')}</p>
            <div className="home__sessions">
              {[0, 1, 2].map(i => <SkeletonRow key={i} avatar={40} />)}
            </div>
          </section>
        ) : (recentSessions?.length ?? 0) > 0 ? (
          <section className="home__section">
            <p className="eyebrow">{t('home.recent')}</p>
            <div className="home__sessions">
              {recentSessions.slice(0, 5).map((s: any) => <SessionRow key={s.id} session={s} />)}
            </div>
          </section>
        ) : (
          <section className="home__empty">
            <span className="home__empty-ico"><MessageSquare size={22} /></span>
            <p className="home__empty-title">{t('home.noSessions')}</p>
            <p className="home__empty-sub">{t('home.noSessionsSub')}</p>
          </section>
        )}

        <div className="home__foot" />
      </div>

      <style>{`
        /* ── Page Shell ── */
        .home { display: flex; flex-direction: column; height: 100%; overflow: hidden; background: var(--bg); }
        .home__scroll {
          flex: 1; overflow-y: auto;
          padding: var(--space-3) var(--space-4) calc(120px + env(safe-area-inset-bottom, 0px));
          display: flex; flex-direction: column; gap: var(--space-3);
        }
        .home__list { display: flex; flex-direction: column; gap: var(--space-2); }

        /* ── Hero / Find Partner Card ── */
        .hero {
          position: relative; isolation: isolate; overflow: hidden;
          flex-shrink: 0;
          background: linear-gradient(135deg, #00A8FF 0%, #0077EE 50%, #0055D4 100%);
          border: 1px solid rgba(255, 255, 255, 0.20);
          border-radius: var(--radius-lg);
          padding: 16px;
          display: flex; flex-direction: column;
          box-shadow: 0 8px 30px rgba(0, 168, 255, 0.35), 0 2px 8px rgba(0, 0, 0, 0.2);
          transition: transform 0.18s var(--ease-out), box-shadow 0.18s var(--ease-out);
          -webkit-tap-highlight-color: transparent;
        }

        /* Animated background orbs */
        .hero__orb {
          position: absolute; z-index: -1; border-radius: 50%; pointer-events: none;
        }
        .hero__orb--1 {
          width: 180px; height: 180px;
          top: -60px; right: -40px;
          background: radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%);
          animation: orbFloat1 6s ease-in-out infinite;
        }
        .hero__orb--2 {
          width: 100px; height: 100px;
          bottom: -30px; left: 20px;
          background: radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%);
          animation: orbFloat2 8s ease-in-out infinite;
        }
        .hero__orb--3 {
          width: 60px; height: 60px;
          top: 30px; right: 60px;
          background: radial-gradient(circle, rgba(255,255,255,0.10) 0%, transparent 70%);
          animation: orbFloat3 5s ease-in-out infinite;
        }
        @keyframes orbFloat1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-10px,8px) scale(1.05); } }
        @keyframes orbFloat2 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(8px,-6px); } }
        @keyframes orbFloat3 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-5px,5px) scale(0.95); } }

        .hero__inner { display: flex; flex-direction: column; gap: 12px; }

        /* Mode Switcher pill inside Hero */
        .hero-mode-switch {
          display: inline-flex;
          align-self: flex-start;
          gap: 3px;
          background: rgba(0, 0, 0, 0.22);
          padding: 3px;
          border-radius: var(--radius-full);
          backdrop-filter: blur(6px);
        }
        .hero-mode-btn {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 12px; border-radius: var(--radius-full);
          border: none; background: transparent;
          color: rgba(255, 255, 255, 0.85);
          font-size: 11px; font-weight: var(--weight-bold);
          cursor: pointer; transition: all 0.18s ease;
        }
        .hero-mode-btn.active {
          background: #FFFFFF;
          color: #0077EE;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }

        /* Top row: live badge + online count */
        .hero__top-row { display: flex; align-items: center; justify-content: space-between; }
        .hero__tag {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 10px;
          border-radius: var(--radius-full);
          background: rgba(255, 255, 255, 0.20);
          border: 1px solid rgba(255, 255, 255, 0.30);
          color: #FFFFFF;
          font-size: 11px; font-weight: var(--weight-bold);
          letter-spacing: 0.02em;
          backdrop-filter: blur(4px);
        }
        .hero__live-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: #86EFAC;
          box-shadow: 0 0 6px #86EFAC;
          animation: livePulse 1.8s ease-in-out infinite;
          flex-shrink: 0;
        }
        @keyframes livePulse {
          0%,100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.7; }
        }
        .hero__online-pill {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 8px;
          border-radius: var(--radius-full);
          background: rgba(134, 239, 172, 0.20);
          border: 1px solid rgba(134, 239, 172, 0.35);
          color: #86EFAC;
          font-size: 10px; font-weight: var(--weight-bold);
        }

        /* Title & sub */
        .hero__content { display: flex; flex-direction: column; gap: 4px; }
        .hero__title {
          font-family: var(--font-display);
          font-size: 20px; font-weight: var(--weight-heavy);
          color: #FFFFFF; letter-spacing: -0.02em;
          line-height: 1.15;
          text-shadow: 0 1px 3px rgba(0,0,0,0.15);
        }
        .hero__sub {
          font-size: 13px; line-height: 1.4;
          color: rgba(255, 255, 255, 0.85);
        }

        /* CTA buttons inside Hero */
        .hero__actions-wrap {
          display: flex; flex-direction: column; gap: 8px; margin-top: 4px;
        }
        .hero__main-btn {
          display: flex; align-items: center; justify-content: center; gap: 10px;
          min-height: 48px; width: 100%;
          background: #FFFFFF; color: #0077EE;
          border-radius: var(--radius-md); border: none;
          font-size: 15px; font-weight: var(--weight-heavy);
          letter-spacing: -0.01em;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
          cursor: pointer;
          transition: transform 0.15s var(--ease-out);
        }
        .hero__main-btn:active {
          transform: scale(0.97);
        }
        .hero__mic-ring {
          position: relative; flex-shrink: 0;
          width: 30px; height: 30px;
          display: flex; align-items: center; justify-content: center;
        }
        .hero__mic-pulse {
          position: absolute; inset: -3px;
          border-radius: 50%;
          border: 1.5px solid rgba(0, 119, 238, 0.3);
          animation: micRingPulse 2s ease-out infinite;
        }
        @keyframes micRingPulse {
          0% { transform: scale(0.85); opacity: 0.9; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        .hero__mic-icon {
          display: flex; align-items: center; justify-content: center;
          color: #0077EE;
        }
        .hero__friend-btn {
          display: flex; align-items: center; justify-content: center; gap: 6px;
          min-height: 38px; width: 100%;
          background: rgba(255, 255, 255, 0.18);
          color: #FFFFFF;
          border: 1px solid rgba(255, 255, 255, 0.32);
          border-radius: var(--radius-md);
          font-size: 12px; font-weight: var(--weight-bold);
          cursor: pointer;
          backdrop-filter: blur(4px);
          transition: all 0.15s ease;
        }
        .hero__friend-btn:active {
          transform: scale(0.98);
          background: rgba(255, 255, 255, 0.28);
        }

        /* ── Unified Practice Goal Card ── */
        .home-goal-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-md); padding: 12px 14px;
          display: flex; flex-direction: column; gap: 8px;
        }
        .home-goal-top {
          display: flex; align-items: center; justify-content: space-between;
        }
        .home-goal-label {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 12px; font-weight: var(--weight-bold);
          color: var(--text-primary);
        }
        .home-goal-icon { color: var(--primary); }
        .home-goal-badges {
          display: inline-flex; align-items: center; gap: 6px;
        }
        .home-goal-badge {
          font-size: 11px; font-weight: var(--weight-heavy);
          padding: 2px 7px; border-radius: var(--radius-full);
          background: var(--surface-2); color: var(--text-secondary);
        }
        .home-goal-badge.done {
          background: rgba(52, 199, 89, 0.14); color: var(--success);
        }
        .home-goal-badge.weekly {
          display: inline-flex; align-items: center; gap: 3px;
          color: #FFB300; background: rgba(255, 179, 0, 0.12);
        }
        .home-goal-badge.weekly.done {
          color: #FF9F0A; background: rgba(255, 159, 10, 0.18);
        }
        .home-goal-track {
          height: 6px; border-radius: var(--radius-full);
          background: var(--surface-2); overflow: hidden;
        }
        .home-goal-fill {
          height: 100%; border-radius: var(--radius-full);
          background: var(--grad-primary); transition: width 0.4s ease;
        }
        .home-goal-fill.completed {
          background: linear-gradient(90deg, #34C759, #30D158);
        }

        /* ── Topic of the Day Card ── */
        .home-topic-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-md); padding: 12px 14px;
          display: flex; flex-direction: column; gap: 6px;
        }
        .home-topic-head {
          display: flex; align-items: center; justify-content: space-between;
        }
        .home-topic-tag {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 11px; font-weight: var(--weight-bold);
          color: var(--primary); text-transform: uppercase; letter-spacing: 0.04em;
        }
        .home-topic-all-btn {
          display: inline-flex; align-items: center; gap: 3px;
          background: var(--primary-subtle); border: 1px solid rgba(0, 168, 255, 0.2);
          color: var(--primary); padding: 3px 8px; border-radius: var(--radius-full);
          font-size: 10px; font-weight: var(--weight-bold); cursor: pointer;
        }
        .home-topic-all-btn:active { transform: scale(0.95); }
        .home-topic-question {
          font-size: 13px; font-weight: var(--weight-semibold); color: var(--text-primary);
          line-height: 1.35; margin: 0;
        }
        .home-topic-hint {
          font-size: 11px; color: var(--text-tertiary);
        }

        /* ── Quick Tools Grid (Listings & Mic Test) ── */
        .home-quick-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
        }
        .home-quick-item {
          display: flex; flex-direction: column; align-items: flex-start;
          gap: 6px; background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-md); padding: 12px;
          text-align: left; cursor: pointer; transition: all 0.15s ease;
          position: relative;
        }
        .home-quick-item:active {
          transform: scale(0.97); background: var(--surface-2);
        }
        .home-quick-icon {
          width: 32px; height: 32px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
        }
        .home-quick-info {
          display: flex; flex-direction: column; gap: 2px;
        }
        .home-quick-info strong {
          font-size: 12px; font-weight: var(--weight-bold);
          color: var(--text-primary); line-height: 1.25;
        }
        .home-quick-info span {
          font-size: 11px; color: var(--text-secondary); line-height: 1.2;
        }

        .home__section { display: flex; flex-direction: column; gap: var(--space-2); }
        .home__section-head { display: flex; align-items: center; justify-content: space-between; }

        /* ── Toggle Row extras ── */
        .row--on { border-color: var(--btn-bg); }
        .row__arrow { color: var(--text-secondary); flex-shrink: 0; }
        .switch {
          flex-shrink: 0; width: 40px; height: 24px; border-radius: var(--radius-full);
          background: var(--surface-2); border: 1px solid var(--border);
          position: relative; transition: background var(--t), border-color var(--t);
        }
        .switch::after {
          content: ''; position: absolute; top: 2px; left: 2px;
          width: 18px; height: 18px; border-radius: 50%;
          background: var(--text-secondary);
          transition: transform var(--t), background var(--t);
        }
        .switch--on { background: var(--btn-bg); border-color: var(--btn-bg); }
        .switch--on::after { transform: translateX(16px); background: var(--btn-text); }

        /* ── Sessions list ── */
        .home__sessions { display: flex; flex-direction: column; gap: var(--space-1-5); }

        /* ── Empty state ── */
        .home__empty {
          display: flex; flex-direction: column; align-items: center; gap: var(--space-2);
          padding: var(--space-6) var(--space-5); text-align: center;
          background: var(--bg-secondary); border: 1px solid var(--border);
          border-radius: var(--radius-lg);
        }
        .home__empty-ico {
          width: 48px; height: 48px; border-radius: var(--radius-full);
          display: flex; align-items: center; justify-content: center;
          background: var(--btn-bg-soft); color: var(--btn-bg);
          margin-bottom: var(--space-1);
        }

        .home__foot { padding-bottom: var(--space-2); }
      `}</style>

      {/* Standalone Question Bank & Topics Library Sheet */}
      <TopicsLibraryModal
        isOpen={showTopicsLib}
        onClose={() => setShowTopicsLib(false)}
        onSelectTopic={(topicId, part) => {
          setSpeakingState(topicId, part, 0);
          setShowTopicsLib(false);
        }}
      />

      {/* Real-time Audio Visualizer Mic Check Modal */}
      <MicTestModal
        isOpen={showMicTest}
        onClose={() => setShowMicTest(false)}
      />

      {/* Direct Private Room with a Friend Modal */}
      <PrivateRoomModal
        isOpen={showPrivateRoom}
        onClose={() => setShowPrivateRoom(false)}
        onJoinRoom={(code) => {
          setShowPrivateRoom(false);
          navigate('matching', { roomCode: code });
        }}
        botUsername={user?.username || 'suhbatdoshbot'}
      />
    </div>
  );
}

