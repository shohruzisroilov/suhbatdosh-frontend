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

// ─── App Reviews ───────────────────────────────────────────────────────────
export const getReviews = (page = 1, limit = 10) =>
  api.get(`/reviews?page=${page}&limit=${limit}`).then((r) => r.data);
export const getMyReview = () => api.get('/reviews/me').then((r) => r.data);
export const submitReview = (rating: number, comment: string) =>
  api.post('/reviews', { rating, comment }).then((r) => r.data);

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


