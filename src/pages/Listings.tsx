import React, { useState, useEffect } from 'react';
import {
  Users,
  GraduationCap,
  BookOpen,
  Plus,
  Search,
  Filter,
  Eye,
  MessageSquare,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Edit,
  ChevronLeft,
  Sparkles,
  UserCheck,
  ShieldCheck,
  X,
  ExternalLink,
} from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { useT } from '../i18n';
import { tapHaptic, selectionHaptic } from '../utils/haptics';
import {
  getListings,
  getMyListings,
  createListing,
  updateListing,
  toggleActiveListing,
  deleteListing,
} from '../api/endpoints';

interface ListingsProps {
  navigate: (screen: string, params?: Record<string, any>) => void;
}

export default function Listings({ navigate }: ListingsProps) {
  const { user } = useAppStore();
  const t = useT();

  const [activeTab, setActiveTab] = useState<'all' | 'partner' | 'teacher' | 'student' | 'my'>('all');
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');

  const [listings, setListings] = useState<any[]>([]);
  const [myListings, setMyListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [myLoading, setMyLoading] = useState(false);

  // Create / Edit modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  const [formType, setFormType] = useState<'partner' | 'teacher' | 'student'>('partner');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTargetLevel, setFormTargetLevel] = useState('Intermediate (B1-B2)');
  const [formGender, setFormGender] = useState('any');
  const [formContact, setFormContact] = useState(user?.username ? `@${user.username}` : '');

  const [submitting, setSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (activeTab === 'my') {
      fetchMyListings();
    } else {
      fetchFeed();
    }
  }, [activeTab, levelFilter, genderFilter]);

  async function fetchFeed() {
    setLoading(true);
    try {
      const data = await getListings({
        type: activeTab === 'all' ? undefined : activeTab,
        search,
        level: levelFilter === 'all' ? undefined : levelFilter,
        gender: genderFilter === 'all' ? undefined : genderFilter,
      });
      setListings(data.listings || []);
    } catch (err) {
      console.error('Failed to fetch listings feed:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchMyListings() {
    setMyLoading(true);
    try {
      const data = await getMyListings();
      setMyListings(data.listings || []);
    } catch (err) {
      console.error('Failed to fetch my listings:', err);
    } finally {
      setMyLoading(false);
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (activeTab !== 'my') {
      fetchFeed();
    }
  }

  function showToast(type: 'success' | 'error', text: string) {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  }

  function openCreateModal() {
    tapHaptic('medium');
    setEditingItem(null);
    setFormType('partner');
    setFormTitle('');
    setFormDescription('');
    setFormTargetLevel('Intermediate (B1-B2)');
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
    setFormTargetLevel(item.targetLevel || 'Intermediate (B1-B2)');
    setFormGender(item.genderPreference || 'any');
    setFormContact(item.contactInfo);
    setIsModalOpen(true);
  }

  useEffect(() => {
    if (user?.username && !formContact) {
      setFormContact(`@${user.username}`);
    }
  }, [user?.username]);

  async function handleSubmitModal(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (submitting) return;

    const trimmedTitle = formTitle.trim();
    const trimmedDesc = formDescription.trim();
    const trimmedContact = formContact.trim();

    if (!trimmedTitle || trimmedTitle.length < 3) {
      showToast('error', 'E\'lon sarlavhasi kamida 3 ta belgidan iborat bo\'lishi kerak');
      return;
    }
    if (!trimmedDesc || trimmedDesc.length < 10) {
      showToast('error', `Batafsil ma'lumot kamida 10 ta belgidan iborat bo'lishi kerak (hozir ${trimmedDesc.length} ta)`);
      return;
    }
    if (!trimmedContact) {
      showToast('error', 'Bog\'lanish uchun Telegram login (masalan: @username) kiriting');
      return;
    }

    setSubmitting(true);
    try {
      if (editingItem) {
        await updateListing(editingItem.id, {
          type: formType,
          title: trimmedTitle,
          description: trimmedDesc,
          targetLevel: formTargetLevel,
          genderPreference: formGender,
          contactInfo: trimmedContact,
        });
        showToast('success', 'E\'lon tahrirlandi va qayta admin tasdiqlashiga yuborildi!');
      } else {
        await createListing({
          type: formType,
          title: trimmedTitle,
          description: trimmedDesc,
          targetLevel: formTargetLevel,
          genderPreference: formGender,
          contactInfo: trimmedContact,
        });
        showToast('success', 'E\'lon yaratildi! Admin tasdiqlagach hammaga ko\'rinadi.');
      }
      setIsModalOpen(false);
      setActiveTab('my');
      fetchMyListings();
    } catch (err: any) {
      console.error('Submit error:', err);
      const errMsg = err.response?.data?.error || err.message || 'Xatolik yuz berdi. Qayta urinib ko\'ring';
      showToast('error', errMsg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(id: string) {
    tapHaptic('light');
    try {
      await toggleActiveListing(id);
      fetchMyListings();
      showToast('success', 'E\'lon holati o\'zgartirildi');
    } catch (err) {
      showToast('error', 'Holatni o\'zgartirib bo\'lmadi');
    }
  }

  async function handleDeleteListing(id: string) {
    if (!window.confirm('E\'lonni o\'chirmoqchimisiz?')) return;
    tapHaptic('medium');
    try {
      await deleteListing(id);
      fetchMyListings();
      showToast('success', 'E\'lon o\'chirildi');
    } catch (err) {
      showToast('error', 'O\'chirishda xatolik');
    }
  }

  function openTelegramContact(contact: string) {
    tapHaptic('medium');
    let clean = contact.trim();
    if (clean.startsWith('@')) {
      clean = clean.substring(1);
    }
    let url = `https://t.me/${clean}`;
    if (clean.startsWith('http')) {
      url = clean;
    }

    const tg = window.Telegram?.WebApp;
    if (tg?.openTelegramLink && url.includes('t.me/')) {
      tg.openTelegramLink(url);
    } else {
      window.open(url, '_blank');
    }
  }

  const renderBadge = (type: string) => {
    switch (type) {
      case 'partner':
        return (
          <span className="listing-tag listing-tag--partner">
            <Users size={12} /> Partner kerak
          </span>
        );
      case 'teacher':
        return (
          <span className="listing-tag listing-tag--teacher">
            <GraduationCap size={12} /> Ustoz kerak
          </span>
        );
      case 'student':
        return (
          <span className="listing-tag listing-tag--student">
            <BookOpen size={12} /> Shogird kerak
          </span>
        );
      default:
        return null;
    }
  };

  const renderStatusBadge = (status: string, isActive: boolean) => {
    if (!isActive) {
      return (
        <span className="status-badge status-badge--inactive">
          <Clock size={11} /> Nofaol
        </span>
      );
    }
    switch (status) {
      case 'pending':
        return (
          <span className="status-badge status-badge--pending">
            <Clock size={11} /> Admin tasdiqlashi kutilmoqda
          </span>
        );
      case 'approved':
        return (
          <span className="status-badge status-badge--approved">
            <CheckCircle2 size={11} /> Tasdiqlangan / Faol
          </span>
        );
      case 'rejected':
        return (
          <span className="status-badge status-badge--rejected">
            <XCircle size={11} /> Rad etilgan
          </span>
        );
      default:
        return null;
    }
  };

  const displayedListings = activeTab === 'my' ? myListings : listings;
  const isCurrentLoading = activeTab === 'my' ? myLoading : loading;

  return (
    <div className="listings-page">
      {/* Toast Notification */}
      {toastMsg && (
        <div className={`listings-toast listings-toast--${toastMsg.type}`}>
          <AlertCircle size={16} />
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="listings-page__header">
        <div className="listings-page__header-top">
          <button
            type="button"
            className="listings-page__back"
            onClick={() => { selectionHaptic(); navigate('home'); }}
          >
            <ChevronLeft size={22} />
          </button>
          <div className="listings-page__header-title-wrap">
            <h1 className="listings-page__title">Partner & Ustoz Topish</h1>
            <p className="listings-page__sub">E'lon bering yoki o'zingizga mos hamrohnini toping</p>
          </div>
          <button
            type="button"
            className="listings-page__add-btn"
            onClick={openCreateModal}
          >
            <Plus size={18} strokeWidth={2.5} />
            <span>E'lon berish</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="listings-tabs">
          {[
            { key: 'all', label: '🌐 Barchasi' },
            { key: 'partner', label: '👥 Partner' },
            { key: 'teacher', label: '🎓 Ustoz' },
            { key: 'student', label: '📚 Shogird' },
            { key: 'my', label: '👤 Mening e\'lonlarim' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`listings-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => {
                selectionHaptic();
                setActiveTab(tab.key as any);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filter / Search Bar (For public feed tabs) */}
      {activeTab !== 'my' && (
        <div className="listings-filter-bar">
          <form onSubmit={handleSearchSubmit} className="listings-search">
            <Search size={16} className="listings-search__icon" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Sarlavha yoki kalit so'z..."
              className="listings-search__input"
            />
          </form>

          <div className="listings-selects">
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="listings-select"
            >
              <option value="all">Barcha Darajalar</option>
              <option value="Beginner (A1-A2)">Beginner (A1-A2)</option>
              <option value="Intermediate (B1-B2)">Intermediate (B1-B2)</option>
              <option value="Advanced (C1-C2)">Advanced (C1-C2)</option>
              <option value="IELTS 6.0+">IELTS 6.0+</option>
              <option value="IELTS 7.0+">IELTS 7.0+</option>
            </select>

            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="listings-select"
            >
              <option value="all">Hamma jinslar</option>
              <option value="male">Erkak</option>
              <option value="female">Ayol</option>
            </select>
          </div>
        </div>
      )}

      {/* Main List Area */}
      <div className="listings-scroll">
        {isCurrentLoading ? (
          <div className="listings-loading">
            <div className="spinner" />
            <span>E'lonlar yuklanmoqda...</span>
          </div>
        ) : displayedListings.length === 0 ? (
          <div className="listings-empty">
            <div className="listings-empty__icon">
              <Sparkles size={28} />
            </div>
            <h3>Hozircha e'lonlar mavjud emas</h3>
            <p>
              {activeTab === 'my'
                ? "Siz hali e'lon bermagansiz. Birinchi e'loningizni joylashtiring!"
                : "Ushbu kategroiyada e'lon topilmadi. O'zingiz e me'lon berishingiz mumkin!"}
            </p>
            <button type="button" className="btn-primary" onClick={openCreateModal}>
              <Plus size={18} /> E'lon yaratish
            </button>
          </div>
        ) : (
          <div className="listings-grid">
            {displayedListings.map((item) => (
              <div key={item.id} className="listing-card">
                {/* Card Top: Author & Tag */}
                <div className="listing-card__top">
                  <div className="listing-card__author">
                    <div className="listing-card__avatar-wrap">
                      {item.user?.avatarUrl ? (
                        <img src={item.user.avatarUrl} alt="" className="listing-card__avatar" />
                      ) : (
                        <div className="listing-card__avatar-placeholder">
                          {item.user?.displayName?.charAt(0) || 'U'}
                        </div>
                      )}
                    </div>
                    <div className="listing-card__author-info">
                      <div className="listing-card__author-name-row">
                        <span className="listing-card__author-name">
                          {item.user?.displayName || 'Foydalanuvchi'}
                        </span>
                        {item.user?.isPremium && <span className="pro-badge">PRO</span>}
                      </div>
                      <span className="listing-card__date">
                        Lvl {item.user?.level || 1} • {new Date(item.createdAt).toLocaleDateString('uz-UZ')}
                      </span>
                    </div>
                  </div>

                  <div className="listing-card__tags">
                    {renderBadge(item.type)}
                  </div>
                </div>

                {/* For My Listings: Show Status Badge */}
                {activeTab === 'my' && (
                  <div className="listing-card__status-row">
                    {renderStatusBadge(item.status, item.isActive)}
                  </div>
                )}

                {/* Card Title & Description */}
                <h3 className="listing-card__title">{item.title}</h3>
                <p className="listing-card__desc">{item.description}</p>

                {/* Rejection Note */}
                {activeTab === 'my' && item.status === 'rejected' && item.adminNote && (
                  <div className="listing-card__reject-note">
                    <AlertCircle size={14} />
                    <span><strong>Rad etilish sababi:</strong> {item.adminNote}</span>
                  </div>
                )}

                {/* Target Level & Requirements */}
                <div className="listing-card__pills">
                  {item.targetLevel && (
                    <span className="pill">🎯 {item.targetLevel}</span>
                  )}
                  {item.genderPreference && item.genderPreference !== 'any' && (
                    <span className="pill">
                      👤 {item.genderPreference === 'female' ? 'Faqat Ayollar' : 'Faqat Erkaklar'}
                    </span>
                  )}
                  <span className="pill pill--views">
                    <Eye size={12} /> {item.viewsCount || 0}
                  </span>
                </div>

                {/* Card Actions */}
                <div className="listing-card__actions">
                  {/* Public Feed: Open Telegram contact */}
                  {activeTab !== 'my' ? (
                    <button
                      type="button"
                      className="btn-contact"
                      onClick={() => openTelegramContact(item.contactInfo)}
                    >
                      <Send size={15} />
                      <span>Telegram'da yozish ({item.contactInfo})</span>
                    </button>
                  ) : (
                    /* My listings controls */
                    <div className="my-controls">
                      <button
                        type="button"
                        className={`btn-toggle-active ${item.isActive ? 'active' : ''}`}
                        onClick={() => handleToggleActive(item.id)}
                      >
                        {item.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                        <span>{item.isActive ? 'FAOL' : 'NOFAOL'}</span>
                      </button>

                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => openEditModal(item)}
                        title="Tahrirlash"
                      >
                        <Edit size={16} />
                      </button>

                      <button
                        type="button"
                        className="btn-icon btn-icon--danger"
                        onClick={() => handleDeleteListing(item.id)}
                        title="O'chirish"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Sheet for Creating / Editing Announcement */}
      {isModalOpen && (
        <div className="listings-modal-overlay">
          <div className="listings-modal">
            <div className="listings-modal__header">
              <h3>{editingItem ? 'E\'lonni tahrirlash' : 'Yangi e\'lon berish'}</h3>
              <button
                type="button"
                className="listings-modal__close"
                onClick={() => setIsModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitModal} className="listings-modal__body">
              {/* Type Selection */}
              <div className="form-group">
                <label className="form-label">E'lon Turi:</label>
                <div className="type-selector">
                  <button
                    type="button"
                    className={`type-btn ${formType === 'partner' ? 'active' : ''}`}
                    onClick={() => { selectionHaptic(); setFormType('partner'); }}
                  >
                    <Users size={18} />
                    <span>Partner kerak</span>
                  </button>
                  <button
                    type="button"
                    className={`type-btn ${formType === 'teacher' ? 'active' : ''}`}
                    onClick={() => { selectionHaptic(); setFormType('teacher'); }}
                  >
                    <GraduationCap size={18} />
                    <span>Ustoz kerak</span>
                  </button>
                  <button
                    type="button"
                    className={`type-btn ${formType === 'student' ? 'active' : ''}`}
                    onClick={() => { selectionHaptic(); setFormType('student'); }}
                  >
                    <BookOpen size={18} />
                    <span>Shogird kerak</span>
                  </button>
                </div>
              </div>

              {/* Title Input */}
              <div className="form-group">
                <label className="form-label">E'lon sarlavhasi:</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Masalan: IELTS 7.0 speaking uchun daily partner kerak"
                  maxLength={120}
                  className="form-input"
                  required
                />
              </div>

              {/* Description Input */}
              <div className="form-group">
                <label className="form-label">Batafsil ma'lumot:</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="O'zingiz haqingizda, maqsadlaringiz va qaysi vaqtlarda gaplasha olishingizni batafsil yozing..."
                  maxLength={2000}
                  rows={4}
                  className="form-textarea"
                  required
                />
              </div>

              {/* Requirements row */}
              <div className="form-row">
                <div className="form-group flex-1">
                  <label className="form-label">Mo'ljallangan daraja:</label>
                  <select
                    value={formTargetLevel}
                    onChange={(e) => setFormTargetLevel(e.target.value)}
                    className="form-select"
                  >
                    <option value="Beginner (A1-A2)">Beginner (A1-A2)</option>
                    <option value="Intermediate (B1-B2)">Intermediate (B1-B2)</option>
                    <option value="Advanced (C1-C2)">Advanced (C1-C2)</option>
                    <option value="IELTS 6.0+">IELTS 6.0+</option>
                    <option value="IELTS 7.0+">IELTS 7.0+</option>
                    <option value="Har qanday daraja">Har qanday daraja</option>
                  </select>
                </div>

                <div className="form-group flex-1">
                  <label className="form-label">Jins afzalligi:</label>
                  <select
                    value={formGender}
                    onChange={(e) => setFormGender(e.target.value)}
                    className="form-select"
                  >
                    <option value="any">Farqi yo'q</option>
                    <option value="male">Faqat Erkaklar</option>
                    <option value="female">Faqat Ayollar</option>
                  </select>
                </div>
              </div>

              {/* Contact Info */}
              <div className="form-group">
                <label className="form-label">Telegram Manzilingiz (Login):</label>
                <input
                  type="text"
                  value={formContact}
                  onChange={(e) => setFormContact(e.target.value)}
                  placeholder="@username yoki link"
                  className="form-input"
                  required
                />
              </div>

              {/* Notice Box */}
              <div className="modal-notice">
                <ShieldCheck size={18} className="modal-notice__icon" />
                <span>
                  E'lon birinchi admin (moderator) tomonidan ko'rib chiqiladi. Tasdiqlangandan so'ng barchaga ko'rinadigan bo'ladi.
                </span>
              </div>

              {/* Submit Buttons */}
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setIsModalOpen(false)}
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-submit"
                  onClick={(e) => handleSubmitModal(e)}
                >
                  {submitting ? 'Yuborilmoqda...' : editingItem ? 'Yangilash' : 'Admin Tasdiqlashiga Yuborish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
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
        .listings-page__back {
          width: 38px; height: 38px; border-radius: 12px;
          border: 1px solid var(--border); background: var(--bg-secondary);
          color: var(--text-primary); display: flex; align-items: center; justify-content: center;
          cursor: pointer;
        }
        .listings-page__header-title-wrap { flex: 1; min-width: 0; }
        .listings-page__title {
          font-size: 17px; font-weight: var(--weight-heavy); color: var(--text-primary);
          letter-spacing: -0.3px; margin: 0;
        }
        .listings-page__sub {
          font-size: 11px; color: var(--text-tertiary); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .listings-page__add-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 14px; border-radius: 12px;
          background: linear-gradient(135deg, #00A8FF 0%, #0077FF 100%);
          color: #FFFFFF; border: none; font-size: 12px; font-weight: var(--weight-bold);
          box-shadow: 0 4px 14px rgba(0, 168, 255, 0.35); cursor: pointer;
          transition: transform 0.15s var(--ease-out);
        }
        .listings-page__add-btn:active { transform: scale(0.95); }

        /* Tabs */
        .listings-tabs {
          display: flex; align-items: center; gap: 6px; overflow-x: auto;
          padding-bottom: 4px; scrollbar-width: none;
        }
        .listings-tabs::-webkit-scrollbar { display: none; }
        .listings-tab {
          padding: 6px 12px; border-radius: 20px;
          background: var(--bg-secondary); border: 1px solid var(--border);
          color: var(--text-secondary); font-size: 12px; font-weight: var(--weight-semibold);
          white-space: nowrap; cursor: pointer; transition: all 0.2s var(--ease-out);
        }
        .listings-tab.active {
          background: var(--btn-bg); color: #fff; border-color: var(--btn-bg);
          font-weight: var(--weight-bold); shadow: 0 2px 8px rgba(0, 168, 255, 0.25);
        }

        /* Filter Bar */
        .listings-filter-bar {
          padding: 8px var(--space-4); background: var(--bg-secondary);
          border-bottom: 1px solid var(--border);
          display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;
        }
        .listings-search {
          position: relative; width: 100%;
        }
        .listings-search__icon {
          position: absolute; left: 12px; top: 10px; color: var(--text-tertiary); pointer-events: none;
        }
        .listings-search__input {
          width: 100%; padding: 8px 12px 8px 36px; border-radius: 12px;
          border: 1px solid var(--border); background: var(--bg);
          color: var(--text-primary); font-size: 13px; outline: none;
        }
        .listings-search__input:focus { border-color: var(--btn-bg); }
        .listings-selects { display: flex; gap: 8px; }
        .listings-select {
          flex: 1; padding: 6px 10px; border-radius: 10px;
          border: 1px solid var(--border); background: var(--bg);
          color: var(--text-primary); font-size: 11px; font-weight: 600; outline: none;
        }

        /* Scroll Area & Grid */
        .listings-scroll {
          flex: 1; overflow-y: auto;
          padding: var(--space-4) var(--space-4) calc(90px + env(safe-area-inset-bottom, 0px));
        }
        .listings-loading {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 60px 0; gap: 12px; color: var(--text-secondary); font-size: 13px;
        }
        .spinner {
          width: 28px; height: 28px; border: 3px solid var(--border);
          border-top-color: var(--btn-bg); border-radius: 50%; animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .listings-empty {
          display: flex; flex-direction: column; align-items: center; text-align: center;
          padding: 48px 24px; gap: 12px; background: var(--bg-secondary);
          border: 1px dashed var(--border); border-radius: 20px; margin-top: 16px;
        }
        .listings-empty__icon {
          width: 54px; height: 54px; border-radius: 50%;
          background: rgba(0, 168, 255, 0.12); color: var(--btn-bg);
          display: flex; align-items: center; justify-content: center;
        }
        .listings-empty h3 { font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0; }
        .listings-empty p { font-size: 13px; color: var(--text-tertiary); max-width: 280px; margin: 0; }
        .btn-primary {
          display: flex; align-items: center; gap: 6px; padding: 10px 20px;
          border-radius: 14px; background: var(--btn-bg); color: #fff; border: none;
          font-size: 13px; font-weight: 700; cursor: pointer; margin-top: 4px;
        }

        .listings-grid { display: flex; flex-direction: column; gap: 12px; }

        /* Card */
        .listing-card {
          background: var(--bg-secondary); border: 1px solid var(--border);
          border-radius: 18px; padding: 14px 16px;
          display: flex; flex-direction: column; gap: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.04);
          transition: border-color 0.2s var(--ease-out);
        }
        .listing-card:hover { border-color: rgba(0, 168, 255, 0.4); }

        .listing-card__top {
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
        }
        .listing-card__author { display: flex; align-items: center; gap: 10px; }
        .listing-card__avatar-wrap { position: relative; }
        .listing-card__avatar { width: 38px; height: 38px; border-radius: 12px; object-fit: cover; }
        .listing-card__avatar-placeholder {
          width: 38px; height: 38px; border-radius: 12px;
          background: rgba(0, 168, 255, 0.14); color: var(--btn-bg);
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
          padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700;
        }
        .listing-tag--partner { background: rgba(0, 168, 255, 0.14); color: #00A8FF; border: 1px solid rgba(0, 168, 255, 0.3); }
        .listing-tag--teacher { background: rgba(168, 85, 247, 0.14); color: #A855F7; border: 1px solid rgba(168, 85, 247, 0.3); }
        .listing-tag--student { background: rgba(16, 185, 129, 0.14); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3); }

        /* Status badge */
        .status-badge {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 700;
        }
        .status-badge--pending { background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.3); }
        .status-badge--approved { background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3); }
        .status-badge--rejected { background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.3); }
        .status-badge--inactive { background: var(--surface-2); color: var(--text-tertiary); border: 1px solid var(--border); }

        .listing-card__title { font-size: 15px; font-weight: 800; color: var(--text-primary); margin: 0; line-height: 1.3; }
        .listing-card__desc { font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin: 0; white-space: pre-line; }

        .listing-card__reject-note {
          padding: 8px 12px; border-radius: 10px; background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25); color: #EF4444; font-size: 11px;
          display: flex; align-items: flex-start; gap: 6px;
        }

        .listing-card__pills { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .pill {
          padding: 3px 8px; border-radius: 8px; background: var(--bg);
          border: 1px solid var(--border); font-size: 11px; font-weight: 600; color: var(--text-secondary);
        }
        .pill--views { margin-left: auto; display: flex; align-items: center; gap: 4px; color: var(--text-tertiary); }

        /* Actions */
        .listing-card__actions { margin-top: 4px; }
        .btn-contact {
          width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 10px; border-radius: 12px;
          background: linear-gradient(135deg, #0088CC 0%, #00A8FF 100%);
          color: #fff; border: none; font-size: 13px; font-weight: 700; cursor: pointer;
          box-shadow: 0 3px 12px rgba(0, 136, 204, 0.3); transition: transform 0.15s var(--ease-out);
        }
        .btn-contact:active { transform: scale(0.98); }

        .my-controls { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; }
        .btn-toggle-active {
          display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 10px;
          background: var(--bg); border: 1px solid var(--border); color: var(--text-tertiary);
          font-size: 11px; font-weight: 700; cursor: pointer;
        }
        .btn-toggle-active.active { background: rgba(16, 185, 129, 0.15); color: #10B981; border-color: rgba(16, 185, 129, 0.3); }
        .btn-icon {
          width: 34px; height: 34px; border-radius: 10px; border: 1px solid var(--border);
          background: var(--bg); color: var(--text-secondary); display: flex; align-items: center; justify-content: center;
          cursor: pointer;
        }
        .btn-icon--danger { color: #EF4444; border-color: rgba(239, 68, 68, 0.3); }

        /* Modal Overlay & Sheet */
        .listings-modal-overlay {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(0, 0, 0, 0.65); backdrop-filter: blur(8px);
          display: flex; align-items: flex-end; justify-content: center;
          animation: fadeIn 0.2s var(--ease-out);
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .listings-modal {
          width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto;
          background: var(--bg-secondary); border-top-left-radius: 24px; border-top-right-radius: 24px;
          border: 1px solid var(--border); border-bottom: none;
          padding: 20px; display: flex; flex-direction: column; gap: 16px;
          animation: slideUp 0.25s var(--ease-out);
        }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

        .listings-modal__header {
          display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); pb-12px;
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
          width: 100%; padding: 10px 12px; border-radius: 12px;
          border: 1px solid var(--border); background: var(--bg);
          color: var(--text-primary); font-size: 13px; outline: none; font-family: inherit;
        }
        .form-input:focus, .form-select:focus, .form-textarea:focus { border-color: var(--btn-bg); }

        .type-selector { display: flex; gap: 8px; }
        .type-btn {
          flex: 1; padding: 10px 6px; border-radius: 12px; border: 1px solid var(--border);
          background: var(--bg); color: var(--text-secondary); font-size: 11px; font-weight: 700;
          display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer;
        }
        .type-btn.active { background: rgba(0, 168, 255, 0.14); color: var(--btn-bg); border-color: var(--btn-bg); }

        .modal-notice {
          padding: 10px 12px; border-radius: 12px; background: rgba(0, 168, 255, 0.1);
          border: 1px solid rgba(0, 168, 255, 0.25); color: var(--btn-bg); font-size: 11px; line-height: 1.4;
          display: flex; align-items: flex-start; gap: 8px;
        }
        .modal-notice__icon { flex-shrink: 0; margin-top: 2px; }

        .modal-actions { display: flex; gap: 10px; margin-top: 6px; }
        .btn-cancel {
          flex: 1; padding: 12px; border-radius: 12px; border: 1px solid var(--border);
          background: var(--bg); color: var(--text-primary); font-size: 13px; font-weight: 700; cursor: pointer;
        }
        .btn-submit {
          flex: 2; padding: 12px; border-radius: 12px; border: none;
          background: var(--btn-bg); color: #fff; font-size: 13px; font-weight: 800; cursor: pointer;
          box-shadow: 0 4px 14px rgba(0, 168, 255, 0.35);
        }
      `}</style>
    </div>
  );
}
