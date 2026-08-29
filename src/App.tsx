import React, { Suspense, lazy } from 'react';
import { AlertTriangle } from 'lucide-react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import useAppStore from './store/useAppStore';
import { useAuth } from './hooks/useAuth';
import { useSocket } from './hooks/useSocket';
import LoadingScreen from './components/LoadingScreen';
import ErrorBoundary from './components/ErrorBoundary';
import ConnectionBanner from './components/ConnectionBanner';
import Toast from './components/Toast';
import BottomNav from './components/BottomNav';
import MicPermissionModal from './components/MicPermissionModal';
import ChannelSubscribeModal from './components/ChannelSubscribeModal';

import Onboarding from './pages/Onboarding.tsx';
import Home from './pages/Home.tsx';
import Mock from './pages/Mock.tsx';
import Leaderboard from './pages/Leaderboard.tsx';
import Invite from './pages/Invite.tsx';
import Reviews from './pages/Reviews.tsx';
import Profile from './pages/Profile.tsx';
import Settings from './pages/Settings.tsx';
import Premium from './pages/Premium.tsx';
import Statistics from './pages/Statistics.tsx';
import Matching from './pages/Matching.tsx';
import SessionEnd from './pages/SessionEnd.tsx';
import IeltsMock from './pages/IeltsMock.tsx';
import CefrMock from './pages/CefrMock.tsx';
import Listings from './pages/Listings.tsx';

const Chat = lazy(() => import('./pages/Chat.tsx'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

const SCREENS: Record<string, React.ComponentType<any>> = {
  onboarding: Onboarding,
  home: Home,
  listings: Listings,
  mock: Mock,
  leaderboard: Leaderboard,
  invite: Invite,
  reviews: Reviews,
  profile: Profile,
  settings: Settings,
  premium: Premium,
  statistics: Statistics,
  matching: Matching,
  chat: Chat,
  session_end: SessionEnd,
  ielts: IeltsMock,
  ielts_mock: IeltsMock,
  cefr: CefrMock,
  cefr_mock: CefrMock,
};

const TAB_SCREENS = ['home', 'listings', 'mock', 'leaderboard', 'profile'];

function AuthErrorScreen({ message }: { message: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        gap: '16px',
        background: 'var(--bg, #fff)',
        color: 'var(--text-primary, #000)',
        textAlign: 'center',
        minHeight: '100dvh',
      }}
    >
      <AlertTriangle size={44} strokeWidth={1.75} color="var(--danger, #FF453A)" aria-hidden="true" />
      <p style={{ fontSize: 16, lineHeight: 1.5, maxWidth: 280 }}>{message}</p>
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: 8,
          minHeight: 44,
          padding: '12px 28px',
          borderRadius: 12,
          border: 'none',
          background: 'var(--btn-bg, #00A8FF)',
          color: '#fff',
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  );
}

function TelegramApp() {
  const { screen, navigate, isAuthLoading, appError, user, isSubscribed, setIsSubscribed } = useAppStore();
  useAuth();
  useSocket();

  if (isAuthLoading) return <LoadingScreen />;

  // Auth xato bo'ldi va user yo'q — retry screen ko'rsat
  if (appError && !user) return <AuthErrorScreen message={appError} />;

  const ScreenComponent = SCREENS[screen] || Home;
  const showTabs = TAB_SCREENS.includes(screen);

  return (
    <>
      <ConnectionBanner />
      <Toast />
      <MicPermissionModal />
      <ChannelSubscribeModal
        isOpen={!isSubscribed}
        onSubscribed={() => setIsSubscribed(true)}
        telegramId={user?.telegramId || window.Telegram?.WebApp?.initDataUnsafe?.user?.id}
      />
      <ErrorBoundary>
        <Suspense fallback={<LoadingScreen />}>
          {showTabs ? (
            <div className="tab-shell">
              <div className="tab-shell__content">
                <ScreenComponent navigate={navigate} />
              </div>
              <BottomNav active={screen} />
            </div>
          ) : (
            <ScreenComponent navigate={navigate} />
          )}
        </Suspense>
      </ErrorBoundary>
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="*" element={<TelegramApp />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
