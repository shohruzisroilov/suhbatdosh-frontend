import React, { useState } from 'react';
import { Check, Loader2, ArrowLeft, ArrowRight, User, UserRound, Users } from 'lucide-react';
import { updateMe } from '../api/endpoints';
import useAppStore from '../store/useAppStore';
import { useT } from '../i18n';
import { tapHaptic, selectionHaptic } from '../utils/haptics';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';

const LEVELS = [1, 2, 3, 4, 5, 6];

const GENDERS = [
  { v: 'male', key: 'gender.male', Icon: User },
  { v: 'female', key: 'gender.female', Icon: UserRound },
  { v: 'skip', key: 'gender.notSay', Icon: Users },
];

export default function Onboarding() {
  const { setUser, navigate } = useAppStore();
  const t = useT();

  const [step, setStep] = useState<1 | 2>(1);
  const [level, setLevel] = useState(1);
  const [gender, setGender] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function pickLevel(n: number) {
    selectionHaptic();
    setLevel(n);
  }

  function pickGender(v: string) {
    selectionHaptic();
    setGender(v);
  }

  function handleNextStep() {
    tapHaptic('medium');
    setStep(2);
  }

  function handlePrevStep() {
    tapHaptic('light');
    setStep(1);
  }

  async function handleFinish() {
    tapHaptic('medium');
    setLoading(true);
    setError('');
    try {
      const payload: { level: number; gender?: string } = { level };
      if (gender === 'male' || gender === 'female') payload.gender = gender;

      const result = await updateMe(payload);
      setUser(result.user);
      navigate('home');
    } catch (e: any) {
      setError(e.response?.data?.error || t('ob.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg)] text-[var(--text-primary)] overflow-hidden">
      {/* Top Bar with Step Indicators */}
      <div className="p-4 pt-10 border-b border-[var(--border)] shrink-0 flex items-center justify-between">
        {step === 2 ? (
          <Button variant="ghost" size="icon" className="rounded-full text-[var(--text-primary)]" onClick={handlePrevStep} aria-label={t('common.goBack')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        ) : (
          <div className="w-11" />
        )}
        <div className="flex items-center gap-2">
          <span className={`h-2 rounded-full transition-all duration-300 ${step === 1 ? 'w-6 bg-[var(--primary)]' : 'w-2 bg-[var(--border-strong)]'}`} />
          <span className={`h-2 rounded-full transition-all duration-300 ${step === 2 ? 'w-6 bg-[var(--primary)]' : 'w-2 bg-[var(--border-strong)]'}`} />
        </div>
        <span className="text-xs font-bold text-[var(--text-secondary)] w-11 text-right font-mono">{step}/2</span>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Step 1: English Level Selection */}
        {step === 1 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="space-y-1.5">
              <h1 id="ob-level-heading" className="text-xl font-black tracking-tight leading-tight">
                {t('ob.chooseLevel')}
              </h1>
              <p className="text-xs text-[var(--text-secondary)]">{t('ob.welcome.sub')}</p>
            </div>

            <div className="space-y-2" role="radiogroup" aria-labelledby="ob-level-heading">
              {LEVELS.map((n) => {
                const active = level === n;
                return (
                  <Card
                    key={n}
                    as="button"
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => pickLevel(n)}
                    className={`w-full text-left p-3.5 cursor-pointer transition-all active:scale-[0.99] border rounded-2xl ${
                      active ? 'border-[var(--primary)] bg-[var(--primary-subtle)] shadow-sm' : 'border-[var(--border)] bg-[var(--bg-secondary)]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 text-center text-sm font-black text-[var(--primary)] font-mono">
                        {t(`level.${n}`)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{t(`levelName.${n}`)}</div>
                        <div className="text-xs text-[var(--text-secondary)] truncate">{t(`ob.level${n}.sub`)}</div>
                      </div>
                      <div
                        className={`h-5 w-5 rounded-full border flex items-center justify-center transition-colors ${
                          active
                            ? 'bg-[var(--primary)] border-[var(--primary)] text-[#FFFFFF]'
                            : 'border-[var(--border)]'
                        }`}
                      >
                        {active && <Check className="h-3 w-3" strokeWidth={3} />}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Gender Preference Selection */}
        {step === 2 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="space-y-1.5">
              <h1 id="ob-gender-heading" className="text-xl font-black tracking-tight leading-tight">
                {t('ob.chooseGender')}
              </h1>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{t('ob.chooseGenderSub')}</p>
            </div>

            <div className="space-y-3" role="radiogroup" aria-labelledby="ob-gender-heading">
              {GENDERS.map((g) => {
                const active = gender === g.v;
                return (
                  <Card
                    key={g.v}
                    as="button"
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => pickGender(g.v)}
                    className={`w-full text-left p-4 cursor-pointer transition-all active:scale-[0.99] border rounded-2xl ${
                      active ? 'border-[var(--primary)] bg-[var(--primary-subtle)] shadow-sm' : 'border-[var(--border)] bg-[var(--bg-secondary)]'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--surface-2)] text-[var(--text-secondary)]">
                        <g.Icon size={18} aria-hidden="true" />
                      </span>
                      <span className="text-sm font-bold flex-1 text-[var(--text-primary)]">{t(g.key)}</span>
                      <div
                        className={`h-5 w-5 rounded-full border flex items-center justify-center transition-colors ${
                          active
                            ? 'bg-[var(--primary)] border-[var(--primary)] text-[#FFFFFF]'
                            : 'border-[var(--border)]'
                        }`}
                      >
                        {active && <Check className="h-3 w-3" strokeWidth={3} />}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-[var(--danger)] text-center">
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="p-4 pb-8 border-t border-[var(--border)] shrink-0 bg-[var(--bg)]">
        {step === 1 ? (
          <Button onClick={handleNextStep} className="w-full font-bold" size="lg">
            <span>{t('common.next')}</span>
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleFinish} disabled={loading} className="w-full font-bold" size="lg">
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {loading ? t('ob.saving') : t('ob.start')}
          </Button>
        )}
      </div>
    </div>
  );
}
