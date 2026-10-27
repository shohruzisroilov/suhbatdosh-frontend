import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useT } from '../i18n';
import { Message } from '../types';

function msgTime(d: string) {
  return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface ChatOverlayProps {
  messages: Message[];
  isPartnerTyping?: boolean;
  sessionId?: string | number;
  onClose: () => void;
  sendMessage: (sessionId: string | number, text: string) => void;
  sendTyping: (sessionId: string | number) => void;
}

export default function ChatOverlay({
  messages,
  isPartnerTyping,
  sessionId,
  onClose,
  sendMessage,
  sendTyping,
}: ChatOverlayProps) {
  const t = useT();
  const [input, setInput] = useState('');
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    const container = messagesRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [scrollToBottom]);

  useEffect(() => {
    scrollToBottom(true);
  }, [messages, isPartnerTyping, scrollToBottom]);

  const handleSend = useCallback(() => {
    const c = input.trim();
    if (!c || !sessionId) return;
    sendMessage(sessionId, c);
    setInput('');

    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
    }

    inputRef.current?.focus();
  }, [input, sessionId, sendMessage]);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);

      const textarea = inputRef.current;
      if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 100)}px`;
      }

      if (!sessionId) return;
      sendTyping(sessionId);
    },
    [sessionId, sendTyping]
  );

  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="chat-overlay">
      <div className="chat-overlay__header">
        <span className="chat-overlay__title">{t('co.title')}</span>
        <button className="chat-overlay__close" onClick={onClose} aria-label="Close chat">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div ref={messagesRef} className="chat-overlay__messages" role="log">
        {messages.length === 0 && <div className="chat-overlay__empty">{t('co.empty')}</div>}
        {messages.map((msg, i) => {
          const isOwn = msg.is_own ?? msg.isOwn ?? false;
          const timeStr = msg.sent_at || msg.sentAt || new Date().toISOString();
          const prevTimeStr = i > 0 ? (messages[i - 1].sent_at || messages[i - 1].sentAt || '') : '';
          const showTime =
            i === 0 ||
            (prevTimeStr && Math.abs(new Date(timeStr).getTime() - new Date(prevTimeStr).getTime()) > 300000);
          return (
            <React.Fragment key={msg.id || i}>
              {showTime && <div className="chat-overlay__timesep">{msgTime(timeStr)}</div>}
              <div className={`co-msg ${isOwn ? 'co-msg--own' : 'co-msg--other'}`}>
                <div className={`co-bubble ${isOwn ? 'co-bubble--own' : 'co-bubble--other'}`}>
                  <p>{msg.content}</p>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        {isPartnerTyping && (
          <div className="co-msg co-msg--other">
            <div className="co-bubble co-bubble--other co-typing">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
      </div>

      <div className="chat-overlay__inputbar">
        <div className="chat-overlay__input-wrap">
          <textarea
            ref={inputRef}
            className="chat-overlay__input"
            value={input}
            onChange={handleInput}
            onKeyDown={handleKey}
            placeholder={t('co.placeholder')}
            rows={1}
            maxLength={2000}
          />
        </div>
        <button
          className={`chat-overlay__send${input.trim() ? ' active' : ''}`}
          onClick={handleSend}
          disabled={!input.trim()}
          aria-label="Send"
        >
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>

      <style>{`
        .chat-overlay {
          position: absolute; inset: 0;
          background: var(--bg);
          display: flex; flex-direction: column;
          z-index: 50;
          animation: slideUp 0.26s cubic-bezier(0.34,1.1,0.64,1);
        }

        .chat-overlay__header {
          display: flex; align-items: center; justify-content: space-between;
          padding: var(--space-4) var(--space-4) var(--space-3);
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .chat-overlay__title {
          font-size: var(--text-md); font-weight: var(--weight-bold); letter-spacing: -0.3px;
        }
        .chat-overlay__close {
          width: 32px; height: 32px; border-radius: 50%;
          background: var(--bg-secondary); color: var(--text-secondary);
          display: flex; align-items: center; justify-content: center;
          transition: opacity var(--t);
        }
        .chat-overlay__close:active { opacity: 0.6; }

        .chat-overlay__messages {
          flex: 1; overflow-y: auto;
          padding: var(--space-3) 0 var(--space-2);
          display: flex; flex-direction: column; gap: var(--space-0-5);
          overscroll-behavior: contain;
        }
        .chat-overlay__empty {
          flex: 1; display: flex; align-items: center; justify-content: center;
          color: var(--text-secondary); font-size: var(--text-base); padding: var(--space-7);
          text-align: center;
        }
        .chat-overlay__timesep {
          text-align: center; font-size: var(--text-xs);
          color: var(--text-secondary); padding: var(--space-1-5) 0;
        }

        .co-msg { display: flex; padding: var(--space-0-5) var(--space-4); }
        .co-msg--own   { justify-content: flex-end; }
        .co-msg--other { justify-content: flex-start; }
        .co-bubble {
          max-width: 72%; padding: var(--space-3) var(--space-3); border-radius: 18px;
          word-break: break-word;
          animation: fadeUp 0.15s ease forwards;
        }
        .co-bubble--own {
          background: var(--primary); color: var(--primary-contrast);
          border-bottom-right-radius: 5px;
        }
        .co-bubble--other {
          background: var(--bg-secondary); color: var(--text-primary);
          border: 1px solid var(--border); border-bottom-left-radius: 5px;
        }
        .co-bubble p { font-size: var(--text-base); line-height: 1.45; }
        .co-typing {
          display: flex; gap: var(--space-1); align-items: center;
          padding: var(--space-3) var(--space-4);
        }
        .co-typing span {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--text-secondary);
          animation: typingDot 1.2s infinite;
        }
        .co-typing span:nth-child(2) { animation-delay: 0.2s; }
        .co-typing span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes typingDot {
          0%,60%,100% { transform: translateY(0); }
          30%          { transform: translateY(-5px); }
        }

        .chat-overlay__inputbar {
          display: flex; align-items: flex-end; gap: var(--space-2);
          padding: var(--space-3) var(--space-3) calc(var(--space-4) + env(safe-area-inset-bottom, 0px));
          border-top: 1px solid var(--border);
          flex-shrink: 0; background: var(--bg);
        }
        .chat-overlay__input-wrap {
          flex: 1; background: var(--bg-secondary);
          border: 1px solid var(--border); border-radius: 22px;
          padding: var(--space-3) var(--space-4); min-height: 42px;
          display: flex; align-items: center;
          transition: border-color var(--t), box-shadow var(--t);
        }
        .chat-overlay__input-wrap:focus-within {
          border-color: var(--primary);
          box-shadow: 0 0 0 2px var(--primary-subtle);
        }
        .chat-overlay__input {
          width: 100%; background: transparent; color: var(--text-primary);
          font-size: var(--text-base); resize: none; max-height: 100px; line-height: 1.4;
          border: none !important; outline: none !important; box-shadow: none !important;
          font-family: inherit; -webkit-tap-highlight-color: transparent;
        }
        .chat-overlay__input:focus {
          border: none !important; outline: none !important; box-shadow: none !important;
        }
        .chat-overlay__input::placeholder { color: var(--text-secondary); }
        .chat-overlay__send {
          width: 42px; height: 42px; border-radius: var(--radius-full);
          background: var(--border); color: var(--text-secondary);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: all var(--t);
          border: none; outline: none;
        }
        .chat-overlay__send.active {
          background: var(--primary); color: var(--primary-contrast);
        }
        .chat-overlay__send:active:not(:disabled) { transform: scale(0.92); }
      `}</style>
    </div>
  );
}
