import React from 'react';
import useAppStore from '../store/useAppStore';
import { useT } from '../i18n';
import { WifiOff } from 'lucide-react';

export default function ConnectionBanner() {
  const isConnected = useAppStore((s) => s.isConnected);
  const token = useAppStore((s) => s.token);
  const t = useT();

  if (isConnected || !token) return null;

  return (
    <>
      <div className="conn-banner" role="alert" aria-live="assertive">
        <WifiOff size={13} />
        <span>{t('conn.disconnected')}</span>
      </div>
      <style>{`
        .conn-banner {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 9999;
          padding: calc(env(safe-area-inset-top, 0px) + 8px) 16px 10px;
          background: linear-gradient(135deg, #dc2626, #b91c1c);
          color: #fff;
          font-size: 12px;
          font-weight: 700;
          text-align: center;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          box-shadow: 0 2px 12px rgba(220, 38, 38, 0.4);
          animation: fadeIn 0.2s ease both;
        }
      `}</style>
    </>
  );
}
