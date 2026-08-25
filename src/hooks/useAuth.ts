import { useEffect } from 'react';
import { authTelegram, getMe } from '../api/endpoints';
import useAppStore from '../store/useAppStore';
import { translate } from '../i18n/index';

export function useAuth() {
  const { token, user, setToken, setUser, setAuthLoading, setStats, setRecentSessions, navigate, setAppError } =
    useAppStore();

  useEffect(() => {
    const applyTheme = () => {
      const scheme = window.Telegram?.WebApp?.colorScheme || 'dark';
      const root = document.documentElement;
      if (!root.classList.contains(scheme)) {
        root.classList.add(scheme);
        root.classList.remove(scheme === 'dark' ? 'light' : 'dark');
      }
    };

    applyTheme();
    window.Telegram?.WebApp?.onEvent('themeChanged', applyTheme);

    async function init() {
      try {
        let initData = window.Telegram?.WebApp?.initData || '';
        const urlParams = new URLSearchParams(window.location.search);
        let startParam =
          window.Telegram?.WebApp?.initDataUnsafe?.start_param ||
          urlParams.get('startapp') ||
          urlParams.get('ref') ||
          null;

        const wantsMatch = startParam === 'match' || urlParams.get('match') === '1';
        const wantsMock = startParam === 'mock' || urlParams.get('mock') === '1';
        if (startParam === 'match' || startParam === 'mock') startParam = null;

        if (!initData) {
          const userId = urlParams.get('user') || '1';
          initData = `test:${userId}`;
        }

        const authResult = await authTelegram(initData, startParam);
        setToken(authResult.token);
        setUser(authResult.user);

        const meData = await getMe();
        setStats(meData.stats);
        setRecentSessions(meData.recentSessions);

        const u = authResult.user;
        const needsOnboarding = !u.hasOnboarded;

        if (needsOnboarding) navigate('onboarding');
        else if (wantsMatch) navigate('matching');
        else if (wantsMock) navigate('ielts');
        else navigate('home');
      } catch (err) {
        console.error('Auth error:', err);
        const tgLang = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
        setAppError(translate(tgLang, 'auth.error'));
      } finally {
        setAuthLoading(false);
      }
    }

    init();

    return () => {
      window.Telegram?.WebApp?.offEvent('themeChanged', applyTheme);
    };
  }, []);

  return { token, user };
}
