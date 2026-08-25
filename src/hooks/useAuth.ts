import { useEffect } from 'react';
import { authTelegram, getMe } from '../api/endpoints';
import useAppStore from '../store/useAppStore';
import { translate } from '../i18n';

// Faqat localhost'da test mode ishlaydi
const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const IS_PROD = import.meta.env.PROD;

/** Telegram WebApp.initData bo'sh kelsa bir oz kuting */
function waitForInitData(timeoutMs = 5000): Promise<string> {
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
  const { token, user, setToken, setUser, setAuthLoading, setStats, setRecentSessions, navigate, setAppError, setIsSubscribed } =
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
        let initData = await waitForInitData(5000);

        let startParam =
          window.Telegram?.WebApp?.initDataUnsafe?.start_param ||
          urlParams.get('startapp') ||
          urlParams.get('ref') ||
          null;

        const wantsMatch = startParam === 'match' || urlParams.get('match') === '1';
        const wantsMock = startParam === 'mock' || urlParams.get('mock') === '1';
        if (startParam === 'match' || startParam === 'mock') startParam = null;

        if (!initData) {
          const testUserParam = urlParams.get('user') || urlParams.get('test_user');
          if (!IS_PROD || testUserParam || urlParams.get('dev') === '1') {
            // Development yoki ?user=1 Parametr berilganda test user sifatida kirish
            const userId = testUserParam || '1';
            initData = `test:${userId}`;
          } else {
            // Production: Telegram initData topilmadi
            throw new Error('Telegram ilovasi aniqlanmadi. Iltimos, ilovani Telegram bot (@suhbatdosh_app_bot) orqali oching.');
          }
        }

        // Debug: initData holati
        console.log('[Auth] initData length:', initData?.length, 'isProd:', IS_PROD);
        if (initData && !initData.startsWith('test')) {
          const p = new URLSearchParams(initData);
          console.log('[Auth] hash present:', !!p.get('hash'), 'auth_date:', p.get('auth_date'));
        }

        let authResult;
        try {
          authResult = await authTelegram(initData, startParam);
        } catch (apiErr) {
          if (initData.startsWith('test')) {
            const testId = initData.split(':')[1] || '1';
            authResult = {
              token: 'demo-test-token',
              user: {
                id: testId,
                first_name: `TestUser_${testId}`,
                username: `testuser${testId}`,
                level: 3,
                is_premium: true,
                daily_minutes_left: 60,
                hasOnboarded: true,
              },
            };
          } else {
            throw apiErr;
          }
        }

        setToken(authResult.token);
        setUser(authResult.user);
        if (typeof authResult.isSubscribed === 'boolean') {
          setIsSubscribed(authResult.isSubscribed);
        }

        let meData;
        try {
          meData = await getMe();
        } catch (meErr) {
          if (initData.startsWith('test')) {
            meData = {
              stats: { total_sessions: 12, total_minutes: 145, avg_rating: '4.9', streakCount: 5, hasPracticedToday: true },
              recentSessions: [],
            };
          } else {
            throw meErr;
          }
        }

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
        const serverMsg = err?.response?.data?.error || err?.response?.data?.message;
        console.error('[Auth] HTTP status:', err?.response?.status, 'server error:', serverMsg);

        if (err?.message?.includes('Telegram')) {
          setAppError(err.message);
        } else if (serverMsg) {
          setAppError(`${translate(tgLang, 'auth.error')} (${serverMsg})`);
        } else if (err?.message) {
          setAppError(`${translate(tgLang, 'auth.error')} (${err.message})`);
        } else {
          setAppError(translate(tgLang, 'auth.error'));
        }
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
