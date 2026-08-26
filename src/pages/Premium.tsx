import { useState, useEffect, useRef } from 'react';
import { useT, useLang } from '../i18n';
import { getPremiumPlans, createStarsInvoice, getMe } from '../api/endpoints';
import useAppStore from '../store/useAppStore';
import { notifyHaptic, tapHaptic } from '../utils/haptics';
import { ArrowLeft, ArrowRight, Star, Zap, Check, PartyPopper, CreditCard, Copy } from 'lucide-react';

const AMOUNT_BY_LANG: Record<string, string> = { uz: "$2 (26 000 so'm)", ru: '$2 (26 000 сум)', en: "$2 (26 000 so'm)" };

export default function Premium() {
  const t = useT();
  const lang = useLang();
  const { user, setUser, navigate, screenParams } = useAppStore();
  const amount = AMOUNT_BY_LANG[lang] || AMOUNT_BY_LANG.uz;
  const [copied, setCopied] = useState(false);

  const [plans, setPlans] = useState<any[] | null>(null);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  const back = () => navigate(screenParams?.from || 'profile');

  const backRef = useRef(back);
  backRef.current = back;

  useEffect(() => {
    getPremiumPlans().then((d) => setPlans(d.plans || [])).catch(() => setPlans([]));

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCopy() {
    try { navigator.clipboard?.writeText('9860190110799466'); } catch (e) {}
    notifyHaptic('success');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handlePayStars(plan: any) {
    if (busyPlan) return;
    tapHaptic('medium');
    setBusyPlan(plan.id);
    try {
      const { invoiceLink } = await createStarsInvoice(plan.id);
      const wa = window.Telegram?.WebApp;
      if (wa?.openInvoice) {
        wa.openInvoice(invoiceLink, async (status: string) => {
          setBusyPlan(null);
          if (status === 'paid') {
            notifyHaptic('success');
            try {
              const me = await getMe();
              if (me?.user) setUser(me.user);
            } catch {}
            setPaid(true);
          }
        });
      } else {
        window.open(invoiceLink, '_blank');
        setBusyPlan(null);
      }
    } catch {
      setBusyPlan(null);
    }
  }

  const step3Parts = t('pm.step3').split('{handle}');
  const step1Parts = t('pm.step1').split('{amount}');

  return (
    <div className="premium-page">
      <div className="premium-topbar">
        <button className="premium-back" onClick={back} aria-label={t('common.goBack')}><ArrowLeft size={20} /></button>
        <h1 className="premium-topbar-title">{t('pm.title')}</h1>
        <div style={{ width: 36 }} />
      </div>

      <div className="premium-scroll">
        <div className="premium-hero">
          <div className="premium-hero__glow" />
          <span className="premium-star"><Star size={44} fill="currentColor" strokeWidth={0} /></span>
          <h2>{t('pm.title')}</h2>
          <p>{t('pm.subtitle')}</p>
        </div>

        {paid ? (
          <div className="premium-paid">
            <div className="premium-paid__ico"><PartyPopper size={30} /></div>
            <p>{t('pm.paid')}</p>
            <button className="btn-primary" onClick={back}>{t('common.goBack')}</button>
          </div>
        ) : (
          <>
            {/* Free vs Premium Detailed Comparison Matrix */}
            <div className="premium-matrix">
              <div className="premium-matrix-head">
                <span className="premium-matrix-title">Imkoniyatlar taqqoslashi</span>
                <span className="premium-matrix-sub">Bepul va Premium tarifi o'rtasidagi farqlar</span>
              </div>

              <div className="premium-table">
                <div className="premium-table-row premium-table-header">
                  <div className="premium-cell feat-cell">Xususiyat</div>
                  <div className="premium-cell free-cell">Bepul (Free)</div>
                  <div className="premium-cell pro-cell">
                    <Star size={11} fill="currentColor" strokeWidth={0} /> Premium
                  </div>
                </div>

                <div className="premium-table-row">
                  <div className="premium-cell feat-cell">
                    <span className="feat-name">{t('pm.rowTalk')}</span>
                    <span className="feat-desc">{t('pm.featLive')}</span>
                  </div>
                  <div className="premium-cell free-cell text-muted">{t('pm.freePerDay', { n: user?.dailyLimit || 10 })}</div>
                  <div className="premium-cell pro-cell text-highlight">{t('pm.unlimited')}</div>
                </div>

                <div className="premium-table-row">
                  <div className="premium-cell feat-cell">
                    <span className="feat-name">{t('pm.rowIelts')}</span>
                    <span className="feat-desc">{t('pm.rowIeltsSub')}</span>
                  </div>
                  <div className="premium-cell free-cell text-muted">{t('pm.freeTotal', { n: 3 })}</div>
                  <div className="premium-cell pro-cell text-highlight">{t('pm.perDayFull', { n: 3 })}</div>
                </div>

                <div className="premium-table-row">
                  <div className="premium-cell feat-cell">
                    <span className="feat-name">{t('pm.rowCefr')}</span>
                    <span className="feat-desc">{t('pm.rowCefrSub')}</span>
                  </div>
                  <div className="premium-cell free-cell text-muted">{t('pm.freeTotal', { n: 3 })}</div>
                  <div className="premium-cell pro-cell text-highlight">{t('pm.perDayFull', { n: 3 })}</div>
                </div>

                <div className="premium-table-row">
                  <div className="premium-cell feat-cell">
                    <span className="feat-name">{t('pm.rowMatch')}</span>
                    <span className="feat-desc">{t('pm.rowMatchSub')}</span>
                  </div>
                  <div className="premium-cell free-cell text-muted">{t('pm.standard')}</div>
                  <div className="premium-cell pro-cell text-highlight">{t('pm.priority')}</div>
                </div>

                <div className="premium-table-row">
                  <div className="premium-cell feat-cell">
                    <span className="feat-name">{t('pm.rowAi')}</span>
                    <span className="feat-desc">{t('pm.rowAiSub')}</span>
                  </div>
                  <div className="premium-cell free-cell text-muted">{t('pm.basic')}</div>
                  <div className="premium-cell pro-cell text-highlight">{t('pm.full')}</div>
                </div>
              </div>
            </div>

            <div className="premium-stars">
              <div className="premium-stars-head">
                <span className="premium-stars-title"><Zap size={15} strokeWidth={2.5} /> {t('pm.starsTitle')}</span>
                <span className="premium-stars-sub">{t('pm.starsSub')}</span>
              </div>

              {plans === null ? (
                <div className="premium-plan premium-plan--skel" />
              ) : (
                plans.map((p, i) => {
                  const best = i === plans.length - 1 && plans.length > 1;
                  const monthsLabel = `${p.months} ${p.months === 1 ? t('pm.month') : t('pm.months')}`;
                  return (
                    <button
                      key={p.id}
                      className={`premium-plan${best ? ' premium-plan--best' : ''}`}
                      onClick={() => handlePayStars(p)}
                      disabled={!!busyPlan}
                    >
                      <span className="premium-plan-left">
                        <span className="premium-plan-months">{monthsLabel}</span>
                        {best && <span className="premium-plan-badge">{t('pm.best')}</span>}
                      </span>
                      <span className="premium-plan-price">
                        {busyPlan === p.id ? t('pm.processing') : (
                          <><Star size={13} fill="currentColor" strokeWidth={0} /><span className="num">{p.stars}</span></>
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="premium-divider"><span>{t('pm.orCard')}</span></div>

            {/* Visual Bank Card Component */}
            <div className="card-payment-box">
              <div className="bank-card">
                <div className="bank-card__top">
                  <div className="bank-card__chip">
                    <CreditCard size={22} className="bank-card__chip-icon" />
                    <span className="bank-card__type">Uzcard / Humo</span>
                  </div>
                  <span className="bank-card__badge">{amount}</span>
                </div>

                <div className="bank-card__number-wrap">
                  <span className="bank-card__label">{t('pm.cardNumber')}</span>
                  <div className="bank-card__number-row">
                    <span className="bank-card__number">9860 1901 1079 9466</span>
                    <button type="button" className={`bank-card__copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy}>
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copied ? t('pm.copied') : 'Nusxalash'}</span>
                    </button>
                  </div>
                </div>

                <div className="bank-card__bottom">
                  <div className="bank-card__info">
                    <span className="bank-card__label">{t('pm.name')}</span>
                    <span className="bank-card__val">Shohruz Isroilov</span>
                  </div>
                  <div className="bank-card__info bank-card__info--right">
                    <span className="bank-card__label">{t('pm.amount')}</span>
                    <span className="bank-card__val bank-card__val--highlight">{amount}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="premium-steps">
              <p className="premium-step">
                {step1Parts[0]}<strong>{amount}</strong>{step1Parts[1]}
              </p>
              <p className="premium-step">{t('pm.step2')}</p>
              <p className="premium-step">
                {step3Parts[0]}
                <a href="https://t.me/Shohruz_Isroilov" target="_blank" rel="noreferrer" className="premium-link">
                  @Shohruz_Isroilov
                </a>
                {step3Parts[1]}
              </p>
              <p className="premium-step">{t('pm.step4')}</p>
            </div>

            <a
              className="btn-secondary"
              href="https://t.me/Shohruz_Isroilov"
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              {t('pm.send')}<ArrowRight size={17} />
            </a>
          </>
        )}
      </div>

      <style>{`
        .premium-page {
          display: flex; flex-direction: column;
          height: 100%; background: var(--bg);
        }

        .premium-topbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: calc(var(--space-4) + env(safe-area-inset-top, 0px)) var(--space-4) var(--space-3);
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .premium-back {
          width: 36px; height: 36px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background: var(--bg-secondary); color: var(--text-primary);
          border: 1px solid var(--border);
          transition: opacity var(--t), background var(--t);
        }
        .premium-back:active { opacity: 0.6; background: var(--surface-2); }
        .premium-topbar-title { font-size: var(--text-md); font-weight: var(--weight-bold); }

        .premium-scroll {
          flex: 1; overflow-y: auto;
          padding: var(--space-4) var(--space-4) calc(var(--space-5) + env(safe-area-inset-bottom, 0px));
          display: flex; flex-direction: column; gap: var(--space-4);
          -webkit-overflow-scrolling: touch;
        }

        .premium-hero {
          display: flex; flex-direction: column; align-items: center;
          gap: var(--space-2); padding: var(--space-3) 0 0;
          position: relative;
        }
        .premium-hero__glow {
          position: absolute; top: -20px; left: 50%; transform: translateX(-50%);
          width: 160px; height: 160px; border-radius: 50%;
          background: radial-gradient(circle, rgba(255,215,0,0.15) 0%, transparent 70%);
          pointer-events: none;
        }
        .premium-star {
          position: relative; z-index: 1;
          color: #FFD700;
          filter: drop-shadow(0 4px 12px rgba(255, 215, 0, 0.5));
          animation: starPulse 2.5s ease-in-out infinite;
        }
        @keyframes starPulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 4px 12px rgba(255, 215, 0, 0.5)); }
          50% { transform: scale(1.08); filter: drop-shadow(0 4px 20px rgba(255, 215, 0, 0.7)); }
        }
        .premium-hero h2 {
          font-size: var(--text-xl); font-weight: var(--weight-heavy); letter-spacing: -0.5px;
          color: var(--text-primary);
        }
        .premium-hero p { font-size: var(--text-sm); color: var(--text-secondary); text-align: center; }

        .premium-matrix {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 18px;
          padding: 16px 14px;
          display: flex; flex-direction: column; gap: 14px;
          backdrop-filter: blur(10px);
        }
        .premium-matrix-head {
          display: flex; flex-direction: column; gap: 2px;
        }
        .premium-matrix-title {
          font-size: 15px; font-weight: 800; color: #ffffff;
        }
        .premium-matrix-sub {
          font-size: 11px; color: #94a3b8;
        }

        .premium-table {
          display: flex; flex-direction: column;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          overflow: hidden;
          background: rgba(0, 0, 0, 0.2);
        }
        .premium-table-row {
          display: grid;
          grid-template-columns: 1.4fr 1fr 1fr;
          align-items: center;
          padding: 10px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        .premium-table-row:last-child { border-bottom: none; }
        .premium-table-header {
          background: rgba(255, 255, 255, 0.05);
          font-size: 11px; font-weight: 800; color: #94a3b8;
          text-transform: uppercase; letter-spacing: 0.4px;
          padding: 10px 12px;
        }

        .premium-cell {
          display: flex; flex-direction: column; justify-content: center;
        }
        .free-cell, .pro-cell {
          text-align: center;
          align-items: center;
        }
        .pro-cell {
          color: #38bdf8;
          font-weight: 700;
        }
        .premium-table-header .pro-cell {
          flex-direction: row; gap: 4px; color: #ffd700;
        }

        .feat-name {
          font-size: 12px; font-weight: 700; color: #ffffff; line-height: 1.25;
        }
        .feat-desc {
          font-size: 10px; color: #94a3b8; margin-top: 1px;
        }

        .text-muted {
          font-size: 11px; color: #64748b; font-weight: 600;
        }
        .text-highlight {
          font-size: 11px; font-weight: 800; color: #38bdf8;
        }

        .premium-stars { display: flex; flex-direction: column; gap: var(--space-2); }
        .premium-stars-head { display: flex; flex-direction: column; gap: var(--space-0-5); padding: 0 var(--space-0-5); }
        .premium-stars-title {
          display: flex; align-items: center; gap: 6px;
          font-size: var(--text-base); font-weight: var(--weight-heavy);
        }
        .premium-stars-sub { font-size: var(--text-xs); color: var(--text-secondary); }

        .premium-plan {
          display: flex; align-items: center; justify-content: space-between;
          width: 100%; padding: var(--space-4);
          background: var(--bg-secondary);
          border: 1.5px solid var(--border);
          border-radius: var(--radius-md);
          transition: opacity var(--t), transform var(--t), border-color var(--t);
        }
        .premium-plan:active:not(:disabled) { transform: scale(0.98); opacity: 0.85; }
        .premium-plan:disabled { opacity: 0.5; }
        .premium-plan--best {
          border-color: var(--btn-bg);
          background: rgba(0, 168, 255, 0.05);
          box-shadow: 0 4px 16px rgba(0, 168, 255, 0.12);
        }
        .premium-plan--skel { min-height: 56px; opacity: 0.3; }
        .premium-plan-left { display: flex; align-items: center; gap: var(--space-2); }
        .premium-plan-months { font-size: var(--text-base); font-weight: var(--weight-bold); }
        .premium-plan-badge {
          font-size: var(--text-xs); font-weight: var(--weight-heavy); letter-spacing: 0.2px;
          padding: 2px 8px; border-radius: 999px;
          background: var(--btn-bg); color: var(--btn-text);
        }
        .premium-plan-price {
          display: flex; align-items: center; gap: 4px;
          font-size: var(--text-base); font-weight: var(--weight-heavy);
          color: var(--rating); white-space: nowrap;
        }

        .premium-divider {
          display: flex; align-items: center; text-align: center;
          color: var(--text-tertiary); font-size: var(--text-xs); gap: var(--space-3);
        }
        .premium-divider::before, .premium-divider::after {
          content: ''; flex: 1; height: 1px; background: var(--border);
        }

        /* Bank Card Styling */
        .card-payment-box {
          width: 100%;
        }
        .bank-card {
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0369a1 100%);
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: var(--radius-lg, 16px);
          padding: var(--space-4);
          color: #ffffff;
          display: flex; flex-direction: column; gap: var(--space-3);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
          position: relative; overflow: hidden;
        }
        .bank-card::before {
          content: '';
          position: absolute; top: -50%; right: -50%; width: 200px; height: 200px;
          background: radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, transparent 70%);
          pointer-events: none;
        }
        .bank-card__top {
          display: flex; align-items: center; justify-content: space-between;
        }
        .bank-card__chip {
          display: flex; align-items: center; gap: 6px;
          color: #38bdf8; font-size: 11px; font-weight: var(--weight-bold);
          letter-spacing: 0.5px; text-transform: uppercase;
        }
        .bank-card__chip-icon { color: #38bdf8; }
        .bank-card__badge {
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(4px);
          padding: 3px 10px; border-radius: 999px;
          font-size: 11px; font-weight: var(--weight-heavy);
          color: #ffffff; border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .bank-card__number-wrap {
          display: flex; flex-direction: column; gap: 4px;
        }
        .bank-card__label {
          font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px;
          color: rgba(255, 255, 255, 0.6); font-weight: var(--weight-bold);
        }
        .bank-card__number-row {
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
        }
        .bank-card__number {
          font-family: monospace; font-size: 17px; font-weight: 700;
          letter-spacing: 1.5px; color: #ffffff;
          text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        }
        .bank-card__copy-btn {
          display: inline-flex; align-items: center; gap: 4px;
          background: #00a8ff; color: #ffffff;
          border: none; padding: 5px 10px; border-radius: 8px;
          font-size: 11px; font-weight: var(--weight-bold);
          cursor: pointer; transition: all 0.15s ease;
          box-shadow: 0 2px 8px rgba(0, 168, 255, 0.4);
        }
        .bank-card__copy-btn:active { transform: scale(0.95); opacity: 0.9; }
        .bank-card__copy-btn.copied {
          background: #10b981; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4);
        }
        .bank-card__bottom {
          display: flex; align-items: flex-end; justify-content: space-between;
          padding-top: 4px; border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        .bank-card__info { display: flex; flex-direction: column; gap: 2px; }
        .bank-card__info--right { align-items: flex-end; }
        .bank-card__val {
          font-size: 13px; font-weight: var(--weight-bold); color: #ffffff;
        }
        .bank-card__val--highlight {
          color: #38bdf8; font-weight: var(--weight-heavy); font-size: 14px;
        }

        .premium-steps {
          display: flex; flex-direction: column; gap: var(--space-2-5);
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: var(--space-4);
        }
        .premium-step { font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.55; }
        .premium-step strong { color: var(--text-primary); }
        .premium-link { color: var(--btn-bg); font-weight: var(--weight-bold); text-decoration: none; }

        .premium-paid {
          display: flex; flex-direction: column; align-items: center; gap: var(--space-3);
          padding: var(--space-6) 0 var(--space-2);
        }
        .premium-paid__ico {
          width: 72px; height: 72px; border-radius: var(--radius-full);
          display: flex; align-items: center; justify-content: center;
          background: var(--success-bg); color: var(--success);
          border: 1px solid rgba(16, 185, 129, 0.3);
          box-shadow: 0 8px 24px rgba(16, 185, 129, 0.2);
        }
        .premium-paid p { font-size: var(--text-md); font-weight: var(--weight-heavy); }
        .premium-paid .btn-primary { width: 100%; }
      `}</style>
    </div>
  );
}

