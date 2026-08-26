import React, { useEffect, useRef, useCallback } from 'react';

/**
 * Accessible shell for the app's overlays.
 *
 * Every modal in this codebase was a bare `<div onClick>`: no dialog role, no Escape
 * key, and focus stayed on whatever was behind the overlay — so keyboard and screen
 * reader users could tab straight into the page they thought they had covered up.
 *
 * Wraps the *content* only. Each modal keeps its own visual styling; this component
 * supplies the backdrop, semantics and focus behaviour.
 */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Tracks nesting so the body scroll lock is only released by the last modal to close. */
let openModalCount = 0;

export interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  /** Accessible name. Pass `labelledBy` instead when a visible heading already names it. */
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  /** Set false for flows the user must resolve (e.g. a required subscription gate). */
  dismissible?: boolean;
  className?: string;
  backdropClassName?: string;
  children: React.ReactNode;
}

export default function Modal({
  isOpen,
  onClose,
  label,
  labelledBy,
  describedBy,
  dismissible = true,
  className,
  backdropClassName,
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const requestClose = useCallback(() => {
    if (dismissible) onClose?.();
  }, [dismissible, onClose]);

  // Escape to dismiss, Tab cycled inside the panel.
  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        requestClose();
        return;
      }

      if (e.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (!items.length) {
        // Nothing focusable inside — keep focus on the panel rather than letting it
        // escape to the page underneath.
        e.preventDefault();
        panel.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen, requestClose]);

  // Move focus in on open, put it back where it was on close.
  useEffect(() => {
    if (!isOpen) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    const firstField = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (firstField ?? panel)?.focus({ preventScroll: true });

    openModalCount += 1;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      openModalCount = Math.max(0, openModalCount - 1);
      if (openModalCount === 0) document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus?.({ preventScroll: true });
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    // Plain container: no role and not focusable, so assistive tech walks straight
    // through to the dialog. It must NOT be aria-hidden — that would hide the panel
    // nested inside it too. Backdrop click is a pointer convenience; Escape is the
    // equivalent for everyone else.
    <div className={backdropClassName} onClick={requestClose}>
      <div
        ref={panelRef}
        className={className}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
