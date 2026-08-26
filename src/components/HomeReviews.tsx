import { useEffect, useState } from 'react';
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
          <h3 className="home-reviews-title">Foydalanuvchilar fikri</h3>
        </div>

        <div className="home-reviews-actions">
          <button
            type="button"
            className="home-reviews-add-btn"
            onClick={openModal}
          >
            <MessageSquarePlus size={14} />
            <span>Fikr qoldirish</span>
          </button>
        </div>
      </div>

      {reviews.length > 0 ? (
        <>
          <div className="home-reviews-carousel">
            {reviews.slice(0, 5).map((rev) => (
              <div key={rev.id} className="home-review-item" onClick={goAllReviews} style={{ cursor: 'pointer' }}>
                <div className="home-review-item-head">
                  <div className="home-review-user">
                    <div className="home-review-avatar">
                      {rev.display_name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <span className="home-review-name">{rev.display_name || 'Foydalanuvchi'}</span>
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

          <button type="button" className="home-reviews-footer-btn" onClick={goAllReviews}>
            <span>Barcha sharhlarni ko'rish {stats?.total ? `(${stats.total})` : ''}</span>
            <ChevronRight size={14} />
          </button>
        </>
      ) : (
        <div className="home-reviews-empty" onClick={openModal}>
          <p>Suhbatdosh ilovasi haqida birinchi bo'lib o'z fikringizni qoldiring!</p>
        </div>
      )}

      {showReviewModal && (
        <div className="home-review-modal-backdrop" onClick={() => setShowReviewModal(false)}>
          <div className="home-review-modal-content scale-in" onClick={(e) => e.stopPropagation()}>
            <ReviewPrompt forceShow={true} onClose={() => setShowReviewModal(false)} />
          </div>
        </div>
      )}

      <style>{`
        .home-reviews-card {
          width: 100%;
          padding: 16px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
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
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.85);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .home-reviews-footer-btn:active {
          transform: scale(0.98);
          background: rgba(255, 255, 255, 0.1);
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
          border-radius: 10px;
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
          color: #ffffff;
          margin: 0;
        }

        .home-reviews-add-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border-radius: 12px;
          background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
          color: #ffffff;
          font-size: 12px;
          font-weight: 700;
          border: none;
          box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);
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
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .home-reviews-carousel::-webkit-scrollbar {
          display: none;
        }

        .home-review-item {
          min-width: 220px;
          max-width: 240px;
          padding: 12px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
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
          background: #0284c7;
          color: #ffffff;
          font-size: 11px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .home-review-name {
          font-size: 12px;
          font-weight: 600;
          color: #ffffff;
        }

        .home-review-stars {
          display: flex;
          gap: 2px;
        }

        .home-review-comment {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.8);
          line-height: 1.35;
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .home-review-quote-ico {
          display: inline;
          margin-right: 4px;
          opacity: 0.5;
        }

        .home-reviews-empty {
          padding: 14px;
          text-align: center;
          background: rgba(255, 255, 255, 0.03);
          border: 1px dashed rgba(255, 255, 255, 0.15);
          border-radius: 14px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
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
