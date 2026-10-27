import { useEffect, useRef } from 'react';
import useAppStore from '../store/useAppStore';
import { tapHaptic } from '../utils/haptics';
import { ArrowLeft, CheckCircle2, Mic, Users, HeartHandshake } from 'lucide-react';

export default function Premium() {
  const { navigate, screenParams } = useAppStore();

  const back = () => navigate(screenParams?.from || 'home');

  const backRef = useRef(back);
  backRef.current = back;

  useEffect(() => {
    const backBtn = window.Telegram?.WebApp?.BackButton;
    let handleBack: (() => void) | undefined;
    if (backBtn) {
      handleBack = () => backRef.current?.();
      backBtn.onClick(handleBack);
      backBtn.show();
    }
    return () => {
      if (backBtn) {
        if (handleBack) backBtn.offClick(handleBack);
        backBtn.hide();
      }
    };
  }, []);

  return (
    <div className="free-page">
      <div className="free-topbar">
        <button className="free-back" onClick={back} aria-label="Go Back">
          <ArrowLeft size={20} />
        </button>
        <h1 className="free-topbar-title">Suhbatdosh</h1>
        <div style={{ width: 36 }} />
      </div>

      <div className="free-scroll">
        <div className="free-hero">
          <div className="free-hero__badge">
            <HeartHandshake size={16} />
            <span>100% Bepul Platforma</span>
          </div>
          <h2>Barcha imkoniyatlar to'liq bepul!</h2>
          <p>
            Suhbatdosh platformasida barcha foydalanuvchilar uchun ingliz tilida suhbatlashish va sherik topish to'liq bepul va cheksiz.
          </p>
        </div>

        <div className="free-features">
          <div className="free-feat-item">
            <span className="free-feat-ico">
              <Mic size={20} />
            </span>
            <div className="free-feat-text">
              <h3>Cheksiz Jonli Muloqot</h3>
              <p>Har kuni istagancha real odamlar bilan ovozli gaplashing. Hech qanday daqiqa limiti yo'q.</p>
            </div>
            <CheckCircle2 size={18} className="free-check" />
          </div>

          <div className="free-feat-item">
            <span className="free-feat-ico">
              <Users size={20} />
            </span>
            <div className="free-feat-text">
              <h3>Sheriklar va Ustozlar Doskasi</h3>
              <p>O'zingizga mos sherik, ustoz yoki o'quvchi toping, bepul e'lon joylang va bog'laning.</p>
            </div>
            <CheckCircle2 size={18} className="free-check" />
          </div>

          <div className="free-feat-item">
            <span className="free-feat-ico">
              <HeartHandshake size={20} />
            </span>
            <div className="free-feat-text">
              <h3>Hech Qanday To'lov Yo'q</h3>
              <p>Platformadan foydalanish uchun obuna yoki karta to'lovi talab etilmaydi.</p>
            </div>
            <CheckCircle2 size={18} className="free-check" />
          </div>
        </div>

        <button
          type="button"
          className="btn-primary free-cta-btn"
          onClick={() => {
            tapHaptic('medium');
            navigate('home');
          }}
        >
          <Mic size={18} />
          <span>Suhbatni boshlash</span>
        </button>
      </div>

      <style>{`
        .free-page {
          display: flex; flex-direction: column; height: 100%;
          background: var(--bg); color: var(--text-primary);
        }
        .free-topbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: calc(var(--space-2) + env(safe-area-inset-top, 0px)) var(--space-4) var(--space-2);
          border-bottom: 1px solid var(--border);
          background: var(--chrome-bg);
          backdrop-filter: blur(20px);
          flex-shrink: 0;
        }
        .free-back {
          width: 36px; height: 36px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: var(--text-secondary); background: transparent; border: none;
          cursor: pointer;
        }
        .free-topbar-title {
          font-size: var(--text-base); font-weight: var(--weight-bold);
        }
        .free-scroll {
          flex: 1; overflow-y: auto; padding: var(--space-5) var(--space-4) 40px;
          display: flex; flex-direction: column; gap: var(--space-5); max-width: 440px; margin: 0 auto; width: 100%;
        }
        .free-hero {
          text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px;
          padding: 24px 16px; border-radius: 24px;
          background: linear-gradient(180deg, rgba(0, 168, 255, 0.08) 0%, transparent 100%);
          border: 1px solid var(--border);
        }
        .free-hero__badge {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 5px 12px; border-radius: 20px;
          background: rgba(52, 199, 89, 0.15); color: #34C759;
          font-size: 12px; font-weight: 700;
        }
        .free-hero h2 {
          font-size: 22px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.25;
        }
        .free-hero p {
          font-size: 13px; color: var(--text-secondary); line-height: 1.5;
        }
        .free-features {
          display: flex; flex-direction: column; gap: 12px;
        }
        .free-feat-item {
          display: flex; align-items: center; gap: 14px;
          padding: 16px; border-radius: 18px;
          background: var(--surface-1); border: 1px solid var(--border);
        }
        .free-feat-ico {
          width: 42px; height: 42px; border-radius: 12px;
          background: rgba(0, 168, 255, 0.12); color: var(--btn-bg);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .free-feat-text { flex: 1; min-width: 0; }
        .free-feat-text h3 {
          font-size: 14px; font-weight: 700; margin: 0 0 2px 0; color: var(--text-primary);
        }
        .free-feat-text p {
          font-size: 12px; color: var(--text-secondary); margin: 0; line-height: 1.4;
        }
        .free-check { color: #34C759; flex-shrink: 0; }
        .free-cta-btn {
          width: 100%; height: 50px; font-size: 15px; font-weight: 700;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          border-radius: 16px; margin-top: 8px;
        }
      `}</style>
    </div>
  );
}
