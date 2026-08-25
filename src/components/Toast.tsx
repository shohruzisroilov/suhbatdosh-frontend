import React, { useEffect } from 'react';
import useAppStore from '../store/useAppStore';

export default function Toast() {
  const appError = useAppStore((s) => s.appError);
  const setAppError = useAppStore((s) => s.setAppError);

  useEffect(() => {
    if (!appError) return;
    const t = setTimeout(() => setAppError(null), 4000);
    return () => clearTimeout(t);
  }, [appError, setAppError]);

  if (!appError) return null;

  return (
    <div
      onClick={() => setAppError(null)}
      style={{
        position: 'fixed',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
        left: '16px',
        right: '16px',
        zIndex: 9999,
        padding: 'var(--space-4) var(--space-4)',
        borderRadius: 'var(--space-3)',
        background: 'rgba(30,30,30,0.95)',
        color: '#fff',
        fontSize: 'var(--space-4)',
        textAlign: 'center',
        boxShadow: '0 var(--space-1) var(--space-5) rgba(0,0,0,0.3)',
      }}
    >
      {appError}
    </div>
  );
}
