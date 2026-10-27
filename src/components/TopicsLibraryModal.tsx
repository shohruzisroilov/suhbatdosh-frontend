import React, { useState } from 'react';
import Modal from './Modal';
import { PART1, PART2, PART3, topicsForPart } from '../constants/speakingTopics';
import useAppStore from '../store/useAppStore';
import { useT } from '../i18n';
import { selectionHaptic, tapHaptic } from '../utils/haptics';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Flame,
  Lightbulb,
  MessageSquare,
  Search,
  Sparkles,
  Star,
  Timer,
  X,
} from 'lucide-react';

interface TopicsLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTopic?: (topicId: string, part: number) => void;
}

const PART_TABS = [
  { part: 1, label: 'Part 1', name: 'Daily & Intro', Icon: MessageSquare },
  { part: 2, label: 'Part 2', name: 'Cue Card (1 min)', Icon: Timer },
  { part: 3, label: 'Part 3', name: 'Discussion', Icon: Lightbulb },
];

export default function TopicsLibraryModal({
  isOpen,
  onClose,
  onSelectTopic,
}: TopicsLibraryModalProps) {
  const t = useT();
  const { setSpeakingState, savedQuestions, toggleSavedQuestion } = useAppStore();

  const [activePart, setActivePart] = useState(1);
  const [selectedTopic, setSelectedTopic] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [prepTimeLeft, setPrepTimeLeft] = useState(60);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = React.useRef<any>(null);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startTimer = () => {
    if (timerRunning) return;
    setTimerRunning(true);
    timerRef.current = setInterval(() => {
      setPrepTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const resetTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerRunning(false);
    setPrepTimeLeft(60);
  };

  if (!isOpen) return null;

  const topicsList = topicsForPart(activePart) || [];
  const filteredTopics = topicsList.filter((item: any) =>
    item.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handlePickTopic = (topic: any) => {
    selectionHaptic();
    setSelectedTopic(topic);
    resetTimer();
  };

  const handleUseTopic = (topic: any) => {
    tapHaptic('medium');
    setSpeakingState(topic.id, activePart, 0);
    onSelectTopic?.(topic.id, activePart);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      backdropClassName="topics-lib-backdrop"
      className="topics-lib-sheet"
      labelledBy="topics-lib-title"
    >
      <div className="topics-lib-container">
        {/* Top Handle & Header */}
        <div className="topics-lib-handle" aria-hidden="true" />
        <div className="topics-lib-head">
          {selectedTopic ? (
            <button
              type="button"
              className="topics-lib-back-btn"
              onClick={() => {
                tapHaptic('light');
                setSelectedTopic(null);
                resetTimer();
              }}
            >
              <ChevronLeft size={18} />
              <span>Back</span>
            </button>
          ) : (
            <div className="topics-lib-title-wrap">
              <span className="topics-lib-badge">
                <BookOpen size={13} />
                <span>Question Bank</span>
              </span>
              <h2 id="topics-lib-title" className="topics-lib-title">
                Speaking Topics
              </h2>
            </div>
          )}

          <button
            type="button"
            className="topics-lib-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* If viewing topic details */}
        {selectedTopic ? (
          <div className="topics-lib-detail-scroll">
            <div className="topics-lib-detail-card">
              <div className="topics-lib-detail-header">
                <span className="topics-lib-detail-part-badge">Part {activePart}</span>
                <h3 className="topics-lib-detail-title">{selectedTopic.title}</h3>
              </div>

              {/* Part 1 & 3 Questions List */}
              {selectedTopic.questions && (
                <div className="topics-lib-questions-list">
                  {selectedTopic.questions.map((q: string, idx: number) => (
                    <div key={idx} className="topics-lib-q-row">
                      <span className="topics-lib-q-num">{idx + 1}</span>
                      <p className="topics-lib-q-text">{q}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Part 2 Cue Card & Timer */}
              {selectedTopic.cue && (
                <div className="topics-lib-cue-box">
                  <p className="topics-lib-cue-text">{selectedTopic.cue}</p>
                  {selectedTopic.bullets && selectedTopic.bullets.length > 0 && (
                    <div className="topics-lib-bullets">
                      <span className="topics-lib-bullets-title">You should say:</span>
                      <ul>
                        {selectedTopic.bullets.map((b: string, i: number) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 1-Minute Preparation Countdown Timer */}
                  <div className="topics-lib-timer-bar">
                    <div className="topics-lib-timer-info">
                      <span className="topics-lib-timer-label">1-Min Prep Timer</span>
                      <span
                        className={`topics-lib-timer-sec ${
                          prepTimeLeft <= 10 && prepTimeLeft > 0 ? 'warning' : ''
                        }`}
                      >
                        {Math.floor(prepTimeLeft / 60)}:
                        {String(prepTimeLeft % 60).padStart(2, '0')}
                      </span>
                    </div>

                    <div className="topics-lib-timer-actions">
                      <button
                        type="button"
                        className="topics-lib-timer-btn"
                        onClick={startTimer}
                        disabled={timerRunning || prepTimeLeft === 0}
                      >
                        {timerRunning ? 'Running…' : 'Start (60s)'}
                      </button>
                      <button
                        type="button"
                        className="topics-lib-timer-reset"
                        onClick={resetTimer}
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                className="topics-lib-use-btn"
                onClick={() => handleUseTopic(selectedTopic)}
              >
                <Sparkles size={16} />
                <span>Use for My Next Call</span>
              </button>
            </div>
          </div>
        ) : (
          /* Normal Topic Browser */
          <>
            {/* Parts Segmented Control */}
            <div className="topics-lib-parts">
              {PART_TABS.map((tab) => {
                const isActive = activePart === tab.part;
                const IconComponent = tab.Icon;
                return (
                  <button
                    key={tab.part}
                    type="button"
                    className={`topics-lib-part-btn ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      selectionHaptic();
                      setActivePart(tab.part);
                      setSelectedTopic(null);
                    }}
                  >
                    <IconComponent size={14} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="topics-lib-search-box">
              <Search size={15} className="topics-lib-search-icon" />
              <input
                type="text"
                placeholder="Search topics (e.g. Travel, Work, Books)…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="topics-lib-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="topics-lib-search-clear"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Topics List */}
            <div className="topics-lib-list-scroll">
              {filteredTopics.length > 0 ? (
                filteredTopics.map((topic: any) => (
                  <button
                    key={topic.id}
                    type="button"
                    className="topics-lib-topic-item"
                    onClick={() => handlePickTopic(topic)}
                  >
                    <div className="topics-lib-topic-info">
                      <span className="topics-lib-topic-title">{topic.title}</span>
                      <span className="topics-lib-topic-sub">
                        {activePart === 2
                          ? '1 Cue Card · 1 Min Prep'
                          : `${topic.questions?.length || 4} Questions`}
                      </span>
                    </div>
                    <ChevronRight size={16} className="topics-lib-topic-arrow" />
                  </button>
                ))
              ) : (
                <div className="topics-lib-empty">No topics matching "{searchQuery}"</div>
              )}
            </div>
          </>
        )}
      </div>

      <style>{`
        .topics-lib-backdrop {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(8px);
          display: flex; align-items: flex-end; justify-content: center;
        }
        .topics-lib-sheet {
          width: 100%; max-width: 520px; max-height: 86vh;
          background: var(--bg-secondary);
          border-radius: var(--radius-xl, 24px) var(--radius-xl, 24px) 0 0;
          border: 1px solid var(--border-strong); border-bottom: none;
          display: flex; flex-direction: column; overflow: hidden;
          box-shadow: 0 -16px 48px rgba(0, 0, 0, 0.4);
          animation: slideUp 0.28s var(--ease-spring) both;
        }
        .topics-lib-container {
          display: flex; flex-direction: column; height: 100%; max-height: 86vh;
          padding: 8px 16px calc(16px + env(safe-area-inset-bottom, 0px));
        }
        .topics-lib-handle {
          width: 40px; height: 4px; border-radius: 2px;
          background: var(--border-strong); margin: 6px auto 10px;
        }
        .topics-lib-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 4px 0 12px; border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .topics-lib-title-wrap {
          display: flex; flex-direction: column; gap: 2px;
        }
        .topics-lib-badge {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 11px; font-weight: var(--weight-bold);
          color: var(--primary); text-transform: uppercase; letter-spacing: 0.05em;
        }
        .topics-lib-title {
          font-size: 18px; font-weight: var(--weight-heavy);
          color: var(--text-primary); letter-spacing: -0.3px;
        }
        .topics-lib-back-btn {
          display: flex; align-items: center; gap: 4px;
          background: var(--surface-2); border: 1px solid var(--border);
          padding: 6px 12px; border-radius: var(--radius-full);
          font-size: 13px; font-weight: var(--weight-bold); color: var(--text-primary);
          cursor: pointer;
        }
        .topics-lib-close-btn {
          width: 32px; height: 32px; border-radius: 50%;
          background: var(--surface-2); border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          color: var(--text-secondary); cursor: pointer;
        }

        /* Parts tabs */
        .topics-lib-parts {
          display: flex; gap: 8px; margin: 12px 0 8px; flex-shrink: 0;
        }
        .topics-lib-part-btn {
          flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
          padding: 10px 4px; border-radius: var(--radius-md);
          background: var(--surface-2); border: 1px solid var(--border);
          color: var(--text-secondary); font-size: 13px; font-weight: var(--weight-bold);
          cursor: pointer; transition: all 0.15s ease;
        }
        .topics-lib-part-btn.active {
          background: var(--primary-subtle); border-color: var(--primary);
          color: var(--primary);
        }

        /* Search */
        .topics-lib-search-box {
          position: relative; margin-bottom: 12px; flex-shrink: 0;
        }
        .topics-lib-search-icon {
          position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
          color: var(--text-tertiary);
        }
        .topics-lib-search-input {
          width: 100%; padding: 10px 34px 10px 34px;
          background: var(--surface-2); border: 1px solid var(--border);
          border-radius: var(--radius-md); font-size: 13px;
          color: var(--text-primary); outline: none;
        }
        .topics-lib-search-input:focus { border-color: var(--primary); }
        .topics-lib-search-clear {
          position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
          color: var(--text-tertiary);
        }

        /* Topics list */
        .topics-lib-list-scroll {
          flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;
          padding-bottom: 16px;
        }
        .topics-lib-topic-item {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 14px; border-radius: var(--radius-md);
          background: var(--surface); border: 1px solid var(--border);
          cursor: pointer; text-align: left; transition: all 0.15s ease;
        }
        .topics-lib-topic-item:active {
          background: var(--surface-2); transform: scale(0.99);
        }
        .topics-lib-topic-info { display: flex; flex-direction: column; gap: 2px; }
        .topics-lib-topic-title {
          font-size: 14px; font-weight: var(--weight-bold); color: var(--text-primary);
        }
        .topics-lib-topic-sub {
          font-size: 11px; color: var(--text-secondary);
        }
        .topics-lib-topic-arrow { color: var(--text-tertiary); }

        /* Detail card */
        .topics-lib-detail-scroll {
          flex: 1; overflow-y: auto; padding: 12px 0 16px;
        }
        .topics-lib-detail-card {
          display: flex; flex-direction: column; gap: 14px;
        }
        .topics-lib-detail-header {
          display: flex; flex-direction: column; gap: 4px;
        }
        .topics-lib-detail-part-badge {
          font-size: 10px; font-weight: var(--weight-heavy);
          color: var(--primary); text-transform: uppercase; letter-spacing: 0.08em;
        }
        .topics-lib-detail-title {
          font-size: 20px; font-weight: var(--weight-heavy); color: var(--text-primary);
        }

        .topics-lib-questions-list {
          display: flex; flex-direction: column; gap: 8px;
        }
        .topics-lib-q-row {
          display: flex; gap: 10px; padding: 12px;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-md);
        }
        .topics-lib-q-num {
          width: 22px; height: 22px; border-radius: 50%;
          background: var(--primary-subtle); color: var(--primary);
          font-size: 11px; font-weight: var(--weight-bold);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .topics-lib-q-text {
          font-size: 13.5px; line-height: 1.45; color: var(--text-primary);
          font-weight: var(--weight-medium);
        }

        /* Cue card */
        .topics-lib-cue-box {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: 16px;
          display: flex; flex-direction: column; gap: 12px;
        }
        .topics-lib-cue-text {
          font-size: 15px; font-weight: var(--weight-bold); color: var(--text-primary);
          line-height: 1.45;
        }
        .topics-lib-bullets-title {
          font-size: 11px; font-weight: var(--weight-bold); text-transform: uppercase;
          color: var(--primary); letter-spacing: 0.05em; display: block; margin-bottom: 6px;
        }
        .topics-lib-bullets ul {
          margin: 0; padding-left: 18px; color: var(--text-secondary);
          font-size: 13px; line-height: 1.5;
        }

        /* Timer bar */
        .topics-lib-timer-bar {
          display: flex; align-items: center; justify-content: space-between;
          background: var(--surface-2); border: 1px solid var(--border);
          border-radius: var(--radius-md); padding: 10px 14px;
        }
        .topics-lib-timer-info { display: flex; flex-direction: column; gap: 2px; }
        .topics-lib-timer-label {
          font-size: 10px; font-weight: var(--weight-bold); text-transform: uppercase;
          color: var(--text-secondary);
        }
        .topics-lib-timer-sec {
          font-size: 20px; font-weight: var(--weight-heavy); font-mono: monospace;
          color: var(--text-primary);
        }
        .topics-lib-timer-sec.warning { color: var(--danger); animation: pulse 1s infinite; }
        .topics-lib-timer-actions { display: flex; gap: 6px; }
        .topics-lib-timer-btn {
          background: var(--primary); color: var(--primary-contrast);
          padding: 8px 12px; border-radius: var(--radius-md); font-size: 12px;
          font-weight: var(--weight-bold); cursor: pointer; border: none;
        }
        .topics-lib-timer-reset {
          background: var(--surface-3); color: var(--text-secondary);
          padding: 8px 10px; border-radius: var(--radius-md); font-size: 12px;
          font-weight: var(--weight-bold); cursor: pointer; border: none;
        }

        .topics-lib-use-btn {
          width: 100%; padding: 14px; border-radius: var(--radius-md);
          background: var(--grad-primary); color: var(--primary-contrast);
          font-size: 14px; font-weight: var(--weight-bold); cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          border: none; box-shadow: var(--primary-shadow);
        }
        .topics-lib-use-btn:active { transform: scale(0.98); }
        .topics-lib-empty {
          text-align: center; color: var(--text-secondary); font-size: 13px;
          padding: 30px 0;
        }
      `}</style>
    </Modal>
  );
}
