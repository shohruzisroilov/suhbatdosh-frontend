import React, { useState } from 'react';
import { Sparkles, RefreshCw, MessageCircle, Home, Film, Plane, Coffee, Utensils, Music, Gamepad2, Briefcase } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { useSocket } from '../hooks/useSocket';
import { useT } from '../i18n';
import { tapHaptic, selectionHaptic } from '../utils/haptics';

interface IcebreakerItem {
  id: string;
  topicId: string;
  part: number;
  qIndex: number;
  title: string;
  prompt: string;
  detail: string;
  icon: React.ReactNode;
}

const ICEBREAKER_BANK: IcebreakerItem[] = [
  {
    id: 'hometown',
    topicId: 'hometown',
    part: 1,
    qIndex: 0,
    title: 'Hometown',
    prompt: 'Ask about their hometown',
    detail: 'Where are you from and what is your hometown like?',
    icon: <Home size={16} className="text-amber-400" />,
  },
  {
    id: 'movies',
    topicId: 'movies',
    part: 1,
    qIndex: 0,
    title: 'Favorite Movie',
    prompt: 'What is your favorite movie?',
    detail: 'What is your favorite movie or TV show of all time and why?',
    icon: <Film size={16} className="text-indigo-400" />,
  },
  {
    id: 'travel',
    topicId: 'travel',
    part: 1,
    qIndex: 0,
    title: 'Travel Dreams',
    prompt: 'Where would you travel next?',
    detail: 'If you could travel anywhere tomorrow, where would you go?',
    icon: <Plane size={16} className="text-sky-400" />,
  },
  {
    id: 'daily_routine',
    topicId: 'daily_routine',
    part: 1,
    qIndex: 0,
    title: 'Daily Routine',
    prompt: 'Talk about your day',
    detail: 'What did you do today? Are you a morning person or night owl?',
    icon: <Coffee size={16} className="text-amber-600" />,
  },
  {
    id: 'food',
    topicId: 'food',
    part: 1,
    qIndex: 0,
    title: 'Favorite Food',
    prompt: 'Ask about favorite food',
    detail: 'What is your favorite dish or food to eat when relaxing?',
    icon: <Utensils size={16} className="text-emerald-400" />,
  },
  {
    id: 'music',
    topicId: 'music',
    part: 1,
    qIndex: 0,
    title: 'Music Tastes',
    prompt: 'What music do you listen to?',
    detail: 'What kind of music or songs do you listen to most often?',
    icon: <Music size={16} className="text-pink-400" />,
  },
  {
    id: 'lifestyle',
    topicId: 'lifestyle',
    part: 1,
    qIndex: 0,
    title: 'Free Time Hobbies',
    prompt: 'What are your hobbies?',
    detail: 'What do you love doing in your free time outside work or study?',
    icon: <Gamepad2 size={16} className="text-purple-400" />,
  },
  {
    id: 'major',
    topicId: 'major',
    part: 1,
    qIndex: 0,
    title: 'Work & Studies',
    prompt: 'What do you study or do?',
    detail: 'What is your major or current job, and why did you choose it?',
    icon: <Briefcase size={16} className="text-blue-400" />,
  },
];

function getRandom1(currentCard: IcebreakerItem | null = null): IcebreakerItem {
  const currentId = currentCard?.id;
  const available = currentId
    ? ICEBREAKER_BANK.filter((item) => item.id !== currentId)
    : ICEBREAKER_BANK;
  const pool = available.length > 0 ? available : ICEBREAKER_BANK;
  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex];
}

export default function Icebreakers() {
  const { session, setSpeakingState, speakingTopicId } = useAppStore();
  const { changeSpeakingTopic } = useSocket();
  const t = useT();
  const [card, setCard] = useState<IcebreakerItem>(() => getRandom1());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectionHaptic();
    setCard((prev) => getRandom1(prev));
  };

  const handleSelectCard = (selectedCard: IcebreakerItem) => {
    tapHaptic('medium');
    setSelectedId(selectedCard.id);
    setSpeakingState(selectedCard.topicId, selectedCard.part, selectedCard.qIndex);
    if (session?.id) {
      changeSpeakingTopic(session.id, selectedCard.topicId, selectedCard.part, selectedCard.qIndex);
    }
  };

  const isSelected = card && (selectedId === card.id || speakingTopicId === card.topicId);

  return (
    <div className="icebreakers fade-in">
      <div className="icebreakers__head">
        <div className="icebreakers__title">
          <Sparkles size={16} className="icebreakers__sparkle" />
          <span>{t('ib.title')}</span>
        </div>
        <button
          className="icebreakers__refresh"
          onClick={handleRefresh}
          title={t('ib.newAria')}
          aria-label={t('ib.newAria')}
        >
          <RefreshCw size={13} />
          <span>{t('ib.new')}</span>
        </button>
      </div>

      <div className="icebreakers__cards">
        {card && (
          <button
            key={card.id}
            className={`icebreaker-card${isSelected ? ' icebreaker-card--active' : ''}`}
            onClick={() => handleSelectCard(card)}
          >
            <div className="icebreaker-card__content">
              <div className="icebreaker-card__header">
                <span className="icebreaker-card__emoji">{card.icon}</span>
                <span className="icebreaker-card__prompt">{card.prompt}</span>
              </div>
              <p className="icebreaker-card__detail">"{card.detail}"</p>
            </div>
            {isSelected && (
              <span className="icebreaker-card__badge">
                <MessageCircle size={12} /> {t('ib.picked')}
              </span>
            )}
          </button>
        )}
      </div>

      <Styles />
    </div>
  );
}

function Styles() {
  return (
    <style>{`
      .icebreakers {
        width: 100%;
        margin-bottom: var(--space-3);
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .icebreakers__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 var(--space-1);
      }
      .icebreakers__title {
        display: flex;
        align-items: center;
        gap: var(--space-1-5);
        font-size: var(--text-xs);
        font-weight: var(--weight-bold);
        color: rgba(255, 255, 255, 0.85);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .icebreakers__sparkle {
        color: #ffc107;
      }
      .icebreakers__refresh {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: var(--text-xs);
        font-weight: var(--weight-bold);
        color: rgba(255, 255, 255, 0.6);
        background: rgba(255, 255, 255, 0.08);
        padding: 4px 10px;
        border-radius: var(--radius-full);
        transition: background 0.12s, color 0.12s;
      }
      .icebreakers__refresh:active {
        background: rgba(255, 255, 255, 0.18);
        color: #fff;
      }
      .icebreakers__cards {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .icebreaker-card {
        position: relative;
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 14px;
        text-align: left;
        transition: transform 0.12s var(--ease-out), background 0.12s, border-color 0.12s, box-shadow 0.12s;
      }
      .icebreaker-card:active {
        transform: scale(0.98);
        background: rgba(255, 255, 255, 0.1);
      }
      .icebreaker-card--active {
        background: rgba(42, 171, 238, 0.18);
        border-color: rgba(42, 171, 238, 0.55);
        box-shadow: 0 4px 16px rgba(42, 171, 238, 0.22);
      }
      .icebreaker-card__content {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .icebreaker-card__header {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .icebreaker-card__emoji {
        font-size: 16px;
        line-height: 1;
      }
      .icebreaker-card__prompt {
        font-size: var(--text-sm);
        font-weight: var(--weight-bold);
        color: #fff;
      }
      .icebreaker-card__detail {
        font-size: var(--text-xs);
        color: rgba(255, 255, 255, 0.7);
        line-height: 1.35;
      }
      .icebreaker-card__badge {
        position: absolute;
        top: 8px;
        right: 10px;
        display: flex;
        align-items: center;
        gap: 3px;
        font-size: 10px;
        font-weight: var(--weight-bold);
        color: var(--btn-bg);
        background: rgba(42, 171, 238, 0.2);
        padding: 2px 7px;
        border-radius: 99px;
      }
    `}</style>
  );
}
