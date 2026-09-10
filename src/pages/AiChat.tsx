import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUp,
  Bot,
  Check,
  ChevronRight,
  Copy,
  History as HistoryIcon,
  MessagesSquare,
  MessageSquarePlus,
  Mic,
  RotateCcw,
  Square,
  Star,
  Volume2,
} from 'lucide-react';
import useAppStore from '../store/useAppStore';
import {
  listAiConversations,
  createAiConversation,
  getAiConversation,
  deleteAiConversation,
  getTTSAudio,
  recordAiPartnerSession,
  type AiConversationSummary,
} from '../api/endpoints';
import { streamAiTurn, AiStreamError } from '../api/aiStream';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';
import LoadingScreen from '../components/LoadingScreen';
import { useT } from '../i18n';
import { PART1 } from '../constants/speakingTopics';
import { notifyHaptic, tapHaptic } from '../utils/haptics';
import VocabPrompt, { type VocabItem } from '../components/VocabPrompt';
import MarkdownLite from '../components/ai/MarkdownLite';
import AiHistoryDrawer from '../components/ai/AiHistoryDrawer';
import AiVoiceMode from '../components/ai/AiVoiceMode';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isVoice?: boolean;
  /** Still arriving. Draws the caret and hides the per-message actions. */
  streaming?: boolean;
}

/**
 * The AI speaking partner, as a chat.
 *
 * It used to be a phone call: a full-screen call UI with a timer, where the only way
 * to see what had been said was an overlay stacked on top, and where closing the app
 * threw the conversation away. That shape came from the human-partner sessions it
 * was bolted onto, and it fit badly — talking to software is not a call, and a learner
 * reading back what they said is most of the value.
 *
 * So this is the shape people already know from every assistant they use: a thread
 * that streams, that they can scroll back through, and that is still there tomorrow.
 * Speaking has not been demoted — the microphone opens a full-screen voice mode, and
 * both halves of a spoken turn land in this same thread.
 */
export default function AiChat() {
  const { user, navigate, updateUser } = useAppStore();
  const t = useT();

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversations, setConversations] = useState<AiConversationSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Tapping the AI partner means "talk to it", so that is what opens: the spoken
  // conversation, not a text box. Closing it drops back to the transcript of what
  // was just said, which is also where typing lives for anyone who wants it.
  const [voiceOpen, setVoiceOpen] = useState(true);
  const [vocab, setVocab] = useState<VocabItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stickToBottomRef = useRef(true);
  const startedAtRef = useRef(Date.now());
  const wpmSamplesRef = useRef<number[]>([]);
  const recordedRef = useRef(false);

  const userLevel = user?.level ? String(user.level) : undefined;

  // ── Scrolling ────────────────────────────────────────────────────────────
  //
  // Follows the reply while it streams, but only while the reader is at the bottom.
  // Scrolling up to re-read something and being yanked back down every 40ms is the
  // single most irritating thing a streaming chat can do.
  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
  }, []);

  useEffect(() => {
    if (stickToBottomRef.current) scrollToBottom();
  }, [messages, scrollToBottom]);

  // ── Session bootstrap ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { conversations: list } = await listAiConversations();
        if (cancelled) return;
        setConversations(list || []);

        // Land in the most recent thread, the way reopening a messaging app does.
        // A brand new empty chat every time would bury the history the first session
        // just created.
        const latest = list?.[0];
        if (latest) {
          await openConversation(latest.id, { silent: true });
        } else {
          const { conversation } = await createAiConversation();
          if (cancelled) return;
          setConversationId(conversation.id);
          setTitle(conversation.title);
          setConversations([conversation]);
        }
      } catch {
        if (!cancelled) setError(t('ai.errLoad'));
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // recordSession runs on unmount, where a dependency on `messages` would either make
  // it re-run on every turn or capture the thread as it was on mount.
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  // ── Leaving: bank the practice time ──────────────────────────────────────
  //
  // The daily free allowance is counted in minutes, so time on this screen still has
  // to be reported when it ends. Written once, on the way out, and guarded so a
  // remount cannot double-count it.
  const recordSession = useCallback(async () => {
    if (recordedRef.current) return;
    recordedRef.current = true;

    const durationSeconds = Math.round((Date.now() - startedAtRef.current) / 1000);
    if (durationSeconds < 20) return;

    try {
      const res = await recordAiPartnerSession({
        durationSeconds,
        history: messagesRef.current.map((m) => ({ role: m.role, content: m.content })),
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

  const leave = useCallback(() => {
    abortRef.current?.abort();
    void recordSession();
    navigate('home');
  }, [navigate, recordSession]);

  useTelegramBackButton(leave);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      void recordSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Conversations ────────────────────────────────────────────────────────
  const refreshConversations = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const { conversations: list } = await listAiConversations();
      setConversations(list || []);
    } catch {
      /* the drawer keeps whatever it had */
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const openConversation = useCallback(
    async (id: string, opts: { silent?: boolean } = {}) => {
      abortRef.current?.abort();
      setStreaming(false);
      setError(null);
      setVocab(null);
      if (!opts.silent) setHistoryOpen(false);

      try {
        const { conversation } = await getAiConversation(id);
        setConversationId(conversation.id);
        setTitle(conversation.title);
        setMessages(
          (conversation.messages || []).map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            isVoice: m.isVoice,
          }))
        );
        stickToBottomRef.current = true;
        requestAnimationFrame(() => scrollToBottom());
      } catch {
        setError(t('ai.errOpen'));
      }
    },
    [scrollToBottom, t]
  );

  const startNewChat = useCallback(
    async (topic?: string | null) => {
      abortRef.current?.abort();
      setStreaming(false);
      setHistoryOpen(false);
      setError(null);
      setVocab(null);

      try {
        const { conversation } = await createAiConversation(topic || null);
        setConversationId(conversation.id);
        setTitle(conversation.title);
        setMessages([]);
        setConversations((prev) => [conversation, ...prev]);
        setTimeout(() => inputRef.current?.focus(), 120);
      } catch {
        setError(t('ai.errNew'));
      }
    },
    [t]
  );

  const removeConversation = useCallback(
    async (id: string) => {
      tapHaptic('medium');
      try {
        await deleteAiConversation(id);
      } catch {
        setError(t('ai.errDelete'));
        return;
      }

      const remaining = conversations.filter((c) => c.id !== id);
      setConversations(remaining);

      // Deleting the thread you are reading has to leave you somewhere: the next one
      // down, or a fresh chat when that was the last.
      if (id === conversationId) {
        if (remaining[0]) await openConversation(remaining[0].id, { silent: true });
        else await startNewChat();
      }
    },
    [conversations, conversationId, openConversation, startNewChat, t]
  );

  // ── Sending ──────────────────────────────────────────────────────────────
  const send = useCallback(
    async (text: string, opts: { regenerate?: boolean } = {}) => {
      const trimmed = text.trim();
      if (!trimmed || !conversationId || streaming) return;

      setError(null);
      setLimitReached(false);
      setVocab(null);
      setInput('');
      if (inputRef.current) inputRef.current.style.height = 'auto';

      const localAiId = `a-${Date.now()}`;
      const placeholder: ChatMessage = { id: localAiId, role: 'assistant', content: '', streaming: true };

      // Re-answering does not re-ask: the question is already in the thread, on screen
      // and in the database, so only the answer is replaced.
      setMessages((prev) =>
        opts.regenerate
          ? [...prev, placeholder]
          : [...prev, { id: `u-${Date.now()}`, role: 'user', content: trimmed }, placeholder]
      );
      stickToBottomRef.current = true;
      setStreaming(true);

      const abort = new AbortController();
      abortRef.current = abort;

      let reply = '';
      try {
        await streamAiTurn(
          {
            conversationId,
            text: trimmed,
            userLevel,
            regenerate: opts.regenerate === true,
            signal: abort.signal,
          },
          {
            onDelta: (delta) => {
              reply += delta;
              setMessages((prev) =>
                prev.map((m) => (m.id === localAiId ? { ...m, content: reply } : m))
              );
            },
            onVocab: (item) => setVocab(item),
            onTitle: (newTitle) => {
              setTitle(newTitle);
              setConversations((prev) =>
                prev.map((c) => (c.id === conversationId ? { ...c, title: newTitle } : c))
              );
            },
            onDone: ({ text: finalText }) => {
              reply = finalText || reply;
            },
          }
        );

        notifyHaptic('success');
      } catch (err: any) {
        // A reply the user stopped is not an error: what arrived stays on screen.
        if (abort.signal.aborted) {
          setMessages((prev) =>
            prev
              .map((m) => (m.id === localAiId ? { ...m, streaming: false } : m))
              .filter((m) => m.role !== 'assistant' || m.content.trim())
          );
          setStreaming(false);
          abortRef.current = null;
          return;
        }

        const streamErr = err instanceof AiStreamError ? err : null;
        setError(streamErr?.message || t('ai.errReply'));
        setLimitReached(Boolean(streamErr?.limitReached));
        notifyHaptic('error');

        // Drop the empty placeholder so the thread does not keep a blank bubble.
        setMessages((prev) => prev.filter((m) => m.id !== localAiId));
        setStreaming(false);
        abortRef.current = null;
        return;
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === localAiId ? { ...m, content: reply, streaming: false } : m))
      );
      setStreaming(false);
      abortRef.current = null;
    },
    [conversationId, streaming, userLevel, t]
  );

  const stop = useCallback(() => {
    tapHaptic('medium');
    abortRef.current?.abort();
  }, []);

  /** Re-asks the last question, replacing the answer rather than adding a second one. */
  const regenerate = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser || streaming) return;

    setMessages((prev) => {
      const lastAssistant = prev.map((m) => m.role).lastIndexOf('assistant');
      return lastAssistant === -1 ? prev : prev.filter((_, i) => i !== lastAssistant);
    });
    void send(lastUser.content, { regenerate: true });
  }, [messages, streaming, send]);

  const copy = useCallback(async (message: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(message.content);
      tapHaptic('light');
      setCopiedId(message.id);
      setTimeout(() => setCopiedId((id) => (id === message.id ? null : id)), 1600);
    } catch {
      /* clipboard is blocked in some webviews; nothing useful to say about it */
    }
  }, []);

  const playAloud = useCallback(async (text: string) => {
    tapHaptic('light');
    try {
      const res = await getTTSAudio(text);
      if (res?.ok && res?.audioUrl) {
        await new Audio(res.audioUrl).play();
        return;
      }
    } catch {
      /* fall through to the browser voice */
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  // ── Voice mode ───────────────────────────────────────────────────────────
  const appendVoiceTurn = useCallback((userText: string, aiText: string) => {
    const now = Date.now();
    setMessages((prev) => [
      ...prev,
      { id: `vu-${now}`, role: 'user', content: userText, isVoice: true },
      { id: `va-${now + 1}`, role: 'assistant', content: aiText, isVoice: true },
    ]);
    stickToBottomRef.current = true;
  }, []);

  // Three openers, redrawn per conversation so the screen does not read as a fixed menu.
  const suggestions = useMemo(() => {
    const pool = PART1.map((topic: any) => topic.title).filter(Boolean);
    const picked: string[] = [];
    while (picked.length < 3 && pool.length) {
      picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    return picked;
  }, [conversationId]);

  const composerHasText = input.trim().length > 0;
  const isEmpty = messages.length === 0;

  if (booting) return <LoadingScreen />;

  return (
    <div className="aic">
      {/* ── Header — the app's screen header: title and subtitle on the left,
             actions on the right, over the blurred chrome bar. ── */}
      <header className="aic__head">
        <span className="aic__badge" aria-hidden="true">
          <Bot size={19} />
        </span>

        <div className="aic__identity">
          <h1 className="aic__title">{t('ai.partnerName')}</h1>
          <p className="aic__subtitle">{title || t('ai.newChat')}</p>
        </div>

        <button
          type="button"
          className="aic__act"
          onClick={() => {
            tapHaptic('light');
            setHistoryOpen(true);
            void refreshConversations();
          }}
          aria-label={t('ai.chats')}
        >
          <HistoryIcon size={18} />
        </button>

        <button
          type="button"
          className="aic__act aic__act--primary"
          onClick={() => {
            tapHaptic('light');
            void startNewChat();
          }}
          aria-label={t('ai.newChat')}
        >
          <MessageSquarePlus size={18} />
        </button>
      </header>

      {/* ── Thread ── */}
      <div ref={scrollRef} className="aic__scroll" onScroll={onScroll}>
        {isEmpty && (
          <div className="aic__welcome">
            {/* Same hero language as the Find-a-partner card on Home: this is the
                other half of the same offer, so it should look like it. */}
            <section className="aic__hero fade-up">
              <span className="aic__hero-orb aic__hero-orb--1" aria-hidden="true" />
              <span className="aic__hero-orb aic__hero-orb--2" aria-hidden="true" />

              <div className="aic__hero-inner">
                <span className="aic__hero-tag">
                  <span className="dot-live" />
                  {t('ai.heroTag')}
                </span>
                <h2 className="aic__hero-title">
                  {t('ai.greeting', { name: user?.displayName?.split(' ')[0] || 'there' })}
                </h2>
                <p className="aic__hero-sub">{t('ai.greetingSub')}</p>
              </div>
            </section>

            <p className="eyebrow aic__eyebrow">{t('ai.suggestLabel')}</p>

            <div className="aic__suggestions stagger">
              {suggestions.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  className="row"
                  onClick={() => {
                    tapHaptic('light');
                    void send(t('ai.topicOpener', { topic: topic.toLowerCase() }));
                  }}
                >
                  <span className="row__ico row__ico--primary">
                    <MessagesSquare size={18} aria-hidden="true" />
                  </span>
                  <span className="row__text">
                    <span className="row__title">{topic}</span>
                  </span>
                  <ChevronRight size={18} className="row__arrow" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) =>
          message.role === 'user' ? (
            <div key={message.id} className="aic__row aic__row--user">
              <div className="aic__bubble aic__bubble--own">
                {message.isVoice && <Mic size={12} className="aic__voice-tag" aria-hidden="true" />}
                <span>{message.content}</span>
              </div>
            </div>
          ) : (
            <div key={message.id} className="aic__row aic__row--ai">
              <span className="aic__avatar" aria-hidden="true">
                <Bot size={15} />
              </span>

              <div className="aic__answer">
                <div className="aic__bubble aic__bubble--ai">
                  {message.content ? (
                    <MarkdownLite text={message.content} />
                  ) : (
                    <span className="aic__dots" aria-label={t('ai.voice.thinking')}>
                      <i />
                      <i />
                      <i />
                    </span>
                  )}
                  {message.streaming && message.content && <span className="aic__caret" />}
                </div>

                {!message.streaming && message.content && (
                  <div className="aic__actions">
                    <button type="button" onClick={() => copy(message)} aria-label="Copy">
                      {copiedId === message.id ? <Check size={15} /> : <Copy size={15} />}
                    </button>
                    <button type="button" onClick={() => playAloud(message.content)} aria-label="Read aloud">
                      <Volume2 size={15} />
                    </button>
                    <button type="button" onClick={regenerate} aria-label="Regenerate">
                      <RotateCcw size={15} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {vocab && (
          <div className="aic__vocab">
            <VocabPrompt item={vocab} onDone={() => setVocab(null)} />
          </div>
        )}

        {error && (
          <div className="aic__error card fade-up">
            <span className="aic__error-ico">
              <AlertCircle size={17} />
            </span>
            <div className="aic__error-body">
              <span>{error}</span>
              {limitReached && (
                <button type="button" className="aic__error-cta" onClick={() => navigate('premium')}>
                  <Star size={13} />
                  <span>{t('ai.seePremium')}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Composer ── */}
      <div className="aic__composer">
        <div className="aic__field">
          <textarea
            ref={inputRef}
            className="aic__input"
            value={input}
            rows={1}
            maxLength={2000}
            placeholder={t('ai.placeholder')}
            onChange={(e) => {
              setInput(e.target.value);
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
          />
        </div>

        {streaming ? (
          <button type="button" className="aic__send aic__send--stop" onClick={stop} aria-label="Stop">
            <Square size={15} fill="currentColor" />
          </button>
        ) : composerHasText ? (
          <button
            type="button"
            className="aic__send aic__send--go"
            onClick={() => void send(input)}
            aria-label="Send"
          >
            <ArrowUp size={19} strokeWidth={2.5} />
          </button>
        ) : (
          <button
            type="button"
            className="aic__send"
            onClick={() => {
              tapHaptic('medium');
              setVoiceOpen(true);
            }}
            aria-label="Voice mode"
            disabled={!conversationId}
          >
            <Mic size={19} />
          </button>
        )}
      </div>

      {historyOpen && (
        <AiHistoryDrawer
          conversations={conversations}
          activeId={conversationId}
          loading={historyLoading}
          onOpen={(id) => void openConversation(id)}
          onNew={() => void startNewChat()}
          onDelete={(id) => void removeConversation(id)}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      {voiceOpen && conversationId && (
        <AiVoiceMode
          conversationId={conversationId}
          userLevel={userLevel}
          onClose={() => setVoiceOpen(false)}
          onOpenHistory={() => {
            setHistoryOpen(true);
            void refreshConversations();
          }}
          onTurn={appendVoiceTurn}
          onVocab={(item) => setVocab(item)}
          onTitle={(newTitle) => {
            setTitle(newTitle);
            setConversations((prev) =>
              prev.map((c) => (c.id === conversationId ? { ...c, title: newTitle } : c))
            );
          }}
          onWpm={(wpm) => wpmSamplesRef.current.push(wpm)}
        />
      )}

      <style>{`
        .aic {
          position: relative;
          display: flex; flex-direction: column;
          height: 100dvh; width: 100%;
          background: var(--bg);
          overflow: hidden;
        }

        /* ── Header ──────────────────────────────────────────────────────────
           Matches the screen headers elsewhere in the app: the name on the left
           with a quiet second line under it, actions on the right. */
        .aic__head {
          flex-shrink: 0;
          display: flex; align-items: center; gap: var(--space-2);
          padding: calc(var(--space-3) + env(safe-area-inset-top, 0px)) var(--space-4) var(--space-3);
          background: var(--chrome-bg);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border);
        }
        .aic__badge {
          width: 38px; height: 38px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          border-radius: var(--radius-sm);
          background: var(--btn-bg-soft); color: var(--btn-bg);
        }
        .aic__identity { flex: 1; min-width: 0; }
        .aic__title {
          font-size: 17px; font-weight: var(--weight-heavy);
          color: var(--text-primary); letter-spacing: -0.3px; margin: 0;
        }
        .aic__subtitle {
          font-size: 11px; color: var(--text-tertiary); margin: 0;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .aic__act {
          width: 38px; height: 38px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text-secondary);
          transition: transform 0.15s var(--ease-out), background var(--t), color var(--t);
        }
        .aic__act:active { transform: scale(0.94); background: var(--surface-3); color: var(--text-primary); }
        .aic__act--primary {
          border-color: transparent; color: #fff;
          background: linear-gradient(135deg, #00A8FF 0%, #0077FF 100%);
          box-shadow: 0 4px 14px rgba(0, 168, 255, 0.35);
        }

        /* ── Thread ── */
        .aic__scroll {
          flex: 1; min-height: 0; overflow-y: auto;
          padding: var(--space-4) var(--space-4) var(--space-5);
          display: flex; flex-direction: column; gap: var(--space-3);
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
        }

        /* ── Opening screen ── */
        .aic__welcome { display: flex; flex-direction: column; gap: var(--space-3); }
        .aic__eyebrow { padding: var(--space-2) var(--space-1) 0; }
        .aic__suggestions { display: flex; flex-direction: column; gap: var(--space-2); }
        .aic__suggestions .row__arrow { color: var(--text-tertiary); flex-shrink: 0; }

        .aic__hero {
          position: relative; isolation: isolate; overflow: hidden; flex-shrink: 0;
          background: linear-gradient(145deg, #0369A1 0%, #0EA5E9 45%, #38BDF8 100%);
          border: 1px solid rgba(255, 255, 255, 0.20);
          border-radius: var(--radius-lg);
          padding: 18px 16px;
          box-shadow: 0 8px 32px rgba(3, 105, 161, 0.45), 0 2px 8px rgba(0, 0, 0, 0.2);
        }
        /* Same drifting highlights as the hero on Home, at this card's scale. */
        .aic__hero-orb {
          position: absolute; z-index: -1; border-radius: 50%; pointer-events: none;
        }
        .aic__hero-orb--1 {
          width: 170px; height: 170px; top: -60px; right: -40px;
          background: radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%);
          animation: aicOrb1 6s ease-in-out infinite;
        }
        .aic__hero-orb--2 {
          width: 100px; height: 100px; bottom: -34px; left: 16px;
          background: radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%);
          animation: aicOrb2 8s ease-in-out infinite;
        }
        @keyframes aicOrb1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-10px,8px) scale(1.05); } }
        @keyframes aicOrb2 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(8px,-6px); } }
        .aic__hero-inner { display: flex; flex-direction: column; gap: 6px; }
        .aic__hero-tag {
          display: inline-flex; align-items: center; gap: 6px; align-self: flex-start;
          padding: 4px 10px; border-radius: var(--radius-full);
          background: rgba(255, 255, 255, 0.18);
          border: 1px solid rgba(255, 255, 255, 0.22);
          color: #fff; font-size: var(--text-2xs); font-weight: var(--weight-bold);
        }
        .aic__hero-title {
          font-family: var(--font-display);
          font-size: var(--text-lg); font-weight: var(--weight-heavy);
          color: #fff; letter-spacing: -0.4px; margin: 0;
        }
        .aic__hero-sub {
          font-size: var(--text-sm); line-height: 1.45; margin: 0;
          color: rgba(255, 255, 255, 0.88);
        }

        /* ── Messages ────────────────────────────────────────────────────────
           The bubble shapes the app already uses for a conversation with a person:
           the accent on your own side, a bordered surface on theirs, and the
           corner nearest the speaker squared off. */
        .aic__row { display: flex; gap: var(--space-2); }
        .aic__row--user { justify-content: flex-end; }
        .aic__row--ai { align-items: flex-start; }

        .aic__bubble {
          padding: var(--space-3) var(--space-4);
          font-size: var(--text-base); line-height: 1.5;
          word-break: break-word;
          animation: fadeUp 0.18s var(--ease-out) both;
        }
        .aic__bubble--own {
          display: inline-flex; align-items: baseline; gap: var(--space-1-5);
          max-width: 84%;
          border-radius: 18px 18px 5px 18px;
          background: var(--btn-bg); color: var(--btn-text);
          white-space: pre-wrap;
        }
        .aic__bubble--ai {
          border-radius: 18px 18px 18px 5px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          color: var(--text-primary);
        }
        .aic__voice-tag { color: rgba(255, 255, 255, 0.7); flex-shrink: 0; align-self: center; }

        .aic__avatar {
          width: 30px; height: 30px; flex-shrink: 0; margin-top: 2px;
          display: flex; align-items: center; justify-content: center;
          border-radius: var(--radius-sm);
          background: var(--btn-bg-soft); color: var(--btn-bg);
        }
        .aic__answer { flex: 1; min-width: 0; }

        .aic__caret {
          display: inline-block; width: 7px; height: 15px;
          margin-left: 2px; vertical-align: -2px;
          background: var(--btn-bg); border-radius: 1px;
          animation: caretBlink 1s steps(2, start) infinite;
        }
        @keyframes caretBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

        .aic__dots { display: inline-flex; gap: 5px; }
        .aic__dots i {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--text-tertiary);
          animation: aicDot 1.2s infinite;
        }
        .aic__dots i:nth-child(2) { animation-delay: 0.18s; }
        .aic__dots i:nth-child(3) { animation-delay: 0.36s; }
        @keyframes aicDot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30%           { transform: translateY(-5px); opacity: 1; }
        }

        .aic__actions { display: flex; gap: var(--space-1); margin: var(--space-1-5) 0 0 var(--space-1); }
        .aic__actions button {
          width: 32px; height: 32px; border-radius: var(--radius-sm);
          display: flex; align-items: center; justify-content: center;
          color: var(--text-tertiary); background: transparent;
          transition: background var(--t), color var(--t), transform var(--t);
        }
        .aic__actions button:active {
          background: var(--surface-2); color: var(--text-primary); transform: scale(0.94);
        }

        .aic__vocab { margin-top: calc(var(--space-1) * -1); }

        .aic__error {
          display: flex; align-items: flex-start; gap: var(--space-3);
          border-color: rgba(255, 69, 58, 0.35);
        }
        .aic__error-ico {
          width: 34px; height: 34px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          border-radius: var(--radius-sm);
          background: var(--danger-bg); color: var(--danger);
        }
        .aic__error-body {
          flex: 1; display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-3);
          font-size: var(--text-sm); line-height: 1.5; color: var(--text-secondary);
        }
        .aic__error-cta {
          display: inline-flex; align-items: center; gap: 6px;
          min-height: 36px; padding: 0 var(--space-4);
          border-radius: 12px;
          background: var(--grad-streak); color: #1A1203;
          font-size: var(--text-xs); font-weight: var(--weight-bold);
        }
        .aic__error-cta:active { transform: scale(0.97); }

        /* ── Composer ── */
        .aic__composer {
          flex-shrink: 0;
          display: flex; align-items: flex-end; gap: var(--space-2);
          padding: var(--space-3) var(--space-4) calc(var(--space-3) + env(safe-area-inset-bottom, 0px));
          border-top: 1px solid var(--border);
          background: var(--chrome-bg);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        .aic__field {
          flex: 1; min-width: 0;
          display: flex; align-items: center;
          padding: var(--space-2) var(--space-4);
          min-height: 44px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border);
          background: var(--bg-secondary);
          transition: border-color var(--t), box-shadow var(--t);
        }
        .aic__field:focus-within {
          border-color: rgba(0, 168, 255, 0.55);
          box-shadow: 0 0 0 3px rgba(0, 168, 255, 0.12);
        }
        .aic__input {
          width: 100%; max-height: 132px;
          background: transparent; color: var(--text-primary);
          font-family: inherit; font-size: var(--text-base); line-height: 1.4;
          resize: none; border: none; outline: none;
        }
        .aic__input::placeholder { color: var(--text-tertiary); }

        .aic__send {
          width: 44px; height: 44px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          border-radius: var(--radius-md);
          border: 1px solid var(--border);
          background: var(--surface-2); color: var(--text-secondary);
          transition: transform 0.15s var(--ease-out), background var(--t), color var(--t);
        }
        .aic__send:active { transform: scale(0.94); }
        .aic__send:disabled { opacity: 0.45; }
        .aic__send--go {
          border-color: transparent; color: #fff;
          background: var(--grad-primary);
          box-shadow: 0 4px 16px rgba(0, 168, 255, 0.35);
        }
        .aic__send--stop {
          border-color: transparent;
          background: var(--danger-bg); color: var(--danger);
        }

        /* ── Markdown inside a reply ── */
        .aic__answer .md { display: flex; flex-direction: column; gap: var(--space-2); }
        .aic__answer .md-p { line-height: 1.55; white-space: pre-wrap; word-break: break-word; }
        .aic__answer .md-h {
          font-family: var(--font-display); font-weight: var(--weight-bold);
          font-size: var(--text-md); margin-top: var(--space-1);
        }
        .aic__answer .md-list { padding-left: 1.15em; display: flex; flex-direction: column; gap: var(--space-1); }
        .aic__answer .md-list li { line-height: 1.5; }
        .aic__answer ul.md-list { list-style: disc; }
        .aic__answer ol.md-list { list-style: decimal; }
        .aic__answer .md-quote {
          padding-left: var(--space-3);
          border-left: 2px solid var(--btn-bg);
          color: var(--text-secondary);
        }
        .aic__answer .md-code {
          padding: 1px 5px; border-radius: 6px;
          background: var(--surface-2);
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.9em;
        }
        .aic__answer .md-pre {
          padding: var(--space-3); border-radius: var(--radius-sm);
          background: var(--surface-2); border: 1px solid var(--border);
          overflow-x: auto;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: var(--text-sm); line-height: 1.45;
        }
        .aic__answer .md-link { color: var(--link-color); text-decoration: underline; }
      `}</style>
    </div>
  );
}
