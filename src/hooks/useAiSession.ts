import { useCallback } from 'react';
import useAppStore from '../store/useAppStore';

/**
 * Opens a session with the AI partner.
 *
 * Shared by Home and the "nobody is free" screen so both enter the session the same
 * way — the setup is fiddly enough (synthetic session id, `isAi`, pre-connected
 * partner, cleared matching state) that two copies would drift.
 *
 * Returns false when the free daily limit is already spent, having moved the store
 * into the limit-reached state so the caller does not need to handle it.
 */
export function useAiSession() {
  return useCallback((onLimitReached?: () => void) => {
    const store = useAppStore.getState();
    const { user } = store;

    if (!user?.isPremium) {
      const used = user?.dailyMinutes || 0;
      const limit = user?.dailyLimit || 0;
      if (limit > 0 && used >= limit) {
        useAppStore.setState({ matchingStatus: 'limit_reached' });
        onLimitReached?.();
        return false;
      }
    }

    useAppStore.setState({
      session: {
        id: `ai_${Date.now()}`,
        partnerName: 'Suhbatdosh AI',
        partnerLevel: user?.level || 1,
        isAi: true,
      },
      partnerConnected: true,
      isCallActive: false,
      matchingStatus: 'idle',
      messages: [],
    });

    store.navigate('chat');
    return true;
  }, []);
}

export default useAiSession;
