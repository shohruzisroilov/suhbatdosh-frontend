import { useEffect, useRef, useCallback } from 'react';
import useAppStore from '../store/useAppStore';
import { useSocket } from './useSocket';
import { translate } from '../i18n/index';

const MATCH_TIMEOUT_MS = 180_000;

function micErrorMessage(err: any) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return translate(null, 'mic.denied');
    case 'NotFoundError':
    case 'OverconstrainedError':
      return translate(null, 'mic.notFound');
    case 'NotReadableError':
    case 'AbortError':
      return translate(null, 'mic.busy');
    default:
      return translate(null, 'mic.unsupported');
  }
}

export function useMatch() {
  const matchingStatus = useAppStore((s) => s.matchingStatus);
  const { startMatching, cancelMatching } = useSocket();
  const timeoutRef = useRef<any>(null);

  const startSearch = useCallback(async () => {
    if (useAppStore.getState().matchingStatus === 'searching') return;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw Object.assign(new Error('mediaDevices unavailable'), { name: 'UnsupportedError' });
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch (err: any) {
      console.warn('Mikrofon xatosi:', err?.name, err?.message);
      const errMsg = micErrorMessage(err);
      if (window.Telegram?.WebApp?.showAlert) {
        window.Telegram.WebApp.showAlert(errMsg);
      } else {
        alert(errMsg);
      }
      return;
    }

    useAppStore.getState().setNoPartnerYet(false);
    useAppStore.getState().setMatchingStatus('searching');
    startMatching(useAppStore.getState().partnerPref || 'any');

    timeoutRef.current = setTimeout(() => {
      if (useAppStore.getState().matchingStatus === 'searching') {
        useAppStore.getState().setMatchingStatus('timeout');
        cancelMatching();
      }
    }, MATCH_TIMEOUT_MS);
  }, [startMatching, cancelMatching]);

  const cancel = useCallback(() => {
    clearTimeout(timeoutRef.current);
    cancelMatching();
    useAppStore.getState().setMatchingStatus('idle');
    useAppStore.getState().navigate('home');
  }, [cancelMatching]);

  useEffect(() => {
    if (matchingStatus === 'matched' || matchingStatus === 'idle') {
      clearTimeout(timeoutRef.current);
    }
  }, [matchingStatus]);

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  return { matchingStatus, startSearch, cancel };
}
