import { useEffect, useRef } from 'react';

/**
 * Shows Telegram's native back button while a screen is mounted and routes it to
 * `onBack`.
 *
 * The app draws its own screens off a `screen` string rather than real routes, so the
 * system back button does nothing unless a screen opts in. It used to be wired on
 * some screens and not others, which made the button appear and disappear as people
 * moved around. Every non-tab screen should call this.
 *
 * Pass `enabled: false` for screens that are sometimes a tab and sometimes not.
 */
export function useTelegramBackButton(onBack: () => void, enabled = true) {
  // Kept in a ref so a new inline callback each render does not re-register the
  // handler — Telegram would otherwise accumulate listeners.
  const handlerRef = useRef(onBack);
  handlerRef.current = onBack;

  useEffect(() => {
    if (!enabled) return;

    const backBtn = window.Telegram?.WebApp?.BackButton;
    if (!backBtn) return;

    const handle = () => handlerRef.current?.();

    backBtn.onClick(handle);
    backBtn.show();

    return () => {
      backBtn.offClick(handle);
      backBtn.hide();
    };
  }, [enabled]);
}

export default useTelegramBackButton;
