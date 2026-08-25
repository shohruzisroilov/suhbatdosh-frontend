import React, { useState, useEffect, useRef } from 'react';
import useAppStore from '../store/useAppStore';
import { useSocket } from '../hooks/useSocket';
import { topicsForPart, findTopic } from '../constants/speakingTopics';
import { useT } from '../i18n';
import { selectionHaptic, tapHaptic } from '../utils/haptics';
import { Bell, Star } from 'lucide-react';
import Icebreakers from './Icebreakers';
import { SavedQuestion } from '../types';

const PART_META = [
  { part: 1, descKey: 'sq.part1.desc' },
  { part: 2, descKey: 'sq.part2.desc' },
  { part: 3, descKey: 'sq.part3.desc' },
];

const PART_ACCENT: Record<number, string> = {
  1: '59 130 246',
  2: '139 92 246',
  3: '16 185 129',
};
const SAVED_ACCENT = '245 179 1';

interface SpeakingQuestionsProps {
  onDetailChange?: (inDetail: boolean) => void;
}

export default function SpeakingQuestions({ onDetailChange }: SpeakingQuestionsProps) {
  const {
    session,
    speakingTopicId,
    speakingPart,
    speakingQuestionIndex,
    setSpeakingState,
    savedQuestions,
    toggleSavedQuestion,
  } = useAppStore();
  const { changeSpeakingTopic } = useSocket();
  const t = useT();

  const [view, setView] = useState<'parts' | 'topics' | 'questions' | 'saved'>('parts');
  const [browsePart, setBrowsePart] = useState(1);
  const [query, setQuery] = useState('');
  const [pendingPartnerChange, setPendingPartnerChange] = useState(false);

  const viewRef = useRef(view);
  viewRef.current = view;
  const localActionRef = useRef(false);

  const [prepTimeLeft, setPrepTimeLeft] = useState(60);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (localActionRef.current) {
      localActionRef.current = false;
      return;
    }
    if (viewRef.current !== 'questions') {
      setPendingPartnerChange(true);
    }
  }, [speakingTopicId, speakingPart, speakingQuestionIndex]);

  const mountedRef = useRef(false);

  useEffect(() => {
    stopTimer();
    setPrepTimeLeft(60);
  }, [speakingTopicId, speakingPart]);

  useEffect(() => () => stopTimer(), []);

  useEffect(() => {
    onDetailChange?.(view !== 'parts');
  }, [view, onDetailChange]);

  useEffect(() => () => onDetailChange?.(false), [onDetailChange]);

  const startTimer = () => {
    if (timerRunning) return;
    setTimerRunning(true);
    timerRef.current = setInterval(() => {
      setPrepTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setTimerRunning(false);
          (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimerRunning(false);
  };

  const resetTimer = () => {
    stopTimer();
    setPrepTimeLeft(60);
  };

  if (!session) return null;

  const topic = findTopic(speakingPart, speakingTopicId);

  const applySelection = (topicId: string, part: number, qIdx: number) => {
    localActionRef.current = true;
    setSpeakingState(topicId, part, qIdx);
    if (session?.id) {
      changeSpeakingTopic(session.id, topicId, part, qIdx);
    }
  };

  const viewPartnerChange = () => {
    tapHaptic('light');
    setPendingPartnerChange(false);
    setView('questions');
  };

  const openPart = (part: number) => {
    selectionHaptic();
    setBrowsePart(part);
    setQuery('');
    setView('topics');
  };

  const openTopic = (topicId: string) => {
    selectionHaptic();
    setPendingPartnerChange(false);
    applySelection(topicId, browsePart, 0);
    setView('questions');
  };

  const pickQuestion = (i: number) => {
    selectionHaptic();
    applySelection(speakingTopicId, speakingPart, i);
  };

  const isSaved = (part: number, topicId: string, index = 0) =>
    savedQuestions.some(
      (s) => s.part === part && s.topicId === topicId && (s.index ?? 0) === index
    );

  const toggleSave = (item: SavedQuestion) => {
    selectionHaptic();
    toggleSavedQuestion(item);
  };

  const openSaved = (s: SavedQuestion) => {
    selectionHaptic();
    setPendingPartnerChange(false);
    if (s.topicId) applySelection(s.topicId, s.part, s.index ?? 0);
    setView('questions');
  };

  const backToParts = () => {
    tapHaptic('light');
    setView('parts');
  };
  const backToTopics = () => {
    tapHaptic('light');
    setBrowsePart(speakingPart);
    setView('topics');
  };

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const partnerBanner = pendingPartnerChange ? (
    <button className="sq-banner" onClick={viewPartnerChange}>
      <Bell size={13} /> {t('sq.partnerPicked')}
    </button>
  ) : null;

  if (view === 'parts') {
    return (
      <div className="sq sq--parts">
        {partnerBanner}
        <Icebreakers />
        <div className="sq-grid">
          {PART_META.map(({ part, descKey }) => (
            <button
              key={part}
              className="sq-tile"
              style={{ '--acc': PART_ACCENT[part] } as React.CSSProperties}
              onClick={() => openPart(part)}
            >
              <span className="sq-tile__num">{part}</span>
              <span className="sq-tile__title">{t('sq.part', { n: part })}</span>
              <span className="sq-tile__desc">{t(descKey)}</span>
            </button>
          ))}
          <button
            className="sq-tile sq-tile--saved"
            style={{ '--acc': SAVED_ACCENT } as React.CSSProperties}
            onClick={() => {
              selectionHaptic();
              setView('saved');
            }}
          >
            <span className="sq-tile__emoji">
              <Star size={20} />
            </span>
            <span className="sq-tile__title">{t('sq.saved')}</span>
            <span className="sq-tile__desc">
              {savedQuestions.length
                ? t('sq.savedCount', { n: savedQuestions.length })
                : t('sq.savedDesc')}
            </span>
          </button>
        </div>
        <style>{css}</style>
      </div>
    );
  }

  if (view === 'saved') {
    return (
      <div className="sq" style={{ '--acc': SAVED_ACCENT } as React.CSSProperties}>
        {partnerBanner}
        <div className="sq-nav">
          <button className="sq-back" onClick={backToParts}>
            ‹ {t('sq.parts')}
          </button>
          <span className="sq-nav__title">
            <Star size={14} /> {t('sq.saved')}
          </span>
        </div>
        {savedQuestions.length === 0 ? (
          <p className="sq-empty">{t('sq.savedEmpty')}</p>
        ) : (
          <div className="sq-qlist">
            {savedQuestions.map((s) => (
              <div key={`${s.part}:${s.topicId}:${s.index ?? 0}`} className="sq-qrow">
                <button className="sq-qrow__pick" onClick={() => openSaved(s)}>
                  <span className="sq-qrow__tag">
                    {t('sq.part', { n: s.part })} · {s.topicTitle}
                  </span>
                  <span className="sq-qrow__text">{s.text}</span>
                </button>
                <button
                  className="sq-star sq-star--on"
                  onClick={() => toggleSave(s)}
                  aria-label="Unsave"
                >
                  <Star size={17} fill="currentColor" strokeWidth={0} />
                </button>
              </div>
            ))}
          </div>
        )}
        <style>{css}</style>
      </div>
    );
  }

  if (view === 'topics') {
    return (
      <div className="sq" style={{ '--acc': PART_ACCENT[browsePart] } as React.CSSProperties}>
        {partnerBanner}
        <div className="sq-nav">
          <button className="sq-back" onClick={backToParts}>
            ‹ {t('sq.parts')}
          </button>
          <span className="sq-nav__title">{t('sq.part', { n: browsePart })}</span>
        </div>
        <input
          className="sq-search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('sq.search')}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <div className="sq-topics">
          {(() => {
            const q = query.trim().toLowerCase();
            const list = topicsForPart(browsePart).filter(
              (tp) => !q || tp.title.toLowerCase().includes(q)
            );
            if (!list.length) {
              return <p className="sq-empty">{t('sq.noResults')}</p>;
            }
            return list.map((tp) => {
              const active = browsePart === speakingPart && tp.id === speakingTopicId;
              return (
                <button
                  key={tp.id}
                  className={`sq-topic-row${active ? ' sq-topic-row--on' : ''}`}
                  onClick={() => openTopic(tp.id)}
                >
                  <span className="sq-topic-row__title">{tp.title}</span>
                  <span className="sq-topic-row__count">
                    {browsePart === 2
                      ? t('sq.cueCardLabel')
                      : t('sq.questionCount', { n: tp.questions?.length ?? 0 })}
                  </span>
                </button>
              );
            });
          })()}
        </div>
        <style>{css}</style>
      </div>
    );
  }

  const questions = speakingPart === 2 ? [] : topic.questions || [];

  return (
    <div className="sq" style={{ '--acc': PART_ACCENT[speakingPart] } as React.CSSProperties}>
      <div className="sq-nav">
        <button className="sq-back" onClick={backToTopics}>
          ‹ {t('sq.topics')}
        </button>
        <span className="sq-nav__title">
          {t('sq.part', { n: speakingPart })} · {topic.title}
        </span>
      </div>

      {speakingPart === 2 ? (
        <div className="sq-cue">
          <div className="sq-cue__head">
            <p className="sq-cue__prompt">"{topic.cue}"</p>
            <button
              className={`sq-star${isSaved(2, topic.id, 0) ? ' sq-star--on' : ''}`}
              onClick={() =>
                toggleSave({
                  id: `2:${topic.id}:0`,
                  part: 2,
                  topicId: topic.id,
                  index: 0,
                  text: topic.cue || '',
                  question: topic.cue || '',
                  topicTitle: topic.title,
                  savedAt: new Date().toISOString(),
                })
              }
              aria-label="Save"
            >
              <Star size={17} fill={isSaved(2, topic.id, 0) ? 'currentColor' : 'none'} strokeWidth={1.75} />
            </button>
          </div>
          <div className="sq-bullets">
            <span className="sq-bullets__label">{t('sq.youShouldSay')}</span>
            <ul>
              {topic.bullets?.map((b: string, i: number) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
          <div className="sq-timer">
            <div
              className={`sq-timer__left${timerRunning ? ' running' : ''}${
                prepTimeLeft === 0 ? ' done' : ''
              }`}
            >
              <span className="sq-timer__label">{t('sq.prepTime')}</span>
              <span className="sq-timer__time">{fmtTime(prepTimeLeft)}</span>
            </div>
            <div className="sq-timer__btns">
              {!timerRunning ? (
                <button className="sq-tbtn sq-tbtn--start" onClick={startTimer}>
                  {prepTimeLeft === 60 ? t('sq.start') : t('sq.resume')}
                </button>
              ) : (
                <button className="sq-tbtn sq-tbtn--pause" onClick={stopTimer}>
                  {t('sq.pause')}
                </button>
              )}
              <button className="sq-tbtn sq-tbtn--reset" onClick={resetTimer} aria-label="Reset">
                ↺
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="sq-qlist">
          {questions.map((q: string, i: number) => {
            const active = i === speakingQuestionIndex;
            const saved = isSaved(speakingPart, topic.id, i);
            return (
              <div key={i} className={`sq-qrow${active ? ' sq-qrow--on' : ''}`}>
                <button className="sq-qrow__pick" onClick={() => pickQuestion(i)}>
                  <span className="sq-qrow__num">{i + 1}</span>
                  <span className="sq-qrow__text">{q}</span>
                </button>
                <button
                  className={`sq-star${saved ? ' sq-star--on' : ''}`}
                  onClick={() =>
                    toggleSave({
                      id: `${speakingPart}:${topic.id}:${i}`,
                      part: speakingPart,
                      topicId: topic.id,
                      index: i,
                      text: q,
                      question: q,
                      topicTitle: topic.title,
                      savedAt: new Date().toISOString(),
                    })
                  }
                  aria-label="Save"
                >
                  <Star size={17} fill={saved ? 'currentColor' : 'none'} strokeWidth={1.75} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <style>{css}</style>
    </div>
  );
}

const css = `
  .sq {
    --acc: 122 162 255;
    width: 100%;
    padding: 0 var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .sq--parts {
    flex: 1;
    justify-content: center;
  }

  .sq-banner {
    width: 100%;
    display: flex; align-items: center; justify-content: center; gap: var(--space-1-5);
    padding: var(--space-3) var(--space-4); border-radius: 13px;
    background: rgba(59,130,246,0.18);
    border: 1px solid rgba(122,184,255,0.4);
    color: #cfe3ff;
    font-size: var(--text-sm); font-weight: var(--weight-bold);
    animation: sqBannerIn 0.2s ease both;
    transition: transform 0.1s, background 0.12s;
  }
  .sq-banner:active { transform: scale(0.98); background: rgba(59,130,246,0.28); }
  @keyframes sqBannerIn {
    from { opacity: 0; transform: translateY(-6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .sq-nav {
    display: flex; align-items: center; gap: var(--space-3);
    min-height: 38px;
  }
  .sq-back {
    flex-shrink: 0;
    padding: var(--space-2) var(--space-3); border-radius: 11px;
    background: rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.85);
    font-size: var(--text-base); font-weight: var(--weight-bold);
    transition: background 0.12s, transform 0.1s;
  }
  .sq-back:active { transform: scale(0.95); background: rgba(255,255,255,0.14); }
  .sq-nav__title {
    flex: 1; min-width: 0;
    font-size: var(--text-sm); font-weight: var(--weight-bold);
    color: rgba(255,255,255,0.6);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    text-align: right;
  }

  .sq-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }
  .sq-tile {
    --acc: 122 162 255;
    position: relative;
    aspect-ratio: 1.5 / 1;
    display: flex; flex-direction: column; justify-content: center; align-items: center;
    gap: var(--space-0-5); padding: var(--space-3);
    background:
      radial-gradient(120% 100% at 50% 0%, rgb(var(--acc) / 0.22) 0%, transparent 70%),
      rgba(255,255,255,0.05);
    border: 1px solid rgb(var(--acc) / 0.30);
    border-radius: 18px;
    text-align: center;
    overflow: hidden;
    box-shadow: 0 6px 18px rgb(var(--acc) / 0.12), inset 0 1px 0 rgba(255,255,255,0.08);
    transition: transform 0.1s, box-shadow 0.15s, border-color 0.15s;
  }
  .sq-tile:active { transform: scale(0.96); box-shadow: 0 3px 10px rgb(var(--acc) / 0.16); }
  .sq-tile__num {
    position: absolute; top: 9px; right: 12px;
    font-size: 30px; font-weight: 900; line-height: 1;
    color: rgb(var(--acc) / 0.45);
    text-shadow: 0 1px 8px rgb(var(--acc) / 0.3);
  }
  .sq-tile__emoji { font-size: var(--text-lg); line-height: 1; margin-bottom: var(--space-0-5); }
  .sq-tile__title { font-size: var(--text-md); font-weight: var(--weight-heavy); color: #fff; letter-spacing: -0.2px; }
  .sq-tile__desc { font-size: var(--text-xs); color: rgba(255,255,255,0.55); line-height: 1.25; }

  .sq-search {
    width: 100%;
    padding: var(--space-3) var(--space-4);
    border-radius: 13px;
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.1);
    color: #fff;
    font-size: var(--text-base);
    outline: none;
    transition: border-color 0.12s, background 0.12s;
  }
  .sq-search::placeholder { color: rgba(255,255,255,0.4); }
  .sq-search:focus {
    border-color: rgb(var(--acc) / 0.6);
    background: rgb(var(--acc) / 0.08);
    box-shadow: 0 0 0 3px rgb(var(--acc) / 0.12);
  }

  .sq-empty {
    text-align: center;
    font-size: var(--text-base); font-weight: var(--weight-semi);
    color: rgba(255,255,255,0.4);
    padding: var(--space-5) 0;
  }

  .sq-topics {
    display: flex; flex-direction: column; gap: var(--space-1-5);
  }
  .sq-topic-row {
    display: flex; align-items: center; justify-content: space-between; gap: var(--space-3);
    width: 100%; padding: var(--space-3) var(--space-4);
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 13px;
    text-align: left;
    transition: background 0.12s, transform 0.1s, border-color 0.12s;
  }
  .sq-topic-row:active { transform: scale(0.98); background: rgba(255,255,255,0.1); }
  .sq-topic-row--on {
    border-color: rgb(var(--acc) / 0.55);
    background: linear-gradient(90deg, rgb(var(--acc) / 0.18), rgb(var(--acc) / 0.06));
  }
  .sq-topic-row__title { font-size: var(--text-base); font-weight: var(--weight-bold); color: #fff; }
  .sq-topic-row__count {
    flex-shrink: 0; font-size: var(--text-xs); font-weight: var(--weight-bold);
    padding: var(--space-0-5) var(--space-2); border-radius: 99px;
    color: rgb(var(--acc) / 0.95);
    background: rgb(var(--acc) / 0.14);
  }

  .sq-qlist {
    display: flex; flex-direction: column; gap: var(--space-2);
  }
  .sq-qrow {
    display: flex; align-items: stretch; gap: var(--space-1);
    width: 100%;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 14px;
    overflow: hidden;
    transition: background 0.12s, border-color 0.12s;
  }
  .sq-qrow--on {
    border-color: rgb(var(--acc) / 0.6);
    background: linear-gradient(90deg, rgb(var(--acc) / 0.2), rgb(var(--acc) / 0.06));
  }
  .sq-qrow__pick {
    flex: 1; min-width: 0;
    display: flex; align-items: flex-start; gap: var(--space-3);
    padding: var(--space-3) var(--space-1) var(--space-3) var(--space-4);
    text-align: left;
    transition: transform 0.1s;
  }
  .sq-qrow__pick:active { transform: scale(0.98); }
  .sq-qrow__num {
    flex-shrink: 0;
    width: 24px; height: 24px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.6);
    font-size: var(--text-sm); font-weight: var(--weight-heavy);
  }
  .sq-qrow--on .sq-qrow__num {
    background: rgb(var(--acc));
    color: #fff;
    box-shadow: 0 2px 8px rgb(var(--acc) / 0.5);
  }
  .sq-qrow__text {
    font-size: var(--text-base); font-weight: var(--weight-semi); line-height: 1.45;
    color: rgba(255,255,255,0.92);
  }
  .sq-qrow__tag {
    display: block; font-size: var(--text-xs); font-weight: var(--weight-bold);
    color: rgb(var(--acc) / 0.9); margin-bottom: var(--space-1);
    text-transform: uppercase; letter-spacing: 0.4px;
  }

  .sq-star {
    flex-shrink: 0;
    width: 44px;
    display: flex; align-items: center; justify-content: center;
    font-size: var(--text-lg); color: rgba(255,255,255,0.35);
    transition: transform 0.1s, color 0.12s;
  }
  .sq-star:active { transform: scale(0.8); }
  .sq-star--on { color: #ffc107; }

  .sq-cue { display: flex; flex-direction: column; gap: var(--space-3); }
  .sq-cue__head {
    display: flex; align-items: flex-start; gap: var(--space-1-5);
    background:
      radial-gradient(120% 140% at 50% 0%, rgb(var(--acc) / 0.16) 0%, transparent 70%),
      rgba(255,255,255,0.04);
    border: 1px solid rgb(var(--acc) / 0.25);
    border-radius: 16px;
    padding: var(--space-4) var(--space-4);
  }
  .sq-cue__prompt {
    flex: 1; min-width: 0;
    font-size: var(--text-md); font-weight: var(--weight-bold);
    line-height: 1.5; color: #fff;
    text-align: center;
    text-shadow: 0 1px 6px rgba(0,0,0,0.5);
  }
  .sq-cue__head .sq-star { align-self: flex-start; padding-top: var(--space-0-5); }
  .sq-bullets {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px;
    padding: var(--space-3) var(--space-4);
  }
  .sq-bullets__label {
    display: block;
    font-size: var(--text-xs); font-weight: var(--weight-bold);
    color: rgb(var(--acc) / 0.9);
    text-transform: uppercase; letter-spacing: 1px;
    margin-bottom: var(--space-2);
  }
  .sq-bullets ul {
    list-style: none; padding: 0; margin: 0;
    display: flex; flex-direction: column; gap: var(--space-1-5);
  }
  .sq-bullets li {
    font-size: var(--text-base); font-weight: var(--weight-medium);
    color: rgba(255,255,255,0.88);
    padding-left: var(--space-4); position: relative;
    line-height: 1.4;
  }
  .sq-bullets li::before {
    content: "•"; position: absolute; left: 3px;
    color: rgb(var(--acc)); font-size: var(--text-md); line-height: 1.3;
  }

  .sq-timer {
    display: flex; align-items: center; justify-content: space-between;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px;
    padding: var(--space-3) var(--space-4); gap: var(--space-3);
  }
  .sq-timer__left { display: flex; flex-direction: column; gap: var(--space-0-5); }
  .sq-timer__label {
    font-size: var(--text-xs); font-weight: var(--weight-bold);
    color: rgba(255,255,255,0.3);
    text-transform: uppercase; letter-spacing: 1px;
  }
  .sq-timer__time {
    font-size: var(--text-xl); font-weight: var(--weight-heavy); color: #fff;
    font-variant-numeric: tabular-nums; line-height: 1;
  }
  .sq-timer__left.running .sq-timer__time {
    color: var(--warning);
    animation: tPulse 1.5s ease-in-out infinite;
  }
  .sq-timer__left.done .sq-timer__time { color: var(--success); }
  .sq-timer__btns { display: flex; gap: var(--space-1-5); align-items: center; }
  .sq-tbtn {
    border-radius: 11px; font-size: var(--text-base); font-weight: var(--weight-bold);
    min-height: 42px; padding: 0 var(--space-4);
    display: flex; align-items: center; justify-content: center; gap: var(--space-1);
    transition: transform 0.1s, background 0.12s;
  }
  .sq-tbtn:active { transform: scale(0.93); }
  .sq-tbtn--start {
    background: rgb(var(--acc)); color: #fff; min-width: 96px;
    box-shadow: 0 3px 12px rgb(var(--acc) / 0.4);
  }
  .sq-tbtn--pause {
    background: rgba(255,149,0,0.16); color: var(--warning);
    border: 1px solid rgba(255,149,0,0.25); min-width: 96px;
  }
  .sq-tbtn--reset {
    background: rgba(255,255,255,0.09); color: rgba(255,255,255,0.65);
    min-width: 42px; padding: 0; font-size: 19px;
  }

  @keyframes tPulse {
    0%, 100% { opacity: 1; } 50% { opacity: 0.55; }
  }

  @media (max-width: 375px) {
    .sq { gap: var(--space-2); padding: 0 var(--space-3); }
    .sq-tile__emoji { font-size: var(--text-lg); }
    .sq-tile__title { font-size: var(--text-base); }
    .sq-qrow__text { font-size: var(--text-base); }
    .sq-cue__prompt { font-size: var(--text-md); }
    .sq-timer__time { font-size: var(--text-lg); }
    .sq-tbtn { font-size: var(--text-sm); min-height: 38px; }
    .sq-tbtn--start, .sq-tbtn--pause { min-width: 82px; }
  }
`;
