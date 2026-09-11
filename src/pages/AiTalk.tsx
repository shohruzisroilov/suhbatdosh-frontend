import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { createAiConversation, recordAiPartnerSession } from '../api/endpoints';
import { useVoiceConversation } from '../hooks/useVoiceConversation';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';
import { useT } from '../i18n';
import AiOrb from '../components/ai/AiOrb';
import CallControls from '../components/CallControls';
import ChatOverlay from '../components/ChatOverlay';
import EndSessionSheet from '../components/EndSessionSheet';
import VocabPrompt, { type VocabItem } from '../components/VocabPrompt';

function fmt(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Talking to the AI partner.
 *
 * Deliberately almost empty: a sphere, who you are talking to, and three buttons. A
 * spoken conversation is not something you read, so nothing that was said appears here
 * — putting the words on screen invites people to read instead of listen, which is the
 * one thing this screen exists to stop them doing. The transcript is a tap away behind
 * the chat button, for afterwards or for a word that did not come through.
 *
 * The shape is the app's call screen, because that is what this is. What is different
 * is the middle: there is no face to show, so the sphere stands in for one, and it is
 * the only thing that moves.
 */
export default function AiTalk() {
  const { user, navigate, updateUser } = useAppStore();
  const t = useT();

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [vocab, setVocab] = useState<VocabItem | null>(null);
  const [lastSeenCount, setLastSeenCount] = useState(0);
  const [startFailed, setStartFailed] = useState(false);

  const orbRef = useRef<HTMLDivElement | null>(null);
  const startedAtRef = useRef(Date.now());
  const wpmSamplesRef = useRef<number[]>([]);
  const recordedRef = useRef(false);
  const messagesRef = useRef<any[]>([]);
  messagesRef.current = messages;

  const firstName = user?.displayName?.split(' ')[0] || 'there';

  // ── The thread this session writes into ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    createAiConversation()
      .then(({ conversation }) => {
        if (!cancelled) setConversationId(conversation.id);
      })
      .catch(() => {
        if (!cancelled) setStartFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const addMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    if (!content.trim()) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `${role}-${Date.now()}-${prev.length}`,
        content,
        sentAt: new Date().toISOString(),
        sent_at: new Date().toISOString(),
        isOwn: role === 'user',
        is_own: role === 'user',
      },
    ]);
  }, []);

  const { status, muted, error, toggleMute, sendTyped } = useVoiceConversation({
    conversationId,
    userLevel: user?.level ? String(user.level) : undefined,
    greeting: t('ai.opening', { name: firstName }),
    onGreeting: (text) => addMessage('assistant', text),
    onTurn: (userText, aiText) => {
      addMessage('user', userText);
      addMessage('assistant', aiText);
    },
    onVocab: (item) => setVocab(item),
    onWpm: (wpm) => wpmSamplesRef.current.push(wpm),
    // Written to the element, not to state: this fires on every animation frame.
    onLevel: (level) => orbRef.current?.style.setProperty('--level', level.toFixed(2)),
  });

  // ── Time on this screen ──────────────────────────────────────────────────
  //
  // The free daily allowance is counted in minutes, so the clock still runs and is
  // still reported. Premium accounts are not capped, so nothing cuts them off.
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (!user?.isPremium) {
          const used = user?.dailyMinutes || 0;
          const limit = user?.dailyLimit || 0;
          const remaining = Math.max(0, (limit - used) * 60);
          if (limit > 0 && remaining > 0 && next >= remaining) {
            setTimeout(() => finish(true), 0);
          }
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.isPremium, user?.dailyMinutes, user?.dailyLimit]);

  const recordSession = useCallback(async () => {
    if (recordedRef.current) return;
    recordedRef.current = true;

    const durationSeconds = Math.round((Date.now() - startedAtRef.current) / 1000);
    if (durationSeconds < 20) return;

    try {
      const res = await recordAiPartnerSession({
        durationSeconds,
        history: messagesRef.current.map((m) => ({
          role: m.isOwn ? ('user' as const) : ('assistant' as const),
          content: m.content,
        })),
        wpmSamples: wpmSamplesRef.current,
      });
      if (res?.user) updateUser(res.user);
      else if (res?.addedMinutes) {
        updateUser({ dailyMinutes: (user?.dailyMinutes || 0) + res.addedMinutes });
      }
    } catch {
      /* the minutes are not worth blocking the exit over */
    }
  }, [updateUser, user?.dailyMinutes]);

  const finish = useCallback(
    async (limitReached = false) => {
      if (ending) return;
      setEnding(true);
      await recordSession();
      if (limitReached) {
        useAppStore.setState({ matchingStatus: 'limit_reached' });
        navigate('matching');
        return;
      }
      navigate('home');
    },
    [ending, recordSession, navigate]
  );

  useTelegramBackButton(() => setShowEnd(true));

  // Leaving any other way — a tab, a reload — still banks the time.
  useEffect(() => {
    return () => {
      void recordSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (showChat) setLastSeenCount(messages.length);
  }, [showChat, messages.length]);

  const unread = showChat ? 0 : Math.max(0, messages.length - lastSeenCount);

  const statusLabel = startFailed
    ? t('ai.voice.error')
    : error === 'mic'
    ? t('ai.voice.micDenied')
    : error === 'recorder'
    ? t('ai.voice.noRecorder')
    : error
    ? t('ai.voice.failed')
    : t(`ai.voice.${status}`);

  const isFailed = Boolean(error) || startFailed;

  return (
    <div className="talk">
      {/* ── Who you are talking to ── */}
      <header className="talk__head">
        <div className="talk__mark" aria-hidden="true" />

        <div className="talk__info">
          <span className="talk__name">{t('ai.partnerName')}</span>
          <div className="talk__meta">
            <span className="talk__tag">{t('lang.en')}</span>
            {user?.level && <span className="talk__tag talk__tag--dim">{t(`level.${user.level}`)}</span>}
            <span className={`talk__state${isFailed ? ' talk__state--bad' : ''}`}>{statusLabel}</span>
          </div>
        </div>

        <div className="talk__timer">
          <span
            className="talk__dot"
            style={{
              background: isFailed ? 'var(--danger)' : 'var(--success)',
              boxShadow: `0 0 8px ${isFailed ? 'var(--danger)' : 'var(--success)'}`,
            }}
          />
          <span className="talk__elapsed num">{fmt(elapsed)}</span>
        </div>
      </header>

      {/* ── The AI ── */}
      <div className="talk__stage">
        <AiOrb ref={orbRef} status={isFailed ? 'error' : status} />

        {isFailed && (
          <p className="talk__error">
            <AlertTriangle size={15} aria-hidden="true" />
            <span>{statusLabel}</span>
          </p>
        )}

        {/* The one thing allowed to interrupt the sphere: a word worth keeping,
            offered between turns rather than during one. */}
        {vocab && !isFailed && (
          <div className="talk__vocab">
            <VocabPrompt item={vocab} onDone={() => setVocab(null)} />
          </div>
        )}
      </div>

      <CallControls
        micOn={!muted}
        camOn={false}
        showCamera={false}
        speaking={status === 'listening' && !muted}
        onToggleMic={toggleMute}
        onToggleCam={() => {}}
        onEnd={() => setShowEnd(true)}
        onOpenChat={() => setShowChat(true)}
        unread={unread}
      />

      {showChat && (
        <ChatOverlay
          messages={messages}
          isPartnerTyping={status === 'thinking'}
          sessionId={conversationId || 'ai'}
          onClose={() => setShowChat(false)}
          sendMessage={(_id, text) => {
            addMessage('user', text);
            void sendTyped(text);
          }}
          sendTyping={() => {}}
        />
      )}

      {showEnd && (
        <EndSessionSheet
          onConfirm={() => void finish()}
          onCancel={() => setShowEnd(false)}
          isEnding={ending}
        />
      )}

      <style>{`
        /* The screen is a dark stage whatever Telegram's colour scheme says, so the
           tokens are pinned here rather than each rule being patched for light mode —
           the same thing the call screen does. */
        .talk {
          /* The whole palette, not a few of it.
             This screen stays dark in both colour schemes, and everything drawn
             inside it — the transcript overlay, the end sheet, the vocabulary card —
             reads its colours from these tokens. Pinning only some left the rest
             resolving to the light scheme in light mode, which put white text on a
             white bubble. color-scheme goes with them so the textarea in the overlay
             draws its caret and selection dark too. */
          color-scheme: dark;
          --bg:             #080C14;
          --bg-secondary:   #121824;
          --surface-2:      #1A2232;
          --surface-3:      #222C3E;
          --border:         rgba(255, 255, 255, 0.08);
          --border-strong:  rgba(255, 255, 255, 0.16);
          --text-primary:   #F8FAFC;
          --text-secondary: #94A3B8;
          --text-tertiary:  #64748B;
          /* Re-declaring the token does not re-resolve a colour already computed
             further up: <body> resolved var(--text-primary) against the light scheme
             long before this subtree existed, and everything in here that does not
             name its own colour inherits that near-black. Setting it once here makes
             the whole subtree read from the tokens above. */
          color: var(--text-primary);
          position: relative;
          display: flex; flex-direction: column;
          width: 100%; height: 100dvh;
          background: #080C14;
          overflow: hidden;
        }

        /* ── Header ── */
        .talk__head {
          position: relative; z-index: 10; flex-shrink: 0;
          display: flex; align-items: center; gap: var(--space-3);
          padding: calc(var(--space-3) + env(safe-area-inset-top, 0px)) var(--space-4) var(--space-3);
          border-bottom: 1px solid rgba(255,255,255,0.07);
          background: rgba(8, 12, 20, 0.6);
          backdrop-filter: blur(10px);
          animation: fadeIn 0.2s ease both;
        }
        /* A small sibling of the sphere, so the header and the stage are obviously
           the same thing at two sizes. */
        .talk__mark {
          width: 42px; height: 42px; flex-shrink: 0;
          border-radius: 50%;
          background:
            radial-gradient(circle at 34% 72%, #FFFFFF 0%, #E8F3FF 24%, transparent 60%),
            linear-gradient(150deg, #7FA8FF 0%, #4E7FE8 45%, #2E5BD0 100%);
          box-shadow: 0 4px 16px rgba(78, 127, 232, 0.4);
        }

        .talk__info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--space-1); }
        .talk__name {
          font-size: var(--text-md); font-weight: var(--weight-bold);
          color: #fff; line-height: 1.2;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .talk__meta { display: flex; align-items: center; gap: var(--space-1); flex-wrap: wrap; }
        .talk__tag {
          font-size: var(--text-xs); font-weight: var(--weight-bold);
          color: rgba(255,255,255,0.85);
          background: rgba(255,255,255,0.1);
          border-radius: 6px; padding: 2px 6px;
          letter-spacing: 0.3px; white-space: nowrap;
        }
        .talk__tag--dim {
          color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.05);
          font-weight: var(--weight-medium);
        }
        .talk__state {
          font-size: var(--text-xs); font-weight: var(--weight-semi);
          color: rgba(255,255,255,0.45);
          white-space: nowrap;
        }
        .talk__state--bad { color: var(--danger); }

        .talk__timer {
          display: flex; align-items: center; gap: var(--space-1-5);
          flex-shrink: 0;
        }
        .talk__dot { width: 7px; height: 7px; border-radius: 50%; }
        .talk__elapsed {
          font-size: var(--text-sm); font-weight: var(--weight-semi);
          color: rgba(255,255,255,0.75);
        }

        /* ── Stage ── */
        .talk__stage {
          flex: 1; min-height: 0;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: var(--space-5);
          padding: var(--space-5) var(--space-4) 150px;
        }
        .talk__error {
          display: inline-flex; align-items: center; gap: var(--space-2);
          padding: var(--space-2) var(--space-4);
          border-radius: var(--radius-full);
          background: rgba(255, 69, 58, 0.14); color: #FF8A80;
          font-size: var(--text-sm); text-align: center;
        }
        .talk__vocab { width: 100%; max-width: 340px; }
      `}</style>
    </div>
  );
}
