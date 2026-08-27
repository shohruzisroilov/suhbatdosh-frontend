import React, { useEffect, type CSSProperties, type ReactNode } from 'react';
import { AlertCircle, ArrowLeft, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { tapHaptic } from '../utils/haptics';

/**
 * The shell every AI mock exam shares: the header, the "getting ready" state and the
 * start card.
 *
 * IELTS and CEFR used to draw all three themselves. They drifted — different header
 * buttons, one page had a loading state and the other did not, one padded its content
 * and the other ran the card to the screen edge. Two exams that do the same thing
 * looked like two apps. Everything visual lives here now; a page only picks its accent
 * colour and passes its own copy.
 */

export type MockAccentName = 'ielts' | 'cefr';

interface AccentTokens {
  accent: string;
  accent2: string;
  /** Text colour that stays readable on top of the accent gradient. */
  onAccent: string;
  soft: string;
  tint: string;
  glow: string;
}

const ACCENTS: Record<MockAccentName, AccentTokens> = {
  ielts: {
    accent: '#38bdf8',
    accent2: '#0ea5e9',
    onAccent: '#04121f',
    soft: 'rgba(56, 189, 248, 0.30)',
    tint: 'rgba(56, 189, 248, 0.16)',
    glow: 'rgba(56, 189, 248, 0.22)',
  },
  cefr: {
    accent: '#10b981',
    accent2: '#059669',
    onAccent: '#04140e',
    soft: 'rgba(16, 185, 129, 0.30)',
    tint: 'rgba(16, 185, 129, 0.16)',
    glow: 'rgba(16, 185, 129, 0.22)',
  },
};

export function accentVars(name: MockAccentName): CSSProperties {
  const a = ACCENTS[name];
  return {
    '--mk-accent': a.accent,
    '--mk-accent-2': a.accent2,
    '--mk-on-accent': a.onAccent,
    '--mk-soft': a.soft,
    '--mk-tint': a.tint,
    '--mk-glow': a.glow,
  } as CSSProperties;
}

/** Injected once into <head> so mounting three of these does not mean three copies. */
function useMockCss() {
  useEffect(() => {
    if (document.getElementById('mk-mock-css')) return;
    const el = document.createElement('style');
    el.id = 'mk-mock-css';
    el.textContent = MOCK_CSS;
    document.head.appendChild(el);
  }, []);
}

// ─── Header ───────────────────────────────────────────────────────────────────

export function MockHeader({
  accent,
  title,
  soundEnabled,
  onToggleSound,
  onBack,
}: {
  accent: MockAccentName;
  title: string;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onBack: () => void;
}) {
  useMockCss();
  return (
    <header className="mk-header" style={accentVars(accent)}>
      <button
        type="button"
        className="mk-icon-btn"
        aria-label="Back"
        onClick={() => {
          tapHaptic('light');
          onBack();
        }}
      >
        <ArrowLeft size={18} aria-hidden="true" />
      </button>

      <div className="mk-header__title">
        <Sparkles size={16} className="mk-header__spark" aria-hidden="true" />
        <span>{title}</span>
      </div>

      <button
        type="button"
        className="mk-icon-btn"
        aria-pressed={soundEnabled}
        aria-label={soundEnabled ? 'Turn the examiner voice off' : 'Turn the examiner voice on'}
        onClick={() => {
          tapHaptic('light');
          onToggleSound();
        }}
      >
        {soundEnabled ? <Volume2 size={18} aria-hidden="true" /> : <VolumeX size={18} aria-hidden="true" />}
      </button>
    </header>
  );
}

// ─── Loading ──────────────────────────────────────────────────────────────────

export function MockLoading({
  accent,
  label,
  sublabel,
}: {
  accent: MockAccentName;
  label: string;
  /** Second line for the longer waits — what is happening and roughly how long. */
  sublabel?: string;
}) {
  useMockCss();
  return (
    <div className="mk-center" style={accentVars(accent)} role="status" aria-live="polite">
      <div className="mk-spinner" aria-hidden="true" />
      <p className="mk-center__label">{label}</p>
      {sublabel && <p className="mk-center__sub">{sublabel}</p>}
    </div>
  );
}

// ─── Start card ───────────────────────────────────────────────────────────────

export interface MockDetail {
  icon: ReactNode;
  label: string;
  value: string;
  /** Spans both grid columns — for values too long to sit in half a row. */
  wide?: boolean;
}

export interface MockAction {
  label: string;
  /** Shown next to the spinner while this action is running. Falls back to `label`. */
  busyLabel?: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

export type MockBusyAction = 'start' | 'resume' | 'discard' | null;

function ActionButton({
  action,
  variant,
  busy,
  locked,
}: {
  action: MockAction;
  variant: 'primary' | 'ghost' | 'danger';
  busy: boolean;
  /** Another action on the card is running, so this one must not be tappable. */
  locked: boolean;
}) {
  return (
    <button
      type="button"
      className={`mk-btn mk-btn--${variant}`}
      onClick={action.onClick}
      disabled={action.disabled || busy || locked}
      aria-busy={busy || undefined}
    >
      {busy ? (
        <>
          <span className="mk-btn__spinner" aria-hidden="true" />
          <span>{action.busyLabel || action.label}</span>
        </>
      ) : (
        <>
          {action.icon}
          <span>{action.label}</span>
        </>
      )}
    </button>
  );
}

export function MockIntroCard({
  accent,
  hero,
  title,
  description,
  details,
  error,
  note,
  start,
  resume,
  discard,
  busy = null,
}: {
  accent: MockAccentName;
  hero: ReactNode;
  title: string;
  description: string;
  details: MockDetail[];
  error?: string | null;
  /** Quiet line under the buttons — e.g. why the start button is greyed out. */
  note?: string | null;
  start?: MockAction;
  resume?: MockAction;
  discard?: MockAction;
  busy?: MockBusyAction;
}) {
  useMockCss();
  const locked = busy !== null;

  return (
    <div className="mk-shell" style={accentVars(accent)}>
      <div className="mk-card">
        <div className="mk-hero">{hero}</div>

        <h1 className="mk-card__title">{title}</h1>
        <p className="mk-card__desc">{description}</p>

        <div className="mk-details">
          {details.map((d) => (
            <div className={`mk-detail${d.wide ? ' mk-detail--wide' : ''}`} key={d.label}>
              <div className="mk-detail__head">
                {d.icon}
                <span>{d.label}</span>
              </div>
              <p className="mk-detail__val">{d.value}</p>
            </div>
          ))}
        </div>

        {error && (
          <div className="mk-error" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div className="mk-actions">
          {resume && <ActionButton action={resume} variant="primary" busy={busy === 'resume'} locked={locked} />}
          {start && <ActionButton action={start} variant="primary" busy={busy === 'start'} locked={locked} />}
          {discard && <ActionButton action={discard} variant="danger" busy={busy === 'discard'} locked={locked} />}
        </div>

        {note && <p className="mk-note">{note}</p>}
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const MOCK_CSS = `
  .mk-header {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    padding: 12px 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(15, 23, 42, 0.72);
    backdrop-filter: blur(12px);
    position: sticky; top: 0; z-index: 20;
  }
  .mk-icon-btn {
    width: 38px; height: 38px; flex-shrink: 0;
    border-radius: 12px;
    display: inline-flex; align-items: center; justify-content: center;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.10);
    color: #ffffff; cursor: pointer;
    transition: transform 0.12s ease, background 0.15s ease;
  }
  .mk-icon-btn:active { transform: scale(0.94); background: rgba(255, 255, 255, 0.12); }
  .mk-header__title {
    flex: 1; min-width: 0;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    font-size: 15px; font-weight: 700; color: #ffffff;
  }
  .mk-header__title span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mk-header__spark { color: var(--mk-accent); flex-shrink: 0; }

  .mk-center {
    flex: 1;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 14px; padding: 32px 20px; min-height: 55vh; text-align: center;
  }
  .mk-spinner {
    width: 40px; height: 40px; border-radius: 50%;
    border: 3px solid rgba(255, 255, 255, 0.12);
    border-top-color: var(--mk-accent);
    animation: mkSpin 0.8s linear infinite;
  }
  @keyframes mkSpin { to { transform: rotate(360deg); } }
  .mk-center__label { margin: 0; font-size: 16px; font-weight: 700; color: #f1f5f9; }
  .mk-center__sub {
    margin: -4px 0 0; font-size: 13px; line-height: 1.5; color: #94a3b8;
    max-width: 320px;
  }

  .mk-shell {
    width: 100%; max-width: 500px; margin: 0 auto;
    padding: 16px; box-sizing: border-box;
  }
  .mk-card {
    background: linear-gradient(145deg, rgba(16, 24, 38, 0.96), rgba(10, 16, 26, 0.98));
    border: 1px solid var(--mk-soft);
    border-radius: 24px;
    padding: 24px 20px;
    display: flex; flex-direction: column; align-items: center; text-align: center;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4), 0 0 24px var(--mk-glow);
    animation: mkRise 0.28s ease both;
  }
  @keyframes mkRise {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: none; }
  }
  .mk-hero {
    width: 72px; height: 72px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: var(--mk-tint); color: var(--mk-accent);
    border: 1px solid var(--mk-soft);
    box-shadow: 0 0 20px var(--mk-glow);
    margin-bottom: 16px;
  }
  .mk-card__title { font-size: 20px; font-weight: 800; margin: 0 0 8px; color: #ffffff; line-height: 1.25; }
  .mk-card__desc { font-size: 13px; line-height: 1.55; color: #94a3b8; margin: 0 0 18px; }

  .mk-details {
    display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: 100%;
  }
  .mk-detail {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px; padding: 12px 14px;
    display: flex; flex-direction: column; gap: 4px; text-align: left;
  }
  .mk-detail--wide { grid-column: span 2; }
  .mk-detail__head {
    display: flex; align-items: center; gap: 6px;
    font-size: 11px; font-weight: 700; color: #94a3b8;
  }
  .mk-detail__head svg { color: var(--mk-accent); flex-shrink: 0; }
  .mk-detail__val { font-size: 13px; font-weight: 700; color: #ffffff; margin: 0; line-height: 1.35; }

  .mk-error {
    margin-top: 16px; width: 100%; box-sizing: border-box;
    display: flex; align-items: flex-start; gap: 8px; text-align: left;
    background: rgba(239, 68, 68, 0.14);
    border: 1px solid rgba(239, 68, 68, 0.30);
    color: #fca5a5; padding: 10px 12px; border-radius: 12px;
    font-size: 12.5px; line-height: 1.45;
  }
  .mk-error svg { flex-shrink: 0; margin-top: 1px; }

  .mk-actions { display: flex; flex-direction: column; gap: 10px; width: 100%; margin-top: 18px; }
  .mk-btn {
    width: 100%; min-height: 52px; border-radius: 16px;
    font-size: 15px; font-weight: 800; font-family: inherit;
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    border: none; cursor: pointer;
    transition: transform 0.12s ease, opacity 0.15s ease, box-shadow 0.15s ease;
  }
  .mk-btn:active:not(:disabled) { transform: scale(0.98); }
  .mk-btn:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
  .mk-btn[aria-busy="true"] { opacity: 0.9; cursor: progress; }
  .mk-btn--primary {
    background: linear-gradient(135deg, var(--mk-accent), var(--mk-accent-2));
    color: var(--mk-on-accent);
    box-shadow: 0 6px 20px var(--mk-glow);
  }
  .mk-btn--ghost {
    background: rgba(255, 255, 255, 0.07); color: #ffffff;
    border: 1px solid rgba(255, 255, 255, 0.14);
  }
  .mk-btn--danger {
    background: rgba(239, 68, 68, 0.12); color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.24);
  }
  /* currentColor with a cut-out top works on every button variant. */
  .mk-btn__spinner {
    width: 18px; height: 18px; border-radius: 50%;
    border: 2px solid currentColor; border-top-color: transparent;
    opacity: 0.85;
    animation: mkSpin 0.7s linear infinite;
  }

  .mk-note { margin: 12px 0 0; font-size: 12px; line-height: 1.45; color: #64748b; }

  @media (prefers-reduced-motion: reduce) {
    .mk-card { animation: none; }
    .mk-spinner, .mk-btn__spinner { animation-duration: 2.4s; }
  }
`;
