import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Users,
  GraduationCap,
  BookOpen,
  Plus,
  Search,
  Eye,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  PauseCircle,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Edit,
  Sparkles,
  ShieldCheck,
  SlidersHorizontal,
  UserCircle,
  ArrowLeft,
  X,
} from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';
import { useT } from '../i18n';
import { tapHaptic, selectionHaptic } from '../utils/haptics';
import {
  getListings,
  getMyListings,
  createListing,
  updateListing,
  toggleActiveListing,
  deleteListing,
  recordListingViews,
} from '../api/endpoints';

/** App passes `navigate` to every screen; this one is reached and left by the tab bar. */
interface ListingsProps {
  navigate?: (screen: string, params?: Record<string, any>) => void;
}

type TabKey = 'all' | 'partner' | 'teacher' | 'student' | 'my';
type ListingType = 'partner' | 'teacher' | 'student';

const PAGE_SIZE = 20;

/** Shared by the filter and the form, so a level a poster picks is a level a reader can filter by. */
const LEVELS = [
  'Beginner (A1-A2)',
  'Intermediate (B1-B2)',
  'Advanced (C1-C2)',
  'IELTS 6.0+',
  'IELTS 7.0+',
] as const;

const TYPE_ICON: Record<ListingType, React.ReactNode> = {
  partner: <Users size={12} />,
  teacher: <GraduationCap size={12} />,
  student: <BookOpen size={12} />,
};

/**
 * Counts a listing as seen once it has really been on screen.
 *
 * The number under each card is the one thing that tells an author whether posting was
 * worth it, so it has to mean something. Counting a fetch would have counted the whole
 * page every time anyone scrolled past, so a card counts when half of it has been
 * visible, once per session, and the ids go up in one batched call rather than one
 * request per card. The server drops the author's own views.
 */
function useListingViews(ids: string[], enabled: boolean) {
  const counted = useRef<Set<string>>(new Set());
  const pending = useRef<Set<string>>(new Set());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observer = useRef<IntersectionObserver | null>(null);

  const flush = useCallback(() => {
    flushTimer.current = null;
    const batch = Array.from(pending.current);
    pending.current.clear();
    if (batch.length === 0) return;
    // A view that never reaches the server is simply not counted — nothing the reader
    // is doing depends on it, so a failure stays silent.
    recordListingViews(batch).catch(() => {});
  }, []);

  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === 'undefined') return;

    observer.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = (entry.target as HTMLElement).dataset.listingId;
          if (!id || counted.current.has(id)) continue;
          counted.current.add(id);
          pending.current.add(id);
          observer.current?.unobserve(entry.target);
        }
        // Wide enough that even continuous scrolling stays well under the write
        // limiter, short enough that a count appears while the reader is still there.
        if (pending.current.size > 0 && flushTimer.current === null) {
          flushTimer.current = setTimeout(flush, 3000);
        }
      },
      { threshold: 0.5 }
    );

    return () => {
      observer.current?.disconnect();
      observer.current = null;
      if (flushTimer.current !== null) clearTimeout(flushTimer.current);
      // Send whatever was seen just before leaving, so the last screenful still counts.
      flush();
    };
  }, [enabled, flush]);

  // `enabled` belongs in the deps as much as the ids do: leaving the feed disconnects
  // the observer, and coming back builds a new one that has nothing attached to it yet.
  const key = ids.join(',');
  useEffect(() => {
    const obs = observer.current;
    if (!obs) return;
    document.querySelectorAll('[data-listing-id]').forEach((node) => {
      const id = (node as HTMLElement).dataset.listingId;
      if (id && !counted.current.has(id)) obs.observe(node);
    });
  }, [key, enabled]);
}

export default function Listings(_props: ListingsProps) {
  const { user } = useAppStore();
  const t = useT();

  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [search, setSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [listings, setListings] = useState<any[]>([]);
  const [myListings, setMyListings] = useState<any[]>([]);
  const [maxOpen, setMaxOpen] = useState(3);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [myLoading, setMyLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Create / Edit modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  const [formType, setFormType] = useState<ListingType>('partner');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTargetLevel, setFormTargetLevel] = useState<string>(LEVELS[1]);
  const [formGender, setFormGender] = useState('any');
  const [formContact, setFormContact] = useState(user?.username ? `@${user.username}` : '');

  const [submitting, setSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isMine = activeTab === 'my';
  const filtersActive = levelFilter !== 'all' || genderFilter !== 'all';
  const displayedListings = isMine ? myListings : listings;
  const isCurrentLoading = isMine ? myLoading : loading;

  // Only what a moderator has not settled yet counts against the cap, which is the same
  // rule the server enforces — a rejected post should not block the next attempt.
  const openCount = useMemo(
    () => myListings.filter((item) => item.status === 'pending' || item.status === 'approved').length,
    [myListings]
  );
  const atLimit = openCount >= maxOpen;

  const pendingCount = useMemo(
    () => myListings.filter((item) => item.status === 'pending').length,
    [myListings]
  );

  useTelegramBackButton(() => {
    if (isModalOpen) {
      tapHaptic('light');
      setIsModalOpen(false);
    }
  });

  useListingViews(
    listings.map((item) => item.id),
    !isMine
  );

  const fetchFeed = useCallback(
    async (nextPage: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setLoadError(false);
      try {
        const data = await getListings({
          type: activeTab === 'all' ? undefined : activeTab,
          search: searchTerm || undefined,
          level: levelFilter === 'all' ? undefined : levelFilter,
          gender: genderFilter === 'all' ? undefined : genderFilter,
          page: nextPage,
          limit: PAGE_SIZE,
        });
        const rows = data.listings || [];
        setListings((prev) => (append ? [...prev, ...rows] : rows));
        setPage(nextPage);
        setTotalPages(data.totalPages || 1);
      } catch (err) {
        console.error('Failed to fetch listings feed:', err);
        if (!append) setListings([]);
        setLoadError(true);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeTab, searchTerm, levelFilter, genderFilter]
  );

  const fetchMyListings = useCallback(async () => {
    setMyLoading(true);
    setLoadError(false);
    try {
      const data = await getMyListings();
      setMyListings(data.listings || []);
      if (typeof data.maxOpen === 'number') setMaxOpen(data.maxOpen);
    } catch (err) {
      console.error('Failed to fetch my listings:', err);
      setLoadError(true);
    } finally {
      setMyLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isMine) fetchMyListings();
    else fetchFeed(1, false);
  }, [isMine, fetchFeed, fetchMyListings]);

  // "Mine" is loaded up front as well: the cap and the pending badge are decided by it,
  // and both are shown on tabs the user may never leave.
  useEffect(() => {
    fetchMyListings();
  }, [fetchMyListings]);

  // The search box had no visible submit, so a query only ran if the user guessed to
  // press Enter. It now runs as they type, held back long enough not to fire a request
  // per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  function showToast(type: 'success' | 'error', text: string) {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  }

  function openCreateModal() {
    if (atLimit) {
      showToast('error', t('listings.limitReached', { n: maxOpen }));
      return;
    }
    tapHaptic('medium');
    setEditingItem(null);
    setFormType('partner');
    setFormTitle('');
    setFormDescription('');
    setFormTargetLevel(LEVELS[1]);
    setFormGender('any');
    setFormContact(user?.username ? `@${user.username}` : '');
    setIsModalOpen(true);
  }

  function openEditModal(item: any) {
    tapHaptic('medium');
    setEditingItem(item);
    setFormType(item.type);
    setFormTitle(item.title);
    setFormDescription(item.description);
    setFormTargetLevel(item.targetLevel || LEVELS[1]);
    setFormGender(item.genderPreference || 'any');
    setFormContact(item.contactInfo);
    setIsModalOpen(true);
  }

  useEffect(() => {
    if (user?.username && !formContact) {
      setFormContact(`@${user.username}`);
    }
  }, [user?.username]);

  async function handleSubmitModal(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const trimmedTitle = formTitle.trim();
    const trimmedDesc = formDescription.trim();
    const trimmedContact = formContact.trim();

    if (trimmedTitle.length < 3) {
      showToast('error', t('listings.err.title'));
      return;
    }
    if (trimmedDesc.length < 10) {
      showToast('error', t('listings.err.description', { n: trimmedDesc.length }));
      return;
    }
    if (!trimmedContact) {
      showToast('error', t('listings.err.contact'));
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        type: formType,
        title: trimmedTitle,
        description: trimmedDesc,
        targetLevel: formTargetLevel,
        genderPreference: formGender,
        contactInfo: trimmedContact,
      };

      if (editingItem) {
        const res = await updateListing(editingItem.id, payload);
        showToast('success', res?.message || t('listings.ok.updated'));
      } else {
        await createListing(payload);
        showToast('success', t('listings.ok.created'));
      }
      setIsModalOpen(false);
      setActiveTab('my');
      fetchMyListings();
    } catch (err: any) {
      console.error('Submit error:', err);
      // The server owns the rules, so its wording is what the user sees when it speaks.
      showToast('error', err?.response?.data?.error || t('listings.err.generic'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(id: string) {
    tapHaptic('light');
    try {
      await toggleActiveListing(id);
      fetchMyListings();
      showToast('success', t('listings.ok.toggled'));
    } catch (err: any) {
      showToast('error', err?.response?.data?.error || t('listings.err.toggle'));
    }
  }

  async function handleDeleteListing(id: string) {
    if (!window.confirm(t('listings.confirmDelete'))) return;
    tapHaptic('medium');
    try {
      await deleteListing(id);
      fetchMyListings();
      showToast('success', t('listings.ok.deleted'));
    } catch (err: any) {
      showToast('error', err?.response?.data?.error || t('listings.err.delete'));
    }
  }

  /**
   * Contacts are stored as a normalized @handle, so the link is built rather than
   * followed: whatever a listing carries, the app can only ever open t.me.
   */
  function openTelegramContact(contact: string) {
    tapHaptic('medium');
    const handle = String(contact || '').trim().replace(/^@+/, '');
    // Listings created before the contact field was constrained can still hold
    // something unopenable. Saying so beats a button that does nothing.
    if (!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(handle)) {
      showToast('error', t('listings.err.badContact'));
      return;
    }

    const url = `https://t.me/${handle}`;
    const tg = window.Telegram?.WebApp;
    if (tg?.openTelegramLink) tg.openTelegramLink(url);
    else window.open(url, '_blank', 'noopener,noreferrer');
  }

  const renderBadge = (type: string) => {
    if (!(type in TYPE_ICON)) return null;
    return (
      <span className={`listing-tag listing-tag--${type}`}>
        {TYPE_ICON[type as ListingType]} {t(`listings.type.${type}`)}
      </span>
    );
  };

  const renderStatusBadge = (status: string, isActive: boolean) => {
    // A paused listing is off the feed whatever the moderator decided, so that is what
    // its owner is told first.
    if (!isActive) {
      return (
        <span className="status-badge status-badge--inactive">
          <PauseCircle size={11} /> {t('listings.status.paused')}
        </span>
      );
    }
    switch (status) {
      case 'pending':
        return (
          <span className="status-badge status-badge--pending">
            <Clock size={11} /> {t('listings.status.pending')}
          </span>
        );
      case 'approved':
        return (
          <span className="status-badge status-badge--approved">
            <CheckCircle2 size={11} /> {t('listings.status.approved')}
          </span>
        );
      case 'rejected':
        return (
          <span className="status-badge status-badge--rejected">
            <XCircle size={11} /> {t('listings.status.rejected')}
          </span>
        );
      default:
        return null;
    }
  };

  const TABS: Array<{ key: TabKey; label: string }> = [
    { key: 'all', label: t('listings.tab.all') },
    { key: 'partner', label: t('listings.tab.partner') },
    { key: 'teacher', label: t('listings.tab.teacher') },
    { key: 'student', label: t('listings.tab.student') },
  ];

  return (
    <div className={isModalOpen ? "listings-form-page" : "listings-page"}>
      {/* Toast Notification */}
      {toastMsg && (
        <div className={`listings-toast listings-toast--${toastMsg.type}`} role="status">
          <AlertCircle size={16} />
          <span>{toastMsg.text}</span>
        </div>
      )}

      {isModalOpen ? (
        <>
          {/* Full-Page Form Header */}
          <div className="listings-form-page__topbar">
            <button
              type="button"
              className="listings-form-page__back-btn"
              onClick={() => {
                tapHaptic('light');
                setIsModalOpen(false);
              }}
              aria-label={t('listings.form.cancel')}
            >
              <ArrowLeft size={20} />
            </button>
            <h2 className="listings-form-page__title">
              {editingItem ? t('listings.form.editTitle') : t('listings.form.newTitle')}
            </h2>
            <div style={{ width: 40 }} />
          </div>

          {/* Full-Page Scrollable Form Body */}
          <form onSubmit={handleSubmitModal} className="listings-form-page__body">
            {/* Type Selection */}
            <div className="form-group">
              <label className="form-label">{t('listings.form.type')}</label>
              <div className="type-selector">
                {(['partner', 'teacher', 'student'] as ListingType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`type-btn ${formType === type ? 'active' : ''}`}
                    aria-pressed={formType === type}
                    onClick={() => { selectionHaptic(); setFormType(type); }}
                  >
                    {type === 'partner' && <Users size={18} />}
                    {type === 'teacher' && <GraduationCap size={18} />}
                    {type === 'student' && <BookOpen size={18} />}
                    <span>
                      {type === 'partner' && t('listings.form.typePartner')}
                      {type === 'teacher' && t('listings.form.typeTeacher')}
                      {type === 'student' && t('listings.form.typeStudent')}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Title Input */}
            <div className="form-group">
              <label className="form-label" htmlFor="listing-title">{t('listings.form.title')}</label>
              <input
                id="listing-title"
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder={t('listings.form.titlePlaceholder')}
                minLength={3}
                maxLength={120}
                className="form-input"
                required
              />
            </div>

            {/* Description Input */}
            <div className="form-group">
              <div className="form-label-row">
                <label className="form-label" htmlFor="listing-desc">{t('listings.form.description')}</label>
                <span className={`form-counter ${formDescription.trim().length < 10 ? 'short' : ''}`}>
                  {formDescription.trim().length < 10
                    ? t('listings.form.charsLeft', { n: 10 - formDescription.trim().length })
                    : `${formDescription.length}/2000`}
                </span>
              </div>
              <textarea
                id="listing-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder={t('listings.form.descriptionPlaceholder')}
                minLength={10}
                maxLength={2000}
                rows={4}
                className="form-textarea"
                required
              />
            </div>

            {/* Requirements row */}
            <div className="form-row">
              <div className="form-group flex-1">
                <label className="form-label" htmlFor="listing-level">{t('listings.form.level')}</label>
                <select
                  id="listing-level"
                  value={formTargetLevel}
                  onChange={(e) => setFormTargetLevel(e.target.value)}
                  className="form-select"
                >
                  {LEVELS.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                  <option value="Any level">{t('listings.form.levelAny')}</option>
                </select>
              </div>

              <div className="form-group flex-1">
                <label className="form-label" htmlFor="listing-gender">{t('listings.form.gender')}</label>
                <select
                  id="listing-gender"
                  value={formGender}
                  onChange={(e) => setFormGender(e.target.value)}
                  className="form-select"
                >
                  <option value="any">{t('listings.form.genderAny')}</option>
                  <option value="male">{t('listings.form.genderMale')}</option>
                  <option value="female">{t('listings.form.genderFemale')}</option>
                </select>
              </div>
            </div>

            {/* Contact Info */}
            <div className="form-group">
              <label className="form-label" htmlFor="listing-contact">{t('listings.form.contact')}</label>
              <input
                id="listing-contact"
                type="text"
                value={formContact}
                onChange={(e) => setFormContact(e.target.value)}
                placeholder={t('listings.form.contactPlaceholder')}
                className="form-input"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
              />
              <span className="form-hint">{t('listings.form.contactHint')}</span>
            </div>

            {/* Notice Box */}
            <div className="modal-notice">
              <ShieldCheck size={18} className="modal-notice__icon" />
              <span>{t('listings.form.notice')}</span>
            </div>

            {/* Submit Buttons */}
            <div className="modal-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setIsModalOpen(false)}
              >
                {t('listings.form.cancel')}
              </button>
              <button type="submit" disabled={submitting} className="btn-submit">
                {submitting
                  ? t('listings.form.sending')
                  : editingItem
                    ? t('listings.form.update')
                    : t('listings.form.submit')}
              </button>
            </div>
          </form>
        </>
      ) : (
        <>
          {/* Header */}
          <div className="listings-page__header">
        <div className="listings-page__header-top">
          <div className="listings-page__header-title-wrap">
            <h1 className="listings-page__title">{t('listings.title')}</h1>
            <p className="listings-page__sub">{t('listings.subtitle')}</p>
          </div>

          {/* "Mine" is a different mode, not another filter, so it sits with the
              actions rather than in the row of type chips. */}
          <button
            type="button"
            className={`listings-page__mine-btn ${isMine ? 'active' : ''}`}
            aria-pressed={isMine}
            aria-label={t('listings.tab.mine')}
            onClick={() => { selectionHaptic(); setActiveTab(isMine ? 'all' : 'my'); }}
          >
            <UserCircle size={18} />
            {pendingCount > 0 && <span className="listings-page__mine-dot">{pendingCount}</span>}
          </button>

          <button
            type="button"
            className="listings-page__add-btn"
            onClick={openCreateModal}
          >
            <Plus size={18} strokeWidth={2.5} />
            <span>{t('listings.new')}</span>
          </button>
        </div>

        {!isMine && (
          <div className="listings-controls">
            <div className="listings-tabs" role="tablist">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`listings-tab ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      selectionHaptic();
                      setActiveTab(tab.key);
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="listings-searchrow">
              <div className="listings-search">
                <Search size={16} className="listings-search__icon" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('listings.search')}
                  aria-label={t('listings.search')}
                  className="listings-search__input"
                />
              </div>
              {/* Level and gender are the rare case; they stay out of the way until
                  asked for, and announce themselves when one is set. */}
              <button
                type="button"
                className={`listings-filter-btn ${showFilters ? 'open' : ''}`}
                aria-expanded={showFilters}
                aria-label={t('listings.filters')}
                onClick={() => { selectionHaptic(); setShowFilters((v) => !v); }}
              >
                <SlidersHorizontal size={16} />
                {filtersActive && <span className="listings-filter-btn__dot" />}
              </button>
            </div>

            {showFilters && (
              <div className="listings-selects">
                <select
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value)}
                  className="listings-select"
                  aria-label={t('listings.form.level')}
                >
                  <option value="all">{t('listings.filter.allLevels')}</option>
                  {LEVELS.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>

                <select
                  value={genderFilter}
                  onChange={(e) => setGenderFilter(e.target.value)}
                  className="listings-select"
                  aria-label={t('listings.form.gender')}
                >
                  <option value="all">{t('listings.filter.allGenders')}</option>
                  <option value="male">{t('listings.filter.male')}</option>
                  <option value="female">{t('listings.filter.female')}</option>
                </select>

                {filtersActive && (
                  <button
                    type="button"
                    className="listings-clear-btn"
                    onClick={() => { setLevelFilter('all'); setGenderFilter('all'); }}
                  >
                    {t('listings.clearFilters')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main List Area */}
      <div className="listings-scroll">
        {isCurrentLoading ? (
          // Cards in outline while they load, so the list does not jump into place
          // from an empty screen.
          <div className="listings-grid" aria-busy="true" aria-label={t('listings.loading')}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="listing-card listing-card--skeleton">
                <div className="sk sk--row">
                  <div className="sk sk--avatar" />
                  <div className="sk sk--lines">
                    <div className="sk sk--bar" style={{ width: '40%' }} />
                    <div className="sk sk--bar sk--sm" style={{ width: '28%' }} />
                  </div>
                </div>
                <div className="sk sk--bar" style={{ width: '75%', height: 14 }} />
                <div className="sk sk--bar" style={{ width: '100%' }} />
                <div className="sk sk--bar" style={{ width: '60%' }} />
                <div className="sk sk--bar" style={{ height: 38, borderRadius: 12 }} />
              </div>
            ))}
          </div>
        ) : loadError && displayedListings.length === 0 ? (
          <div className="listings-empty">
            <div className="listings-empty__icon">
              <AlertCircle size={28} />
            </div>
            <h3>{t('listings.err.load')}</h3>
            <button
              type="button"
              className="btn-primary"
              onClick={() => (isMine ? fetchMyListings() : fetchFeed(1, false))}
            >
              {t('common.tryAgain')}
            </button>
          </div>
        ) : displayedListings.length === 0 ? (
          <div className="listings-empty">
            <div className="listings-empty__icon">
              <Sparkles size={28} />
            </div>
            <h3>{isMine ? t('listings.empty.mineTitle') : t('listings.empty.feedTitle')}</h3>
            <p>{isMine ? t('listings.empty.mineSub') : t('listings.empty.feedSub')}</p>
            {!atLimit && (
              <button type="button" className="btn-primary" onClick={openCreateModal}>
                <Plus size={18} /> {t('listings.empty.cta')}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="listings-grid">
              {displayedListings.map((item) => (
                <div key={item.id} className="listing-card" data-listing-id={isMine ? undefined : item.id}>
                  {/* Card Top: Author & Tag */}
                  <div className="listing-card__top">
                    <div className="listing-card__author">
                      <div className="listing-card__avatar-wrap">
                        {item.user?.avatarUrl ? (
                          <img src={item.user.avatarUrl} alt="" className="listing-card__avatar" />
                        ) : (
                          <div className="listing-card__avatar-placeholder" aria-hidden="true">
                            {item.user?.displayName?.charAt(0) || 'U'}
                          </div>
                        )}
                      </div>
                      <div className="listing-card__author-info">
                        <div className="listing-card__author-name-row">
                          <span className="listing-card__author-name">
                            {item.user?.displayName || (isMine ? user?.displayName : '') || 'Learner'}
                          </span>
                        </div>
                        <span className="listing-card__date">
                          {t('listings.card.level', { n: item.user?.level ?? user?.level ?? 1 })} ·{' '}
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="listing-card__tags">
                      {renderBadge(item.type)}
                    </div>
                  </div>

                  {/* For My Listings: Show Status Badge */}
                  {isMine && (
                    <div className="listing-card__status-row">
                      {renderStatusBadge(item.status, item.isActive)}
                    </div>
                  )}

                  {/* Card Title & Description */}
                  <h3 className="listing-card__title">{item.title}</h3>
                  {/* A description may run to 2000 characters. Unclamped, one long post
                      pushed every other listing off the screen. */}
                  <p className={`listing-card__desc ${expanded[item.id] ? '' : 'clamped'}`}>
                    {item.description}
                  </p>
                  {item.description.length > 160 && (
                    <button
                      type="button"
                      className="listing-card__more"
                      onClick={() => setExpanded((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                    >
                      {expanded[item.id] ? t('listings.showLess') : t('listings.showMore')}
                    </button>
                  )}

                  {/* Why a moderator turned it down — without this the author only sees
                      a red badge and has nothing to act on. */}
                  {isMine && item.status === 'rejected' && (
                    <div className="listing-card__reject-note">
                      <AlertCircle size={14} />
                      <span>
                        {item.adminNote
                          ? t('listings.rejectedReason', { note: item.adminNote })
                          : t('listings.rejectedNoReason')}
                      </span>
                    </div>
                  )}

                  {/* Target Level & Requirements */}
                  <div className="listing-card__pills">
                    {item.targetLevel && <span className="pill">🎯 {item.targetLevel}</span>}
                    {item.genderPreference && item.genderPreference !== 'any' && (
                      <span className="pill">
                        👤 {item.genderPreference === 'female'
                          ? t('listings.card.onlyWomen')
                          : t('listings.card.onlyMen')}
                      </span>
                    )}
                    <span className="pill pill--views" title={t('listings.card.views', { n: item.viewsCount || 0 })}>
                      <Eye size={12} /> {item.viewsCount || 0}
                    </span>
                  </div>

                  {/* Card Actions */}
                  <div className="listing-card__actions">
                    {!isMine ? (
                      <button
                        type="button"
                        className="btn-contact"
                        onClick={() => openTelegramContact(item.contactInfo)}
                      >
                        <Send size={15} />
                        <span>{t('listings.card.contact')}</span>
                        <span className="btn-contact__handle">{item.contactInfo}</span>
                      </button>
                    ) : (
                      <div className="my-controls">
                        <button
                          type="button"
                          className={`btn-toggle-active ${item.isActive ? 'active' : ''}`}
                          onClick={() => handleToggleActive(item.id)}
                          aria-pressed={item.isActive}
                        >
                          {item.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                          <span>{item.isActive ? t('listings.card.active') : t('listings.card.paused')}</span>
                        </button>

                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => openEditModal(item)}
                          aria-label={t('listings.card.edit')}
                          title={t('listings.card.edit')}
                        >
                          <Edit size={16} />
                        </button>

                        <button
                          type="button"
                          className="btn-icon btn-icon--danger"
                          onClick={() => handleDeleteListing(item.id)}
                          aria-label={t('listings.card.delete')}
                          title={t('listings.card.delete')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* The feed was capped at one page, so anything past the twentieth listing
                was unreachable however long the board grew. */}
            {!isMine && page < totalPages && (
              <button
                type="button"
                className="listings-load-more"
                onClick={() => fetchFeed(page + 1, true)}
                disabled={loadingMore}
              >
                {loadingMore ? <div className="spinner spinner--sm" /> : t('listings.loadMore')}
              </button>
            )}
          </>
        )}
      </div>

        </>
      )}

      <style>{`
        .listings-form-page {
          display: flex; flex-direction: column; height: 100%; overflow: hidden; background: var(--bg);
        }
        .listings-form-page__topbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: calc(var(--space-3) + env(safe-area-inset-top, 0px)) var(--space-4) var(--space-3);
          background: var(--chrome-bg-soft); backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--border); flex-shrink: 0; z-index: 10;
        }
        .listings-form-page__back-btn {
          width: 40px; height: 40px; border-radius: var(--radius-full);
          display: flex; align-items: center; justify-content: center;
          color: var(--text-primary); background: transparent; border: none;
          transition: background 0.15s ease; cursor: pointer;
        }
        .listings-form-page__back-btn:active { background: var(--surface-2); }
        .listings-form-page__title {
          font-size: var(--text-base); font-weight: var(--weight-heavy); color: var(--text-primary);
          margin: 0;
        }
        .listings-form-page__body {
          flex: 1; overflow-y: auto;
          padding: var(--space-4) var(--space-4) calc(100px + env(safe-area-inset-bottom, 0px));
          display: flex; flex-direction: column; gap: var(--space-4);
        }

        .listings-page {
          display: flex; flex-direction: column; height: 100%; overflow: hidden; background: var(--bg);
          position: relative;
        }

        .listings-toast {
          position: fixed; top: 16px; left: 16px; right: 16px; z-index: 2000;
          padding: 12px 16px; border-radius: 14px; font-size: 13px; font-weight: 600;
          display: flex; align-items: center; gap: 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.18);
          animation: slideDown 0.25s var(--ease-out);
        }
        .listings-toast--success { background: rgba(16, 185, 129, 0.95); color: #fff; }
        .listings-toast--error { background: rgba(239, 68, 68, 0.95); color: #fff; }
        @keyframes slideDown { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        /* Header */
        .listings-page__header {
          padding: var(--space-3) var(--space-4) 8px;
          background: var(--chrome-bg);
          border-bottom: 1px solid var(--border);
          backdrop-filter: blur(20px);
          display: flex; flex-direction: column; gap: 12px;
          flex-shrink: 0;
        }
        .listings-page__header-top {
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
        }
        /* Mine — the author's own board, with the count still awaiting a moderator. */
        .listings-page__mine-btn {
          position: relative; flex-shrink: 0;
          width: 38px; height: 38px; border-radius: 12px;
          border: 1px solid var(--border); background: var(--surface-2);
          color: var(--text-secondary);
          display: flex; align-items: center; justify-content: center;
          transition: all 0.18s var(--ease-out);
        }
        .listings-page__mine-btn.active {
          background: var(--btn-bg-soft); color: var(--btn-bg); border-color: var(--btn-bg);
        }
        .listings-page__mine-dot {
          position: absolute; top: -5px; right: -5px;
          min-width: 17px; height: 17px; padding: 0 4px;
          border-radius: 9px; background: var(--warning); color: #0B1220;
          font-size: 10px; font-weight: 900; line-height: 17px; text-align: center;
          border: 2px solid var(--chrome-bg);
        }
        .listings-page__header-title-wrap { flex: 1; min-width: 0; }
        .listings-page__title {
          font-size: 17px; font-weight: var(--weight-heavy); color: var(--text-primary);
          letter-spacing: -0.3px; margin: 0;
        }
        .listings-page__sub {
          font-size: 11px; color: var(--text-tertiary); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .listings-page__mine-btn {
          width: 36px; height: 36px; border-radius: var(--radius-sm);
          border: 1px solid var(--border); background: var(--surface-2);
          color: var(--text-secondary); display: flex; align-items: center; justify-content: center;
          position: relative; cursor: pointer; transition: all 0.2s var(--ease-out);
        }
        .listings-page__mine-btn.active {
          background: var(--primary-subtle); color: var(--primary); border-color: var(--primary);
        }
        .listings-page__mine-dot {
          position: absolute; top: -3px; right: -3px;
          min-width: 16px; height: 16px; border-radius: 99px;
          background: var(--primary); color: var(--primary-contrast);
          font-size: 9px; font-weight: 800; display: flex; align-items: center; justify-content: center;
          padding: 0 4px; border: 2px solid var(--bg);
        }
        .listings-page__add-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 16px; border-radius: var(--radius-md);
          background: var(--grad-primary);
          color: #FFFFFF; border: none; font-size: 13px; font-weight: var(--weight-bold);
          box-shadow: 0 4px 14px rgba(40, 120, 240, 0.25); cursor: pointer;
          transition: transform 0.15s var(--ease-out);
        }
        .listings-page__add-btn:active { transform: scale(0.96); }

        /* Tabs */
        .listings-tabs {
          display: flex; align-items: center; gap: 6px; overflow-x: auto;
          padding-bottom: 4px; scrollbar-width: none;
        }
        .listings-tabs::-webkit-scrollbar { display: none; }
        .listings-tab {
          padding: 7px 15px; border-radius: var(--radius-full);
          background: var(--bg-secondary); border: 1px solid var(--border);
          color: var(--text-secondary); font-size: 12px; font-weight: var(--weight-semi);
          white-space: nowrap; cursor: pointer; transition: all 0.2s var(--ease-out);
        }
        .listings-tab:hover {
          color: var(--primary);
        }
        .listings-tab.active {
          background: var(--primary); color: #FFFFFF; border-color: var(--primary);
          font-weight: var(--weight-bold); box-shadow: 0 2px 8px rgba(40, 120, 240, 0.25);
        }

        /* Search + filters */
        .listings-controls { display: flex; flex-direction: column; gap: 8px; }
        .listings-searchrow { display: flex; align-items: center; gap: 8px; }
        .listings-search {
          position: relative; flex: 1; min-width: 0;
        }
        .listings-filter-btn {
          position: relative; flex-shrink: 0;
          width: 36px; height: 36px; border-radius: var(--radius-sm);
          border: 1px solid var(--border); background: var(--surface-2);
          color: var(--text-secondary);
          display: flex; align-items: center; justify-content: center;
        }
        .listings-filter-btn.open { color: var(--primary); border-color: var(--primary); background: var(--primary-subtle); }
        .listings-filter-btn__dot {
          position: absolute; top: 6px; right: 6px;
          width: 7px; height: 7px; border-radius: 50%; background: var(--primary);
        }
        .listings-clear-btn {
          flex-shrink: 0; padding: 6px 12px; border-radius: var(--radius-sm);
          border: 1px solid var(--border); background: var(--surface-2);
          color: var(--text-secondary); font-size: 11px; font-weight: 700;
        }
        .listings-search__icon {
          position: absolute; left: 12px; top: 11px; color: var(--text-tertiary); pointer-events: none;
        }
        .listings-search__input {
          width: 100%; padding: 9px 12px 9px 36px; border-radius: var(--radius-md);
          border: 1px solid var(--border); background-color: var(--surface-2);
          color: var(--text-primary); font-size: 13px; outline: none;
          transition: border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
        }
        .listings-search__input:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px var(--primary-subtle);
        }
        .listings-selects { display: flex; gap: 8px; align-items: center; }
        .listings-select {
          flex: 1; min-width: 0; padding: 8px 30px 8px 10px; border-radius: var(--radius-sm);
          border: 1px solid var(--border); background-color: var(--surface-2);
          color: var(--text-primary); font-size: 12px; font-weight: 600; outline: none;
        }

        /* Scroll Area & Grid */
        .listings-scroll {
          flex: 1; overflow-y: auto;
          padding: var(--space-4) var(--space-4) calc(90px + env(safe-area-inset-bottom, 0px));
        }
        .spinner {
          width: 28px; height: 28px; border: 3px solid var(--border);
          border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .listings-empty {
          display: flex; flex-direction: column; align-items: center; text-align: center;
          padding: 48px 24px; gap: 12px; background: var(--bg-secondary);
          border: 1px dashed var(--border); border-radius: var(--radius-lg); margin-top: 16px;
        }
        .listings-empty__icon {
          width: 54px; height: 54px; border-radius: 50%;
          background: var(--primary-subtle); color: var(--primary);
          display: flex; align-items: center; justify-content: center;
        }
        .listings-empty h3 { font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0; }
        .listings-empty p { font-size: 13px; color: var(--text-tertiary); max-width: 280px; margin: 0; }
        .btn-primary {
          display: flex; align-items: center; gap: 6px; padding: 10px 20px;
          border-radius: var(--radius-md); background: var(--grad-primary); color: #fff; border: none;
          font-size: 13px; font-weight: 700; cursor: pointer; margin-top: 4px;
        }

        .listings-grid { display: flex; flex-direction: column; gap: 12px; }

        /* Card */
        .listing-card {
          background: var(--bg-secondary); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: 14px 16px;
          display: flex; flex-direction: column; gap: 10px;
          box-shadow: var(--shadow-sm);
          transition: border-color 0.2s var(--ease-out), transform 0.2s var(--ease-out);
        }
        .listing-card:hover { border-color: var(--primary); }

        .listing-card__top {
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
        }
        .listing-card__author { display: flex; align-items: center; gap: 10px; }
        .listing-card__avatar-wrap { position: relative; }
        .listing-card__avatar { width: 38px; height: 38px; border-radius: var(--radius-sm); object-fit: cover; }
        .listing-card__avatar-placeholder {
          width: 38px; height: 38px; border-radius: var(--radius-sm);
          background: var(--primary-subtle); color: var(--primary);
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 15px;
        }
        .listing-card__author-info { display: flex; flex-direction: column; gap: 2px; }
        .listing-card__author-name-row { display: flex; align-items: center; gap: 6px; }
        .listing-card__author-name { font-size: 14px; font-weight: 700; color: var(--text-primary); }
        .pro-badge {
          padding: 1px 5px; border-radius: 4px; background: rgba(245, 158, 11, 0.2);
          color: #F59E0B; font-size: 9px; font-weight: 900; letter-spacing: 0.05em;
        }
        .listing-card__date { font-size: 11px; color: var(--text-tertiary); }

        /* Tags */
        .listing-tag {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 4px 10px; border-radius: var(--radius-full); font-size: 11px; font-weight: 700;
        }
        .listing-tag--partner { background: var(--primary-subtle); color: var(--primary); border: 1px solid rgba(40, 120, 240, 0.25); }
        .listing-tag--teacher { background: rgba(168, 85, 247, 0.12); color: #8B5CF6; border: 1px solid rgba(139, 92, 246, 0.25); }
        .listing-tag--student { background: var(--soft-green); color: var(--success); border: 1px solid rgba(33, 184, 135, 0.25); }

        /* Status badge */
        .status-badge {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 8px; border-radius: var(--radius-xs); font-size: 10px; font-weight: 700;
        }
        .status-badge--pending { background: var(--soft-yellow); color: #B45309; border: 1px solid rgba(255, 200, 87, 0.35); }
        .status-badge--approved { background: var(--soft-green); color: var(--success); border: 1px solid rgba(33, 184, 135, 0.3); }
        .status-badge--rejected { background: var(--danger-bg); color: var(--danger); border: 1px solid rgba(239, 68, 68, 0.3); }
        .status-badge--inactive { background: var(--surface-2); color: var(--text-tertiary); border: 1px solid var(--border); }

        .listing-card__title { font-size: 15px; font-weight: 800; color: var(--text-primary); margin: 0; line-height: 1.35; }
        .listing-card__desc { font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin: 0; white-space: pre-line; }

        .listing-card__reject-note {
          padding: 8px 12px; border-radius: var(--radius-sm); background: var(--danger-bg);
          border: 1px solid rgba(239, 68, 68, 0.25); color: var(--danger); font-size: 11px;
          display: flex; align-items: flex-start; gap: 6px;
        }

        .listing-card__pills { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .pill {
          padding: 4px 9px; border-radius: var(--radius-sm); background: var(--bg);
          border: 1px solid var(--border); font-size: 11px; font-weight: 600; color: var(--text-secondary);
        }
        .pill--views { margin-left: auto; display: flex; align-items: center; gap: 4px; color: var(--text-tertiary); }

        /* Actions */
        .listing-card__actions { margin-top: 4px; }
        .btn-contact {
          width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 10px; border-radius: var(--radius-md);
          background: var(--grad-primary);
          color: #fff; border: none; font-size: 13px; font-weight: 700; cursor: pointer;
          box-shadow: 0 4px 14px rgba(40, 120, 240, 0.25); transition: transform 0.15s var(--ease-out);
        }
        .btn-contact:active { transform: scale(0.98); }

        .my-controls { display: flex; align-items: center; gap: 8px; width: 100%; }
        .my-controls .btn-toggle-active { margin-right: auto; }
        .btn-toggle-active {
          display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: var(--radius-sm);
          background: var(--bg); border: 1px solid var(--border); color: var(--text-tertiary);
          font-size: 11px; font-weight: 700; cursor: pointer;
        }
        .btn-toggle-active.active { background: var(--soft-green); color: var(--success); border-color: rgba(33, 184, 135, 0.3); }
        .btn-icon {
          width: 34px; height: 34px; border-radius: var(--radius-sm); border: 1px solid var(--border);
          background: var(--bg); color: var(--text-secondary); display: flex; align-items: center; justify-content: center;
          cursor: pointer;
        }
        .btn-icon--danger { color: var(--danger); border-color: rgba(239, 68, 68, 0.3); }

        /* Modal Overlay & Sheet */
        .listings-modal-overlay {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(0, 0, 0, 0.55); backdrop-filter: blur(8px);
          display: flex; align-items: flex-end; justify-content: center;
          animation: fadeIn 0.2s var(--ease-out);
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .listings-modal {
          width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto;
          background: var(--bg-secondary); border-top-left-radius: var(--radius-xl); border-top-right-radius: var(--radius-xl);
          border: 1px solid var(--border); border-bottom: none;
          padding: 20px; display: flex; flex-direction: column; gap: 16px;
          box-shadow: var(--shadow-lg);
          animation: slideUp 0.25s var(--ease-out);
        }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

        .listings-modal__header {
          display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); padding-bottom: 12px;
        }
        .listings-modal__header h3 { font-size: 17px; font-weight: 800; color: var(--text-primary); margin: 0; }
        .listings-modal__close {
          width: 32px; height: 32px; border-radius: 50%; border: none; background: var(--bg);
          color: var(--text-secondary); display: flex; align-items: center; justify-content: center; cursor: pointer;
        }

        .listings-modal__body { display: flex; flex-direction: column; gap: 14px; }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-row { display: flex; gap: 10px; }
        .flex-1 { flex: 1; }
        .form-label { font-size: 12px; font-weight: 700; color: var(--text-primary); }
        .form-input, .form-select, .form-textarea {
          width: 100%; padding: 10px 12px; border-radius: var(--radius-md);
          border: 1px solid var(--border); background-color: var(--surface-2);
          color: var(--text-primary); font-size: 13px; outline: none; font-family: inherit;
          transition: border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
        }
        .form-select { padding-right: 32px; }
        .form-input:focus, .form-select:focus, .form-textarea:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px var(--primary-subtle);
        }
        .form-textarea { resize: vertical; min-height: 92px; }

        .type-selector { display: flex; gap: 8px; }
        .type-btn {
          flex: 1; padding: 10px 6px; border-radius: var(--radius-sm); border: 1px solid var(--border);
          background: var(--bg); color: var(--text-secondary); font-size: 11px; font-weight: 700;
          display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer;
          transition: all 0.2s var(--ease-out);
        }
        .type-btn.active { background: var(--primary-subtle); color: var(--primary); border-color: var(--primary); }

        .modal-notice {
          padding: 10px 12px; border-radius: var(--radius-sm); background: var(--primary-subtle);
          border: 1px solid rgba(40, 120, 240, 0.25); color: var(--primary); font-size: 11px; line-height: 1.4;
          display: flex; align-items: flex-start; gap: 8px;
        }
        .modal-notice__icon { flex-shrink: 0; margin-top: 2px; }

        .modal-actions { display: flex; gap: 10px; margin-top: 6px; }
        .btn-cancel {
          flex: 1; padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border);
          background: var(--bg); color: var(--text-primary); font-size: 13px; font-weight: 700; cursor: pointer;
        }
        .btn-submit {
          flex: 2; padding: 12px; border-radius: var(--radius-md); border: none;
          background: var(--grad-primary); color: #fff; font-size: 13px; font-weight: 800; cursor: pointer;
          box-shadow: 0 4px 14px rgba(40, 120, 240, 0.25);
        }

        .listing-card__desc.clamped {
          display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .listing-card__more {
          align-self: flex-start; padding: 0; background: none; border: none;
          color: var(--primary); font-size: 12px; font-weight: 700; margin-top: -4px;
        }

        .listing-card--skeleton { pointer-events: none; }
        .sk { background: var(--surface-2); border-radius: 6px; }
        .sk--row { display: flex; align-items: center; gap: 10px; background: none; }
        .sk--avatar { width: 38px; height: 38px; border-radius: 12px; flex-shrink: 0; }
        .sk--lines { display: flex; flex-direction: column; gap: 6px; flex: 1; background: none; }
        .sk--bar { height: 11px; animation: skPulse 1.4s ease-in-out infinite; }
        .sk--sm { height: 9px; }
        @keyframes skPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
        @media (prefers-reduced-motion: reduce) { .sk--bar { animation: none; } }

        .listings-load-more {
          width: 100%; margin-top: 14px; padding: 12px;
          border-radius: 14px; border: 1px solid var(--border);
          background: var(--bg-secondary); color: var(--text-primary);
          font-size: 13px; font-weight: 700; cursor: pointer;
          display: flex; align-items: center; justify-content: center; min-height: 44px;
        }
        .listings-load-more:disabled { opacity: 0.6; cursor: default; }
        .spinner--sm { width: 18px; height: 18px; border-width: 2px; }

        /* The handle sits beside the label so a reader knows who they are about to
           message before the app leaves for Telegram. */
        .btn-contact__handle {
          font-weight: 500; opacity: 0.85;
          max-width: 40%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }

        .form-hint { font-size: 11px; color: var(--text-tertiary); line-height: 1.4; }
        .form-label-row { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
        .form-counter { font-size: 11px; font-weight: 600; color: var(--text-tertiary); }
        .form-counter.short { color: var(--warning); }
      `}</style>
    </div>
  );
}
