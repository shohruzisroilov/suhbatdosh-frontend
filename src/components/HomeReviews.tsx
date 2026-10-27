import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getReviews } from '../api/endpoints';
import { Star, MessageSquarePlus, Quote, ChevronRight } from 'lucide-react';
import { tapHaptic } from '../utils/haptics';
import useAppStore from '../store/useAppStore';
import ReviewPrompt from './ReviewPrompt';

interface ReviewItem {
  id: number;
  rating: number;
  comment: string;
  display_name?: string;
  avatar_url?: string;
  created_at?: string;
}

export default function HomeReviews() {
  const { navigate } = useAppStore();
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getReviews(1, 10)
      .then((d) => {
        if (d?.reviews && d.reviews.length > 0) {
          setReviews(d.reviews.filter((r: ReviewItem) => r.comment && r.comment.trim().length > 0));
        }
        if (d?.stats) {
          setStats(d.stats);
        }
      })
      .catch(() => {});
  }, []);

  const displayReviews = reviews.slice(0, 5);

  useEffect(() => {
    if (displayReviews.length <= 1 || paused) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % displayReviews.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [displayReviews.length, paused]);

  useEffect(() => {
    if (carouselRef.current && displayReviews.length > 0) {
      const cardWidth = 236; // 224px width + 12px gap
      carouselRef.current.scrollTo({
        left: activeIndex * cardWidth,
        behavior: 'smooth',
      });
    }
  }, [activeIndex, displayReviews.length]);

  const openModal = () => {
    tapHaptic('light');
    setShowReviewModal(true);
  };

  const goAllReviews = () => {
    tapHaptic('light');
    navigate('reviews');
  };

  return (
    <div className="home-reviews-card fade-up">
      <div className="home-reviews-header">
        <div className="home-reviews-title-wrap" onClick={goAllReviews} style={{ cursor: 'pointer' }}>
          <span className="home-reviews-badge">
            <Star size={12} fill="#eab308" className="text-yellow-500" />
            <span>{stats?.avg_rating || '4.9'} / 5.0</span>
          </span>
          <h3 className="home-reviews-title">User Reviews</h3>
        </div>

        <div className="home-reviews-actions">
          <button
            type="button"
            className="home-reviews-add-btn"
            onClick={openModal}
          >
            <MessageSquarePlus size={14} />
            <span>Write Review</span>
          </button>
        </div>
      </div>

      {displayReviews.length > 0 ? (
        <>
          <div
            ref={carouselRef}
            className="home-reviews-carousel"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onTouchStart={() => setPaused(true)}
            onTouchEnd={() => setPaused(false)}
          >
            {displayReviews.map((rev, idx) => (
              <div
                key={rev.id}
                className="home-review-item"
                onClick={goAllReviews}
                style={{ cursor: 'pointer' }}
              >
                <div className="home-review-item-head">
                  <div className="home-review-user">
                    <div className="home-review-avatar">
                      {rev.display_name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <span className="home-review-name">{rev.display_name || 'User'}</span>
                  </div>
                  <div className="home-review-stars">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={11}
                        fill={i < rev.rating ? '#eab308' : 'none'}
                        className={i < rev.rating ? 'text-yellow-500' : 'text-slate-600'}
                      />
                    ))}
                  </div>
                </div>
                <p className="home-review-comment">
                  <Quote size={12} className="home-review-quote-ico" />
                  {rev.comment}
                </p>
              </div>
            ))}
          </div>

          {displayReviews.length > 1 && (
            <div className="home-reviews-dots">
              {displayReviews.map((_, dotIdx) => (
                <button
                  key={dotIdx}
                  type="button"
                  className={`home-reviews-dot ${dotIdx === activeIndex ? 'active' : ''}`}
                  onClick={() => { tapHaptic('light'); setActiveIndex(dotIdx); }}
                />
              ))}
            </div>
          )}

          <button type="button" className="home-reviews-footer-btn" onClick={goAllReviews}>
            <span>View all reviews {stats?.total ? `(${stats.total})` : ''}</span>
            <ChevronRight size={14} />
          </button>
        </>
      ) : (
        <div className="home-reviews-empty" onClick={openModal}>
          <p>Be the first to leave a review for Suhbatdosh!</p>
        </div>
      )}

      {showReviewModal && createPortal(
        <div className="home-review-modal-backdrop" onClick={() => setShowReviewModal(false)}>
          <div className="home-review-modal-content scale-in" onClick={(e) => e.stopPropagation()}>
            <ReviewPrompt forceShow={true} onClose={() => setShowReviewModal(false)} />
          </div>
        </div>,
        document.body
      )}

      <style>{`
        .home-reviews-card {
          width: 100%;
          padding: 16px;
          border-radius: 20px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          gap: 14px;
          margin-top: 4px;
        }

        .home-reviews-footer-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 9px 14px;
          border-radius: 12px;
          background: var(--surface-2);
          border: 1px solid var(--border);
          color: var(--text-primary);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .home-reviews-footer-btn:active {
          transform: scale(0.98);
          background: var(--surface-3);
        }

        .home-reviews-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .home-reviews-title-wrap {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .home-reviews-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: var(--radius-full);
          background: rgba(234, 179, 8, 0.15);
          border: 1px solid rgba(234, 179, 8, 0.3);
          color: #eab308;
          font-size: 11px;
          font-weight: 700;
          width: fit-content;
        }

        .home-reviews-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }

        .home-reviews-add-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border-radius: var(--radius-md);
          background: var(--grad-primary);
          color: #ffffff;
          font-size: 12px;
          font-weight: 700;
          border: none;
          box-shadow: 0 4px 14px rgba(0, 168, 255, 0.3);
          cursor: pointer;
          transition: transform 0.15s ease;
        }
        .home-reviews-add-btn:active {
          transform: scale(0.96);
        }

        .home-reviews-carousel {
          display: flex;
          gap: 12px;
          overflow-x: auto;
          padding-bottom: 6px;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .home-reviews-carousel::-webkit-scrollbar {
          display: none;
        }

        .home-review-item {
          min-width: 224px;
          max-width: 240px;
          scroll-snap-align: start;
          padding: 12px;
          border-radius: var(--radius-md);
          background: var(--surface-2);
          border: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex-shrink: 0;
        }

        .home-review-item-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .home-review-user {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .home-review-avatar {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: var(--primary);
          color: var(--primary-contrast);
          font-size: 11px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .home-review-name {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .home-review-stars {
          display: flex;
          gap: 2px;
        }

        .home-review-comment {
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.35;
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .home-reviews-dots {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-top: 10px;
          margin-bottom: 2px;
        }

        .home-reviews-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--border-strong);
          border: none;
          padding: 0;
          cursor: pointer;
          transition: all 0.25s ease;
        }

        .home-reviews-dot.active {
          width: 18px;
          border-radius: 4px;
          background: #0284c7;
        }

        @keyframes fadeInSlide {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .home-reviews-empty {
          padding: 14px;
          text-align: center;
          background: var(--surface-2);
          border: 1px dashed var(--border-strong);
          border-radius: 14px;
          font-size: 12px;
          color: var(--text-secondary);
          cursor: pointer;
        }

        .home-review-modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 10000;
          background: rgba(0, 0, 0, 0.78);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          box-sizing: border-box;
        }

        .home-review-modal-content {
          width: 100%;
          max-width: 380px;
          margin: auto;
        }
      `}</style>
    </div>
  );
}
