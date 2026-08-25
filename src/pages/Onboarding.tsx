import React, { useState } from 'react';
import { Users, GraduationCap, Check, Loader2 } from 'lucide-react';
import { updateMe } from '../api/endpoints';
import useAppStore from '../store/useAppStore';
import { useT } from '../i18n';
import { tapHaptic, selectionHaptic } from '../utils/haptics';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';

const LEVELS = [1, 2, 3, 4, 5, 6];

const GENDERS = [
  { v: 'female', key: 'gender.female' },
  { v: 'male', key: 'gender.male' },
  { v: 'skip', key: 'gender.notSay' },
];

export default function Onboarding() {
  const { setUser, navigate } = useAppStore();
  const t = useT();
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

  async function handleStart() {
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
      <div className="flex-1 overflow-y-auto p-5 space-y-6 pt-12">
        <div className="space-y-2">
          <h1 className="text-xl font-black tracking-tight leading-tight whitespace-pre-line">
            {t('ob.welcome.title')}
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">{t('ob.welcome.sub')}</p>
        </div>

        {/* Feature Highlights */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-[var(--btn-bg-soft)] text-[var(--btn-bg)] shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
              <b className="block text-sm text-[var(--text-primary)] font-bold">{t('ob.feature1.title')}</b>
              {t('ob.feature1.sub')}
            </div>
          </div>
        </div>

        {/* Level Selector */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-[var(--text-secondary)] px-1">{t('ob.chooseLevel')}</p>
          <div className="space-y-2">
            {LEVELS.map((n) => {
              const active = level === n;
              return (
                <Card
                  key={n}
                  onClick={() => pickLevel(n)}
                  className={`p-3.5 cursor-pointer transition-all active:scale-[0.99] border ${
                    active ? 'border-[var(--btn-bg)] bg-[var(--bg-secondary)]' : 'border-[var(--border)] bg-[var(--bg)]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 text-center text-sm font-black text-[var(--btn-bg)] font-mono">
                      {t(`level.${n}`)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate">{t(`levelName.${n}`)}</div>
                      <div className="text-xs text-[var(--text-secondary)] truncate">{t(`ob.level${n}.sub`)}</div>
                    </div>
                    <div
                      className={`h-5 w-5 rounded-full border flex items-center justify-center transition-colors ${
                        active
                          ? 'bg-[var(--btn-bg)] border-[var(--btn-bg)] text-[var(--btn-text)]'
                          : 'border-[var(--border-strong)]'
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

        {/* Gender Selector */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-[var(--text-secondary)] px-1">{t('ob.chooseGender')}</p>
          <p className="text-xs text-[var(--text-secondary)] px-1">{t('ob.chooseGenderSub')}</p>
          <div className="flex flex-wrap gap-2">
            {GENDERS.map((g) => {
              const active = gender === g.v;
              return (
                <button
                  key={g.v}
                  type="button"
                  onClick={() => pickGender(g.v)}
                  className={`flex-1 min-w-[100px] min-h-[44px] px-3 py-2 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
                    active
                      ? 'border-[var(--btn-bg)] bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                      : 'border-[var(--border)] bg-[var(--bg)] text-[var(--text-secondary)]'
                  }`}
                >
                  {t(g.key)}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-[var(--danger)] text-center">
            {error}
          </div>
        )}
      </div>

      <div className="p-4 pb-8 border-t border-[var(--border)] shrink-0">
        <Button onClick={handleStart} disabled={loading} className="w-full" size="lg">
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {loading ? t('ob.saving') : t('ob.start')}
        </Button>
      </div>
    </div>
  );
}
