import { useCallback } from 'react';
import useAppStore from '../store/useAppStore';

/**
 * Opens the AI partner.
 *
 * Shared by Home and the "nobody is free" screen so both enter it the same way, and so
 * the daily-limit check cannot drift between them.
 *
 * The partner used to be entered as a fake call — a synthetic session id, a
 * pre-connected partner, the human call screen in AI mode. It is a chat now, with its
 * own screen and its own saved history, so none of that scaffolding is set up any
 * more; any session left over from a real call is cleared instead.
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
      session: null,
      partnerConnected: false,
      isCallActive: false,
      matchingStatus: 'idle',
      messages: [],
    });

    store.navigate('ai_talk');
    return true;
  }, []);
}

export default useAiSession;
