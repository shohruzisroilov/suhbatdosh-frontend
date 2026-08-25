import api from './client';

// ─── Auth ─────────────────────────────────────────────────────────────────
export const authTelegram = (initData: string, startParam?: string | null) =>
  api.post('/auth/telegram', { initData, startParam: startParam || undefined }).then((r) => r.data);

// ─── User ─────────────────────────────────────────────────────────────────
export const getMe = () => api.get('/me').then((r) => r.data);

export const updateMe = (data: Record<string, any>) => api.put('/me', data).then((r) => r.data);

export const updateNotifications = (prefs: Record<string, any>) =>
  api.put('/me/notifications', prefs).then((r) => r.data);

export const getMyRatings = () => api.get('/me/ratings').then((r) => r.data);

// ─── Stats ────────────────────────────────────────────────────────────────────
export const getActivity = (range = 'week') =>
  api.get(`/stats/activity?range=${range}`).then((r) => r.data);

// ─── Invite / Referral ──────────────────────────────────────────────────────
export const getInvite = () => api.get('/invite').then((r) => r.data);

// ─── Payments (Telegram Stars) ───────────────────────────────────────────────
export const getPremiumPlans = () => api.get('/payments/plans').then((r) => r.data);
export const createStarsInvoice = (plan: string) =>
  api.post('/payments/stars/invoice', { plan }).then((r) => r.data);

// ─── Leaderboard ────────────────────────────────────────────────────────────
export const getLeaderboard = (scope = 'all') =>
  api.get(`/leaderboard${scope && scope !== 'all' ? `?scope=${scope}` : ''}`).then((r) => r.data);

// ─── Session ──────────────────────────────────────────────────────────────
export const getSession = (id: string | number) => api.get(`/session/${id}`).then((r) => r.data);

export const endSession = (id: string | number) => api.post(`/session/${id}/end`).then((r) => r.data);

export const rateSession = (id: string | number, score: number) =>
  api.post(`/session/${id}/rate`, { score }).then((r) => r.data);

export const reportSession = (id: string | number, reason: string) =>
  api.post(`/session/${id}/report`, { reason }).then((r) => r.data);

export const blockSession = (id: string | number) =>
  api.post(`/session/${id}/block`).then((r) => r.data);

// ─── IELTS Speaking mock ────────────────────────────────────────────────────
export const getIeltsStatus = () => api.get('/ielts/status').then((r) => r.data);

export const startIeltsTest = (data: Record<string, any>) =>
  api.post('/ielts/tests', data).then((r) => r.data);

export const getIeltsTest = (id: string | number) =>
  api.get(`/ielts/tests/${id}`).then((r) => r.data);

export const answerTimeout = (bytes: number) =>
  Math.min(20_000 + Math.ceil(bytes / 1024) * 80, 60_000);

export const sendIeltsAnswer = (
  id: string | number,
  step: number,
  blob: Blob | null,
  ms: number,
  timeout?: number
) =>
  api
    .post(`/ielts/tests/${id}/answers`, blob ?? new Blob([]), {
      params: { step, ms },
      headers: { 'Content-Type': blob?.type || 'audio/webm' },
      timeout: timeout ?? answerTimeout(blob?.size ?? 0),
    })
    .then((r) => r.data);

export const finishIeltsTest = (id: string | number, timeout = 180_000) =>
  api.post(`/ielts/tests/${id}/finish`, {}, { timeout }).then((r) => r.data);

export const abandonIeltsTest = (id: string | number) =>
  api.post(`/ielts/tests/${id}/abandon`).then((r) => r.data);

// ─── App Reviews ───────────────────────────────────────────────────────────
export const getReviews = (page = 1, limit = 10) =>
  api.get(`/reviews?page=${page}&limit=${limit}`).then((r) => r.data);
export const getMyReview = () => api.get('/reviews/me').then((r) => r.data);
export const submitReview = (rating: number, comment: string) =>
  api.post('/reviews', { rating, comment }).then((r) => r.data);

// ─── AI Speaking Partner ───────────────────────────────────────────────────
export const sendAIPartnerTurn = (payload: {
  text?: string;
  audioBase64?: string;
  audioMimeType?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  userLevel?: string;
}) => api.post('/ai-partner/chat', payload).then((r) => r.data);

export const saveVocabularyItem = (payload: {
  word: string;
  meaning?: string;
  example?: string;
  category?: string;
}) => api.post('/ai-partner/vocabulary', payload).then((r) => r.data);

export const getVocabularyItems = () =>
  api.get('/ai-partner/vocabulary').then((r) => r.data);

export const deleteVocabularyItem = (id: number) =>
  api.delete(`/ai-partner/vocabulary/${id}`).then((r) => r.data);

export const getTTSAudio = (text: string) =>
  api.post('/ai-partner/tts', { text }).then((r) => r.data);
