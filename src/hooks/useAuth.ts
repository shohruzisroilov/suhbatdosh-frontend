import { useEffect } from 'react';
import { authTelegram, getMe } from '../api/endpoints';
import useAppStore from '../store/useAppStore';
import { translate } from '../i18n';

// Faqat localhost'da test mode ishlaydi.
// IS_LOCAL ilgari hisoblanardi-yu, hech qayerda ishlatilmasdi — natijada `?user=5`
// yoki `?dev=1` production'da ham test rejimini ochib yuborardi.
const IS_LOCAL =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const IS_PROD = import.meta.env.PROD;

/** Test login faqat dev build'da VA localhost'da ruxsat etiladi. */
const TEST_LOGIN_ALLOWED = !IS_PROD && IS_LOCAL;

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
          if (TEST_LOGIN_ALLOWED) {
            // Local dev: ?user=5 bilan istalgan test hisobiga kirish mumkin.
            const testUserParam = urlParams.get('user') || urlParams.get('test_user');
            const userId = testUserParam || '1';
            initData = `test:${userId}`;
          } else {
            // Production: Telegram initData topilmadi
            throw new Error(translate(undefined, 'auth.notInTelegram'));
          }
        }

        // initData is a signed credential. Its length, hash and auth_date were logged
        // on every launch, in production, into a console that anyone can open from
        // Telegram Desktop's devtools — and screenshots of it end up in bug reports.
        // Diagnostics stay, but only where they are useful and harmless.
        if (import.meta.env.DEV) {
          console.log('[Auth] initData length:', initData?.length);
        }

        let authResult;
        try {
          authResult = await authTelegram(initData, startParam);
        } catch (apiErr) {
          // Offline demo user faqat local dev'da. Ilgari bu production'da ham
          // ishlab, backend rad etganda ham UI'ni "premium foydalanuvchi kirdi"
          // holatiga qo'yardi — keyin har bir so'rov 401 qaytarardi.
          if (TEST_LOGIN_ALLOWED && initData.startsWith('test')) {
            console.warn('[Auth] Backend unreachable — using local demo user');
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
          if (TEST_LOGIN_ALLOWED && initData.startsWith('test')) {
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
        const tgLang = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
        const status = err?.response?.status;
        const serverMsg = err?.response?.data?.error || err?.response?.data?.message;
        const code = err?.response?.data?.code;

        if (import.meta.env.DEV) {
          console.error('Auth error:', status, serverMsg, err);
        }

        // A suspended account gets a plain statement of what happened and who to
        // contact, not a generic "could not sign in" that reads as a bug and sends
        // them round the retry loop forever.
        if (status === 403 || err?.response?.data?.banned) {
          setAppError(translate(tgLang, 'auth.banned'));
          return;
        }

        // Telegram hands a mini app it resumed from the background the signature it
        // was launched with, however long ago that was. The person did nothing wrong
        // and nothing is broken — but a reload runs inside that same webview and gets
        // the same stale signature back, so the usual "try again" is a loop with no
        // exit. Closing is what produces a fresh launch, so that is what is offered.
        if (code === 'INITDATA_EXPIRED') {
          setAppError(translate(tgLang, 'auth.expired'), 'reopen');
          return;
        }

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
