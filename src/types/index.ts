export interface User {
  id: string | number;
  telegram_id?: string;
  telegramId?: number | bigint;
  first_name?: string;
  last_name?: string;
  username?: string;
  avatar_url?: string;
  avatarUrl?: string;
  display_name?: string;
  displayName?: string;
  native_lang?: string;
  learning_lang?: string;
  level?: number;
  gender?: string | null;
  gender_preference?: string;
  is_premium?: boolean;
  isPremium?: boolean;
  premium_until?: string | null;
  premiumUntil?: string | null;
  daily_minutes_left?: number;
  daily_free_minutes?: number;
  dailyMinutes?: number;
  dailyLimit?: number;
  primeTimeHour?: number;
  streak_count?: number;
  streakCount?: number;
  hasPracticedToday?: boolean;
  total_talk_seconds?: number;
  remindersEnabled?: boolean;
  reminders_enabled?: boolean;
  created_at?: string;
}

export interface Session {
  id: string | number;
  user1_id?: number;
  user2_id?: number;
  partner?: {
    id: string | number;
    display_name?: string;
    displayName?: string;
    avatar_url?: string;
    avatarUrl?: string;
    level?: number;
    learning_lang?: string;
  };
  partnerName?: string;
  partnerAvatarUrl?: string;
  partnerLevel?: number;
  isAi?: boolean;
  livekit_token?: string;
  livekit_room?: string;
  duration_seconds?: number;
  status?: string;
  started_at?: string;
  startedAt?: string;
  ended_at?: string;
  endedAt?: string;
}

export interface Message {
  id: string;
  sender_id: string;
  senderId?: string;
  content: string;
  sent_at: string;
  sentAt?: string;
  is_own?: boolean;
  isOwn?: boolean;
}

export interface SavedQuestion {
  id: string;
  question: string;
  part: number;
  topicId?: string;
  topicTitle?: string;
  index?: number;
  text?: string;
  savedAt: string;
}

export interface IeltsCriterion {
  band: string;
  comment: string;
}

export interface IeltsFeedback {
  overall: string;
  fluency: IeltsCriterion;
  lexical: IeltsCriterion;
  grammar: IeltsCriterion;
  pronunciation: IeltsCriterion;
  partNotes: {
    part1: string;
    part2: string;
    part3: string;
  };
  fixes: Array<{
    said: string;
    better: string;
    why: string;
  }>;
  advice: string;
}

export interface IeltsTestStatus {
  active: boolean;
  free_trials_left: number;
  premium_daily_left: number;
  can_start: boolean;
  reason?: string;
}

export interface AppReview {
  id: number;
  rating: number;
  comment?: string;
  display_name?: string;
  username?: string;
  created_at: string;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe?: any;
        colorScheme?: 'light' | 'dark';
        ready: () => void;
        expand: () => void;
        close: () => void;
        onEvent?: (eventType: string, callback: (...args: any[]) => void) => void;
        offEvent?: (eventType: string, callback: (...args: any[]) => void) => void;
        showAlert?: (message: string, callback?: () => void) => void;
        showConfirm?: (message: string, callback?: (ok: boolean) => void) => void;
        BackButton?: {
          show: () => void;
          hide: () => void;
          onClick: (cb: () => void) => void;
          offClick: (cb: () => void) => void;
        };
        MainButton: {
          text: string;
          show: () => void;
          hide: () => void;
          onClick: (cb: () => void) => void;
        };
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
        openTelegramLink: (url: string) => void;
        openInvoice?: (url: string, callback?: (status: string) => void) => void;
      };
    };
  }
}
