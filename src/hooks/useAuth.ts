import { useEffect } from 'react';
import { authTelegram, getMe } from '../api/endpoints';
import useAppStore from '../store/useAppStore';
import { translate } from '../i18n';

// Faqat localhost'da test mode ishlaydi
const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const IS_PROD = import.meta.env.PROD;

/** Telegram WebApp.initData bo'sh kelsa bir oz kuting */
function waitForInitData(timeoutMs = 2000): Promise<string> {
  return new Promise((resolve) => {
    const data = window.Telegram?.WebApp?.initData;
    if (data) {
      resolve(data);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      const d = window.Telegram?.WebApp?.initData;
      if (d) {
        clearInterval(interval);
        resolve(d);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        clearInterval(interval);
        resolve('');
      }
    }, 50);
  });
}

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
    window.Telegram?.WebApp?.onEvent?.('themeChanged', applyTheme);

    async function init() {
      try {
        // Telegram mini app'ni "tayyor" deb belgilaymiz — bu iOS da initData'ni unlock qiladi
        window.Telegram?.WebApp?.ready();

        const urlParams = new URLSearchParams(window.location.search);

        // initData yuklanishini kutamiz (iOS da kechikishi mumkin)
        let initData = await waitForInitData(2000);

        let startParam =
          window.Telegram?.WebApp?.initDataUnsafe?.start_param ||
          urlParams.get('startapp') ||
          urlParams.get('ref') ||
          null;

        const wantsMatch = startParam === 'match' || urlParams.get('match') === '1';
        const wantsMock = startParam === 'mock' || urlParams.get('mock') === '1';
        if (startParam === 'match' || startParam === 'mock') startParam = null;

        if (!initData) {
          if (!IS_PROD) {
            // Development: test user bilan ishlash
            const userId = urlParams.get('user') || '1';
            initData = `test:${userId}`;
          } else {
            // Production: initData yo'q bo'lsa — haqiqiy Telegram ichida emas
            throw new Error('No Telegram initData. Please open this app inside Telegram.');
          }
        }

        // Debug: initData holati
        console.log('[Auth] initData length:', initData?.length, 'isProd:', IS_PROD);
        if (initData && !initData.startsWith('test')) {
          const p = new URLSearchParams(initData);
          console.log('[Auth] hash present:', !!p.get('hash'), 'auth_date:', p.get('auth_date'));
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
      } catch (err: any) {
        console.error('Auth error:', err);
        const tgLang = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
        // HTTP status kodni ko'rsatish uchun (debug)
        const status = err?.response?.status;
        const serverMsg = err?.response?.data?.error;
        console.error('[Auth] HTTP status:', status, 'server error:', serverMsg);
        setAppError(translate(tgLang, 'auth.error'));
      } finally {
        setAuthLoading(false);
      }
    }

    init();

    return () => {
      window.Telegram?.WebApp?.offEvent?.('themeChanged', applyTheme);
    };
  }, []);

  return { token, user };
}
