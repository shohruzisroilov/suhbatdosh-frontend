import { useState, useEffect, useRef } from 'react';
import { useT, useLang } from '../i18n';
import { getPremiumPlans, createStarsInvoice, getMe } from '../api/endpoints';
import useAppStore from '../store/useAppStore';
import { notifyHaptic, tapHaptic } from '../utils/haptics';
import { ArrowLeft, ArrowRight, Star, Zap, Check, PartyPopper } from 'lucide-react';

const AMOUNT_BY_LANG: Record<string, string> = { uz: "25 000 so'm", ru: '25 000 сум', en: "25 000 so'm" };

export default function Premium() {
  const t = useT();
  const lang = useLang();
  const { setUser, navigate, screenParams } = useAppStore();
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
          <span className="premium-star"><Star size={26} fill="currentColor" strokeWidth={0} /></span>
          <h2>{t('pm.title')}</h2>
          <p>{t('pm.subtitle')}</p>
        </div>

        {paid ? (
          <div className="premium-paid">
            <span className="premium-paid__ico"><PartyPopper size={26} /></span>
            <p>{t('pm.paid')}</p>
            <button className="btn-primary" onClick={back}>{t('common.goBack')}</button>
          </div>
        ) : (
          <>
            <div className="premium-compare">
              <div className="premium-compare__col">
                <p className="premium-compare__head">{t('pm.freeTitle')}</p>
                <p className="premium-compare__line">{t('pm.freeLine1')}</p>
                <p className="premium-compare__line">{t('pm.freeLine2')}</p>
              </div>
              <div className="premium-compare__col premium-compare__col--pro">
                <p className="premium-compare__head"><Star size={11} fill="currentColor" strokeWidth={0} /> {t('pm.proTitle')}</p>
                <p className="premium-compare__line"><Check size={13} strokeWidth={3} />{t('pm.proLine1')}</p>
                <p className="premium-compare__line"><Check size={13} strokeWidth={3} />{t('pm.proLine2')}</p>
                <p className="premium-compare__line"><Check size={13} strokeWidth={3} />{t('pm.proLine3')}</p>
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

            <div className="premium-card">
              <div className="premium-row">
                <span>{t('pm.cardNumber')}</span>
                <button className="premium-copy" onClick={handleCopy}>
                  {copied ? t('pm.copied') : '9860 1901 1079 9466'}
                </button>
              </div>
              <div className="premium-row">
                <span>{t('pm.name')}</span>
                <span className="premium-val">Shohruz Isroilov</span>
              </div>
              <div className="premium-row">
                <span>{t('pm.amount')}</span>
                <span className="premium-val">{amount}</span>
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

        .premium-compare {
          display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2);
        }
        .premium-compare__col {
          display: flex; flex-direction: column; gap: 4px;
          padding: var(--space-3); border-radius: var(--radius-md);
          background: var(--bg-secondary); border: 1px solid var(--border);
        }
        .premium-compare__col--pro { border-color: var(--btn-bg); }
        .premium-compare__head {
          display: flex; align-items: center; gap: 4px;
          font-size: var(--text-xs); font-weight: var(--weight-bold);
          text-transform: uppercase; letter-spacing: 0.4px;
          color: var(--text-secondary); margin-bottom: 2px;
        }
        .premium-compare__col--pro .premium-compare__head { color: var(--btn-bg); }
        .premium-compare__line {
          display: flex; align-items: flex-start; gap: var(--space-1-5);
          font-size: var(--text-sm); line-height: 1.4; color: var(--text-primary);
        }
        .premium-compare__col--pro .premium-compare__line svg {
          flex-shrink: 0; margin-top: 3px; color: var(--btn-bg);
        }
        .premium-paid__ico {
          width: 62px; height: 62px; border-radius: var(--radius-full);
          display: flex; align-items: center; justify-content: center;
          background: var(--success-bg); color: var(--success);
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
          font-size: var(--text-md); transition: opacity var(--t);
        }
        .premium-back:active { opacity: 0.6; }
        .premium-topbar-title { font-size: var(--text-md); font-weight: var(--weight-bold); }

        .premium-scroll {
          flex: 1; overflow-y: auto;
          padding: var(--space-4) var(--space-5) calc(var(--space-5) + env(safe-area-inset-bottom, 0px));
          display: flex; flex-direction: column; gap: var(--space-4);
          -webkit-overflow-scrolling: touch;
        }

        .premium-hero {
          display: flex; flex-direction: column; align-items: center;
          gap: var(--space-1); padding: var(--space-2) 0 0;
        }
        .premium-star { font-size: 44px; }
        .premium-hero h2 { font-size: var(--text-lg); font-weight: var(--weight-heavy); letter-spacing: -0.5px; }
        .premium-hero p  { font-size: var(--text-sm); color: var(--text-secondary); text-align: center; }

        .premium-stars { display: flex; flex-direction: column; gap: var(--space-2); }
        .premium-stars-head { display: flex; flex-direction: column; gap: var(--space-0-5); padding: 0 var(--space-0-5); }
        .premium-stars-title { font-size: var(--text-base); font-weight: var(--weight-heavy); }
        .premium-stars-sub { font-size: var(--text-sm); color: var(--text-secondary); }
        .premium-plan {
          display: flex; align-items: center; justify-content: space-between;
          width: 100%; padding: var(--space-4) var(--space-4);
          background: var(--bg-secondary);
          border: 1.5px solid var(--border);
          border-radius: var(--radius-md);
          transition: opacity var(--t), transform var(--t);
        }
        .premium-plan:active:not(:disabled) { transform: scale(0.98); opacity: 0.85; }
        .premium-plan:disabled { opacity: 0.5; }
        .premium-plan--best { border-color: var(--btn-bg); }
        .premium-plan--skel { min-height: 52px; opacity: 0.4; }
        .premium-plan-left { display: flex; align-items: center; gap: var(--space-2); }
        .premium-plan-months { font-size: var(--text-base); font-weight: var(--weight-bold); }
        .premium-plan-badge {
          font-size: var(--text-xs); font-weight: var(--weight-heavy); letter-spacing: 0.2px;
          padding: var(--space-0-5) var(--space-1-5); border-radius: 999px;
          background: var(--btn-bg); color: var(--btn-text);
        }
        .premium-plan-price { font-size: var(--text-base); font-weight: var(--weight-heavy); color: var(--rating); white-space: nowrap; }

        .premium-divider {
          display: flex; align-items: center; text-align: center;
          color: var(--text-secondary); font-size: var(--text-sm); gap: var(--space-3);
        }
        .premium-divider::before, .premium-divider::after {
          content: ''; flex: 1; height: 1px; background: var(--border);
        }

        .premium-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: var(--space-1) 0; display: flex; flex-direction: column;
        }
        .premium-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: var(--space-3) var(--space-4); font-size: var(--text-base);
          border-bottom: 1px solid var(--border);
        }
        .premium-row:last-child { border-bottom: none; }
        .premium-row span:first-child { color: var(--text-secondary); }
        .premium-val  { font-weight: var(--weight-bold); }
        .premium-copy {
          font-weight: var(--weight-bold); color: var(--btn-bg);
          font-size: var(--text-base); transition: opacity var(--t);
        }
        .premium-copy:active { opacity: 0.6; }
        .premium-steps {
          display: flex; flex-direction: column; gap: var(--space-2);
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: var(--space-4) var(--space-4);
        }
        .premium-step { font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.5; }
        .premium-step strong { color: var(--text-primary); }
        .premium-link { color: var(--btn-bg); font-weight: var(--weight-bold); text-decoration: none; }

        .premium-paid {
          display: flex; flex-direction: column; align-items: center; gap: var(--space-3);
          padding: var(--space-6) 0 var(--space-2);
        }
        .premium-paid span { font-size: 48px; }
        .premium-paid p { font-size: var(--text-md); font-weight: var(--weight-heavy); }
        .premium-paid .btn-primary { width: 100%; }
      `}</style>
    </div>
  );
}
