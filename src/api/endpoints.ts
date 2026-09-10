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

/**
 * Starting a test can wait on a freshly written paper, which the server bounds but
 * cannot make instant. The client's 25s default cut that off mid-flight and reported
 * a failure for a test that had in fact been created.
 */
export const startIeltsTest = (data: Record<string, any>) =>
  api.post('/ielts/tests', data, { timeout: 60_000 }).then((r) => r.data);

export const getIeltsTest = (id: string | number, timeout?: number) =>
  api.get(`/ielts/tests/${id}`, timeout ? { timeout } : undefined).then((r) => r.data);

/**
 * Upload time plus the server's own budget for the follow-up question. The floor
 * matters: a short answer used to get a 20s allowance for work the server is allowed
 * to spend six seconds on top of the upload, so a slow connection failed an answer
 * that would have landed.
 *
 * The per-kilobyte allowance assumes a weak mobile uplink rather than a good one —
 * 80ms/KB works out to 100 kbps, which is optimistic for two bars of LTE, and the old
 * 90s ceiling cut off Part 2 answers that were still in flight. Giving up early is the
 * expensive mistake here: the server writes the answer as soon as the upload lands, so
 * waiting longer costs a slower failure while quitting early costs the answer.
 */
export const answerTimeout = (bytes: number) =>
  Math.min(45_000 + Math.ceil(bytes / 1024) * 120, 120_000);

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
export const getAiStatus = () => api.get('/ai-partner/status').then((r) => r.data);

export const sendAIPartnerTurn = (payload: {
  text?: string;
  topic?: string | null;
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

/**
 * `role: 'examiner'` makes the server speak in the mock examiner's own voice, matched
 * to the gender it introduces itself with. Omitted, it uses the AI partner's voice.
 */
export const getTTSAudio = (text: string, role?: 'examiner') =>
  api.post('/ai-partner/tts', { text, role }).then((r) => r.data);

// ─── AI partner: saved conversations ───────────────────────────────────────
export interface AiConversationSummary {
  id: string;
  title: string | null;
  topic: string | null;
  lastMessageAt: string;
  createdAt: string;
  preview?: string | null;
}

export interface AiStoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isVoice: boolean;
  createdAt: string;
}

export const listAiConversations = (): Promise<{ ok: boolean; conversations: AiConversationSummary[] }> =>
  api.get('/ai-partner/conversations').then((r) => r.data);

export const createAiConversation = (
  topic?: string | null
): Promise<{ ok: boolean; conversation: AiConversationSummary }> =>
  api.post('/ai-partner/conversations', { topic }).then((r) => r.data);

export const getAiConversation = (
  id: string
): Promise<{ ok: boolean; conversation: AiConversationSummary & { messages: AiStoredMessage[] } }> =>
  api.get(`/ai-partner/conversations/${id}`).then((r) => r.data);

export const deleteAiConversation = (id: string) =>
  api.delete(`/ai-partner/conversations/${id}`).then((r) => r.data);

export const renameAiConversation = (id: string, title: string) =>
  api.patch(`/ai-partner/conversations/${id}`, { title }).then((r) => r.data);

/**
 * Speech to text on its own, so voice mode can show what the user said while the reply
 * is still being generated. The reply itself comes from streamAiTurn in api/aiStream.
 */
export const transcribeAiAudio = (payload: {
  audioBase64: string;
  audioMimeType?: string;
}): Promise<{
  ok: boolean;
  text: string;
  wordsPerMinute: number;
  longPauses: number;
  clarity: number | null;
}> => api.post('/ai-partner/transcribe', payload, { timeout: 60_000 }).then((r) => r.data);

export const recordAiPartnerSession = (payload: {
  durationSeconds: number;
  /** Sent so the server can write the recap the next session reads back. */
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Per-turn words-per-minute, averaged server-side for the end screen. */
  wpmSamples?: number[];
}) => api.post('/ai-partner/session-end', payload).then((r) => r.data);

// CEFR Multilevel Mock Examiner Endpoints
export const getCefrStatus = () =>
  api.get('/cefr/status').then((r) => r.data);

/** Same reasoning as startIeltsTest: the paper may still be being written. */
export const createCefrTest = (mode: 'full' | 'quick' = 'full') =>
  api.post('/cefr/tests', { mode }, { timeout: 60_000 }).then((r) => r.data);

export const getCefrTest = (id: string, timeout?: number) =>
  api.get(`/cefr/tests/${id}`, timeout ? { timeout } : undefined).then((r) => r.data);

/**
 * Always posts a body with an audio content-type, even when there is no recording.
 *
 * A step with nothing to record — the intro, the part framings, a skipped question —
 * used to send a `null` body, which fell through to the client's default
 * `application/json` header. The server's global express.json() then rejected the bare
 * `null` in strict mode, so the very first step of every test failed with
 * "Unexpected token 'n'". An empty Blob routes to express.raw() the way IELTS does.
 */
export const sendCefrAnswer = (id: string, step: number, durationMs: number, audioBlob: Blob | null) =>
  api.post(`/cefr/tests/${id}/answers?step=${step}&ms=${durationMs}`, audioBlob ?? new Blob([]), {
    headers: { 'Content-Type': audioBlob?.type || 'audio/webm' },
    // A Part 2 answer runs to two minutes, which is a large upload on a phone. The
    // 25s default cut those off and reported a failure for an answer still in flight.
    timeout: answerTimeout(audioBlob?.size ?? 0),
  }).then((r) => r.data);

/**
 * Marking is a transcription catch-up plus a long model call. On the 25s default this
 * request could not succeed on a full test — it timed out every time, while the server
 * quietly finished and stored the result nobody was still waiting for.
 */
export const finishCefrTest = (id: string, timeout = 180_000) =>
  api.post(`/cefr/tests/${id}/finish`, {}, { timeout }).then((r) => r.data);

export const abandonCefrTest = (id: string) =>
  api.post(`/cefr/tests/${id}/abandon`).then((r) => r.data);

// ─── Partner & Mentor Listings ──────────────────────────────────────────────
export const getListings = (params: {
  type?: string;
  search?: string;
  level?: string;
  gender?: string;
  page?: number;
  limit?: number;
}) =>
  api
    .get('/listings', {
      params: {
        type: params.type || 'all',
        search: params.search || undefined,
        level: params.level || undefined,
        gender: params.gender || undefined,
        page: params.page || 1,
        limit: params.limit || 20,
      },
    })
    .then((r) => r.data);

export const getMyListings = () => api.get('/listings/my').then((r) => r.data);

export const getListing = (id: string) => api.get(`/listings/${id}`).then((r) => r.data);

export const createListing = (data: {
  type: 'partner' | 'teacher' | 'student';
  title: string;
  description: string;
  targetLevel?: string;
  genderPreference?: string;
  contactInfo: string;
}) => api.post('/listings', data).then((r) => r.data);

export const updateListing = (
  id: string,
  data: {
    type?: string;
    title?: string;
    description?: string;
    targetLevel?: string;
    genderPreference?: string;
    contactInfo?: string;
    isActive?: boolean;
  }
) => api.patch(`/listings/${id}`, data).then((r) => r.data);

export const toggleActiveListing = (id: string) =>
  api.patch(`/listings/${id}/toggle-active`).then((r) => r.data);

export const deleteListing = (id: string) =>
  api.delete(`/listings/${id}`).then((r) => r.data);

/** One call for a whole screenful of cards — see useListingViews in pages/Listings.tsx. */
export const recordListingViews = (ids: string[]) =>
  api.post('/listings/views', { ids }).then((r) => r.data);


