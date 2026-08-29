import { Award, Sparkles, ChevronRight, Clock, Bot, ListChecks } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { useT } from '../i18n';
import { tapHaptic } from '../utils/haptics';

/**
 * Mock exams tab.
 *
 * These two cards used to sit mid-scroll on Home, below the hero and the prime-time
 * banner — so the feature people pay for was the one they had to scroll to find,
 * while the referral screen held a permanent nav slot. On their own tab the cards get
 * room to say what each exam actually involves.
 */
export default function Mock() {
  const { navigate, user } = useAppStore();
  const t = useT();

  const isPremium = Boolean(user?.isPremium);

  return (
    <div className="mock-page">
      <header className="mock-page__head">
        <h1 className="mock-page__title">{t('mock.section')}</h1>
        <p className="mock-page__sub">{t('mock.pageSub')}</p>
      </header>

      <div className="mock-page__scroll">
        <button
          type="button"
          className="mock-row mock-row--ielts"
          onClick={() => { tapHaptic('medium'); navigate('ielts_mock'); }}
        >
          <div className="mock-row__top">
            <span className="mock-row__icon mock-row__icon--ielts">
              <Award size={22} aria-hidden="true" />
            </span>
            <div className="mock-row__heading">
              <h2 className="mock-row__title">IELTS Speaking</h2>
              <p className="mock-row__sub">{t('mock.ieltsSub')}</p>
            </div>
            <span className="mock-row__tag mock-row__tag--ielts">Band 0–9</span>
          </div>

          <ul className="mock-row__facts">
            <li><Clock size={13} aria-hidden="true" /> {t('mock.duration')}</li>
            <li><ListChecks size={13} aria-hidden="true" /> {t('mock.ieltsParts')}</li>
            <li><Bot size={13} aria-hidden="true" /> {t('mock.aiScored')}</li>
          </ul>

          <span className="mock-row__cta">
            {t('mock.enter')}
            <ChevronRight size={16} aria-hidden="true" />
          </span>
        </button>

        <button
          type="button"
          className="mock-row mock-row--cefr"
          onClick={() => { tapHaptic('medium'); navigate('cefr_mock'); }}
        >
          <div className="mock-row__top">
            <span className="mock-row__icon mock-row__icon--cefr">
              <Sparkles size={22} aria-hidden="true" />
            </span>
            <div className="mock-row__heading">
              <h2 className="mock-row__title">Multilevel Speaking</h2>
              <p className="mock-row__sub">{t('mock.cefrSub')}</p>
            </div>
            <span className="mock-row__tag mock-row__tag--cefr">0–75 · A1–C1</span>
          </div>

          <ul className="mock-row__facts">
            <li><Clock size={13} aria-hidden="true" /> {t('mock.duration')}</li>
            <li><ListChecks size={13} aria-hidden="true" /> {t('mock.cefrParts')}</li>
            <li><Bot size={13} aria-hidden="true" /> {t('mock.aiScored')}</li>
          </ul>

          <span className="mock-row__cta">
            {t('mock.enter')}
            <ChevronRight size={16} aria-hidden="true" />
          </span>
        </button>

        {!isPremium && (
          <button
            type="button"
            className="row"
            onClick={() => { tapHaptic('light'); navigate('premium', { from: 'mock' }); }}
          >
            <span className="row__ico row__ico--accent"><Sparkles size={18} aria-hidden="true" /></span>
            <span className="row__text">
              <span className="row__title">{t('mock.limitTitle')}</span>
              <span className="row__sub">{t('mock.limitSub')}</span>
            </span>
            <ChevronRight size={18} className="row__arrow" aria-hidden="true" />
          </button>
        )}
      </div>

      <style>{`
        .mock-page {
          flex: 1; min-height: 0;
          display: flex; flex-direction: column;
          background: var(--bg);
        }
        .mock-page__head {
          flex-shrink: 0;
          padding: 18px 16px 10px;
        }
        .mock-page__title {
          font-family: var(--font-display);
          font-size: var(--text-xl); font-weight: var(--weight-heavy);
          letter-spacing: -0.02em; color: var(--text-primary);
        }
        .mock-page__sub {
          margin-top: 4px;
          font-size: var(--text-sm); color: var(--text-secondary);
          line-height: 1.45;
        }
        .mock-page__scroll {
          flex: 1; min-height: 0; overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          padding: 6px 16px 20px;
          display: flex; flex-direction: column; gap: 12px;
        }

        .mock-row {
          display: flex; flex-direction: column; gap: 12px;
          width: 100%; padding: 16px;
          text-align: left;
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-strong);
          background: var(--bg-secondary);
          transition: transform var(--t), border-color var(--t);
        }
        .mock-row:active { transform: scale(0.985); }
        .mock-row--ielts { border-color: rgba(56, 189, 248, 0.3); }
        .mock-row--cefr  { border-color: rgba(16, 185, 129, 0.3); }

        .mock-row__top { display: flex; align-items: flex-start; gap: 12px; }
        .mock-row__icon {
          width: 42px; height: 42px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          border-radius: var(--radius-sm);
        }
        .mock-row__icon--ielts { background: rgba(56, 189, 248, 0.16); color: #38bdf8; }
        .mock-row__icon--cefr  { background: rgba(16, 185, 129, 0.16); color: #10b981; }

        .mock-row__heading { flex: 1; min-width: 0; }
        .mock-row__title {
          font-family: var(--font-display);
          font-size: var(--text-md); font-weight: var(--weight-heavy);
          color: var(--text-primary); line-height: 1.2;
        }
        .mock-row__sub {
          margin-top: 3px;
          font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.35;
        }
        .mock-row__tag {
          flex-shrink: 0;
          font-size: var(--text-2xs); font-weight: var(--weight-heavy);
          padding: 3px 8px; border-radius: 6px;
        }
        .mock-row__tag--ielts {
          background: rgba(56, 189, 248, 0.12); color: #38bdf8;
          border: 1px solid rgba(56, 189, 248, 0.22);
        }
        .mock-row__tag--cefr {
          background: rgba(16, 185, 129, 0.12); color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.22);
        }

        .mock-row__facts {
          display: flex; flex-wrap: wrap; gap: 6px 14px;
          list-style: none; margin: 0; padding: 0;
        }
        .mock-row__facts li {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: var(--text-xs); color: var(--text-secondary);
        }

        .mock-row__cta {
          display: flex; align-items: center; justify-content: space-between;
          padding-top: 10px;
          border-top: 1px solid var(--border);
          font-size: var(--text-sm); font-weight: var(--weight-bold);
        }
        .mock-row--ielts .mock-row__cta { color: #38bdf8; }
        .mock-row--cefr  .mock-row__cta { color: #10b981; }
      `}</style>
    </div>
  );
}
