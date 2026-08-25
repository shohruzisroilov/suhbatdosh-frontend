import { create } from 'zustand';
import { User, Session } from '../types';

const SAVED_KEY = 'suhbatdosh.savedQuestions';
const savedKey = (it: any) => `${it.part}:${it.topicId}:${it.index ?? 0}`;

function loadSaved() {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function persistSaved(arr: any[]) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(arr));
  } catch {}
}

export interface AppState {
  token: string | null;
  user: User | null;
  isAuthLoading: boolean;
  setToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
  setAuthLoading: (loading: boolean) => void;
  updateUser: (updates: Partial<User>) => void;

  screen: string;
  screenParams: Record<string, any>;
  navigate: (screen: string, params?: Record<string, any>) => void;

  isConnected: boolean;
  setConnected: (connected: boolean) => void;
  appError: string | null;
  setAppError: (error: string | null) => void;

  stats: { total_sessions: number; total_minutes: number; avg_rating: string; streakCount?: number; streak_count?: number; hasPracticedToday?: boolean; has_practiced_today?: boolean };
  recentSessions: any[];
  homeLoaded: boolean;
  setStats: (stats: any) => void;
  setRecentSessions: (sessions: any[]) => void;
  setHomeLoaded: (loaded: boolean) => void;

  leaderboardCache: Record<string, any>;
  setLeaderboardScope: (scope: string, data: any) => void;

  invite: any;
  setInvite: (invite: any) => void;

  reviewsData: any;
  setReviewsData: (data: any) => void;

  ieltsStatus: any;
  setIeltsStatus: (status: any) => void;

  matchingStatus: string;
  setMatchingStatus: (status: string) => void;
  waitingCount: number;
  setWaitingCount: (count: number) => void;
  partnerPref: string;
  setPartnerPref: (pref: string) => void;
  noPartnerYet: boolean;
  setNoPartnerYet: (val: boolean) => void;

  session: Session | null;
  messages: any[];
  isPartnerTyping: boolean;
  partnerConnected: boolean;
  isCallActive: boolean;
  livekitToken: string | null;
  livekitUrl: string | null;

  speakingTopicId: string;
  speakingPart: number;
  speakingQuestionIndex: number;
  savedQuestions: any[];
  toggleSavedQuestion: (item: any) => void;

  setSession: (session: Session | null) => void;
  setMessages: (messages: any[]) => void;
  addMessage: (msg: any) => void;
  setPartnerTyping: (typing: boolean) => void;
  setPartnerConnected: (connected: boolean) => void;
  setCallActive: (active: boolean) => void;
  setLivekitCredentials: (token: string | null, url: string | null) => void;
  setSpeakingState: (topicId: string, part: number, index: number) => void;
  clearSession: () => void;
}

const useAppStore = create<AppState>((set) => ({
  token: null,
  user: null,
  isAuthLoading: true,

  setToken: (token) => set({ token }),
  setUser: (user) => set({ user }),
  setAuthLoading: (isAuthLoading) => set({ isAuthLoading }),
  updateUser: (updates) =>
    set((state) => ({ user: state.user ? { ...state.user, ...updates } : null })),

  screen: 'onboarding',
  screenParams: {},
  navigate: (screen, params = {}) => set({ screen, screenParams: params }),

  isConnected: true,
  setConnected: (isConnected) => set({ isConnected }),
  appError: null,
  setAppError: (appError) => set({ appError }),

  stats: { total_sessions: 0, total_minutes: 0, avg_rating: '0.0' },
  recentSessions: [],
  homeLoaded: false,
  setStats: (stats) => set({ stats }),
  setRecentSessions: (recentSessions) => set({ recentSessions }),
  setHomeLoaded: (homeLoaded) => set({ homeLoaded }),

  leaderboardCache: {},
  setLeaderboardScope: (scope, data) =>
    set((s) => ({ leaderboardCache: { ...s.leaderboardCache, [scope]: data } })),

  invite: null,
  setInvite: (invite) => set({ invite }),

  reviewsData: null,
  setReviewsData: (reviewsData) => set({ reviewsData }),

  ieltsStatus: null,
  setIeltsStatus: (ieltsStatus) => set({ ieltsStatus }),

  matchingStatus: 'idle',
  setMatchingStatus: (matchingStatus) => set({ matchingStatus }),
  waitingCount: 0,
  setWaitingCount: (waitingCount) => set({ waitingCount }),
  partnerPref: 'any',
  setPartnerPref: (partnerPref) => set({ partnerPref }),
  noPartnerYet: false,
  setNoPartnerYet: (noPartnerYet) => set({ noPartnerYet }),

  session: null,
  messages: [],
  isPartnerTyping: false,
  partnerConnected: false,
  isCallActive: false,
  livekitToken: null,
  livekitUrl: null,

  speakingTopicId: 'hometown',
  speakingPart: 1,
  speakingQuestionIndex: 0,

  savedQuestions: loadSaved(),
  toggleSavedQuestion: (item) =>
    set((state) => {
      const key = savedKey(item);
      const exists = state.savedQuestions.some((s) => savedKey(s) === key);
      const next = exists
        ? state.savedQuestions.filter((s) => savedKey(s) !== key)
        : [...state.savedQuestions, item];
      persistSaved(next);
      return { savedQuestions: next };
    }),

  setSession: (session) => set({ session }),
  setMessages: (messages) => set({ messages }),
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  setPartnerTyping: (isPartnerTyping) => set({ isPartnerTyping }),
  setPartnerConnected: (partnerConnected) => set({ partnerConnected }),
  setCallActive: (isCallActive) => set({ isCallActive }),
  setLivekitCredentials: (livekitToken, livekitUrl) => set({ livekitToken, livekitUrl }),
  setSpeakingState: (topicId, part, index) =>
    set({
      speakingTopicId: topicId,
      speakingPart: part,
      speakingQuestionIndex: index,
    }),

  clearSession: () =>
    set({
      session: null,
      messages: [],
      isPartnerTyping: false,
      partnerConnected: false,
      isCallActive: false,
      livekitToken: null,
      livekitUrl: null,
      speakingTopicId: 'hometown',
      speakingPart: 1,
      speakingQuestionIndex: 0,
    }),
}));

export default useAppStore;
