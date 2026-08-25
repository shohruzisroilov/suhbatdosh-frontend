import React from 'react';
import useAppStore from '../store/useAppStore';
import { useT } from '../i18n';

export default function ConnectionBanner() {
  const isConnected = useAppStore((s) => s.isConnected);
  const token = useAppStore((s) => s.token);
  const t = useT();

  if (isConnected || !token) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        padding: 'calc(env(safe-area-inset-top, 0px) + var(--space-2)) var(--space-3) var(--space-2)',
        background: '#e53935',
        color: '#fff',
        fontSize: 'var(--space-3)',
        fontWeight: 600,
        textAlign: 'center',
      }}
    >
      {t('conn.disconnected')}
    </div>
  );
}
