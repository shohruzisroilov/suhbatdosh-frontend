import { useCallback } from 'react';
import useAppStore from '../store/useAppStore';

export function useAiSession() {
  return useCallback(() => {
    const store = useAppStore.getState();
    store.navigate('home');
    return false;
  }, []);
}

export default useAiSession;
