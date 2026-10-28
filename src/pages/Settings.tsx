import React, { useState } from 'react';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';
import { useMutation } from '@tanstack/react-query';
import { updateMe, updateNotifications } from '../api/endpoints';
import useAppStore from '../store/useAppStore';
import { useT } from '../i18n';
import { selectionHaptic, tapHaptic } from '../utils/haptics';
import { ArrowLeft, ChevronRight, Gauge, User, Bell, Check, Loader2, Mic } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { notifyHaptic } from '../utils/haptics';
import MicTestModal from '../components/MicTestModal';

const LEVELS = [{ value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }, { value: 5 }, { value: 6 }];

const GENDERS = [
  { v: 'male', key: 'gender.male' },
  { v: 'female', key: 'gender.female' },
  { v: 'skip', key: 'gender.notSay' },
];

const TITLES: Record<string, string> = {
  menu: 'settings.title',
  level: 'settings.levelTitle',
  gender: 'settings.genderTitle',
  notifications: 'settings.notifTitle',
};

export default function Settings() {
  const { user, setUser, navigate, screenParams, setMicErrorModal } = useAppStore();
  const t = useT();

  useTelegramBackButton(() => back());

  const [section, setSection] = useState<'menu' | 'level' | 'gender' | 'notifications'>('menu');
  const [showMicModal, setShowMicModal] = useState(false);
  const [micStatus, setMicStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');

  const level = user?.level || 1;
  const gender = user?.gender || null;
  const reminders = user?.remindersEnabled !== false;

  // Mutation for updating profile details
  const updateProfileMutation = useMutation({
    mutationFn: (patch: Record<string, any>) => updateMe(patch),
    onSuccess: (data) => {
      if (data?.user) setUser(data.user);
    },
  });

  // Mutation for updating notifications
  const updateNotifMutation = useMutation({
    mutationFn: (prefs: Record<string, any>) => updateNotifications(prefs),
    onSuccess: (data) => {
      if (data?.user) setUser(data.user);
    },
  });

  function pickLevel(v: number) {
    if (!user || v === level) return;
    selectionHaptic();
    setUser({ ...user, level: v }); // optimistic update
    updateProfileMutation.mutate({ level: v });
  }

  function pickGender(v: string) {
    const next = v === 'skip' ? null : v;
    if (!user || next === gender) return;
    selectionHaptic();
    setUser({ ...user, gender: next }); // optimistic update
    updateProfileMutation.mutate({ gender: next ?? '' });
  }

  function toggleNotif(field: string, value: boolean) {
    if (updateNotifMutation.isPending) return;
    selectionHaptic();
    updateNotifMutation.mutate({ [field]: value });
  }

  function back() {
    tapHaptic('light');
    // Step out of a sub-section first, then back to whoever opened Settings.
    if (section !== 'menu') setSection('menu');
    else navigate(screenParams?.from || 'profile');
  }

  async function testMic() {
    if (micStatus === 'testing') return;
    tapHaptic('light');
    setMicStatus('testing');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Unsupported');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      notifyHaptic('success');
      setMicStatus('ok');
      setTimeout(() => setMicStatus('idle'), 3500);
    } catch {
      notifyHaptic('error');
      setMicStatus('fail');
      setMicErrorModal({
        isOpen: true,
        errorMsg: 'Microphone access is needed for live calls. Please grant permission in your device/Telegram settings.',
      });
      setTimeout(() => setMicStatus('idle'), 3500);
    }
  }

  const notifSummary = reminders ? t('settings.notifAllOn') : t('settings.notifNone');

  return (
    <div className="flex flex-col h-full bg-[var(--bg)] text-[var(--text-primary)]">
      {/* Topbar */}
      <div className="flex items-center justify-between p-4 pt-3 border-b border-[var(--border)] shrink-0">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={back}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-base font-bold">{t(TITLES[section])}</h1>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Main Menu */}
        {section === 'menu' && (
          <div className="space-y-3">
            <Card
              as="button"
              type="button"
              className="w-full text-left p-4 cursor-pointer hover:bg-[var(--surface-2)] transition-all active:scale-[0.99] border-[var(--border)]"
              onClick={() => { selectionHaptic(); setSection('level'); }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[var(--primary-subtle)] text-[var(--primary)]">
                  <Gauge className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold">{t('settings.levelTitle')}</div>
                  <div className="text-xs text-[var(--text-secondary)] truncate">
                    {t(`level.${level}`)} · {t(`levelName.${level}`)}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-[var(--text-secondary)]" />
              </div>
            </Card>

            <Card
              as="button"
              type="button"
              className="w-full text-left p-4 cursor-pointer hover:bg-[var(--surface-2)] transition-all active:scale-[0.99] border-[var(--border)]"
              onClick={() => { selectionHaptic(); setSection('gender'); }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[var(--accent-bg)] text-[var(--accent)]">
                  <User className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold">{t('settings.genderTitle')}</div>
                  <div className="text-xs text-[var(--text-secondary)] truncate">
                    {gender ? t(`gender.${gender}`) : t('settings.genderNotSet')}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-[var(--text-secondary)]" />
              </div>
            </Card>

            <Card
              as="button"
              type="button"
              className="w-full text-left p-4 cursor-pointer hover:bg-[var(--surface-2)] transition-all active:scale-[0.99] border-[var(--border)]"
              onClick={() => { selectionHaptic(); setSection('notifications'); }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[var(--success-bg)] text-[var(--success)]">
                  <Bell className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold">{t('settings.notifTitle')}</div>
                  <div className="text-xs text-[var(--text-secondary)] truncate">{notifSummary}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-[var(--text-secondary)]" />
              </div>
            </Card>

            <Card
              as="button"
              type="button"
              className="w-full text-left p-4 cursor-pointer hover:bg-[var(--surface-2)] transition-all active:scale-[0.99] border-[var(--border)]"
              onClick={() => {
                tapHaptic('light');
                setShowMicModal(true);
              }}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl transition-colors ${
                  micStatus === 'ok'
                    ? 'bg-green-500/15 text-green-500'
                    : micStatus === 'fail'
                    ? 'bg-red-500/15 text-red-500'
                    : 'bg-[var(--primary-subtle)] text-[var(--primary)]'
                }`}>
                  {micStatus === 'testing' ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : micStatus === 'ok' ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold">
                    {micStatus === 'ok'
                      ? 'Microphone Ready!'
                      : micStatus === 'testing'
                      ? 'Testing Microphone…'
                      : micStatus === 'fail'
                      ? 'Permission Needed'
                      : 'Audio & Microphone'}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] truncate">
                    {micStatus === 'ok'
                      ? 'Access granted and working'
                      : micStatus === 'fail'
                      ? 'Tap to review permission guide'
                      : 'Tap to test and verify microphone access'}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-[var(--text-secondary)]" />
              </div>
            </Card>
          </div>
        )}

        {/* Level Section */}
        {section === 'level' && (
          <div className="space-y-3">
            <p className="text-xs text-[var(--text-secondary)] px-1">{t('settings.levelSub')}</p>
            <div className="space-y-2">
              {LEVELS.map((lv) => {
                const selected = level === lv.value;
                return (
                  <Card
                    as="button"
                    type="button"
                    role="radio"
                    aria-checked={level === lv.value}
                    key={lv.value}
                    onClick={() => pickLevel(lv.value)}
                    className={`p-4 cursor-pointer transition-all active:scale-[0.98] ${
                      selected ? 'border-[var(--primary)] bg-[var(--surface-2)]' : 'border-[var(--border)] bg-[var(--surface)]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 text-center text-sm font-black text-[var(--primary)] font-mono">
                        {t(`level.${lv.value}`)}
                      </span>
                      <div className="flex-1">
                        <div className="text-sm font-bold">{t(`levelName.${lv.value}`)}</div>
                        <div className="text-xs text-[var(--text-secondary)]">{t(`ob.level${lv.value}.sub`)}</div>
                      </div>
                      <div
                        className={`h-5 w-5 rounded-full border flex items-center justify-center transition-colors ${
                          selected
                            ? 'bg-[var(--primary)] border-[var(--primary)] text-[var(--primary-contrast)]'
                            : 'border-[var(--border-strong)]'
                        }`}
                      >
                        {selected && <Check className="h-3 w-3" />}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Gender Section */}
        {section === 'gender' && (
          <div className="space-y-3">
            <p className="text-xs text-[var(--text-secondary)] px-1">{t('settings.genderSub')}</p>
            <div className="flex flex-wrap gap-2">
              {GENDERS.map((g) => {
                const selected = (g.v === 'skip' ? null : g.v) === gender;
                return (
                  <button
                    key={g.v}
                    type="button"
                    onClick={() => pickGender(g.v)}
                    className={`flex-1 min-w-[120px] min-h-[48px] px-4 py-3 rounded-[var(--radius-md)] border text-xs font-bold transition-all active:scale-95 ${
                      selected
                        ? 'border-[var(--primary)] bg-[var(--primary-subtle)] text-[var(--primary)]'
                        : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {t(g.key)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Notifications Section */}
        {section === 'notifications' && (
          <div className="space-y-3">
            <p className="text-xs text-[var(--text-secondary)] px-1">{t('settings.notifSub')}</p>
            <Card className="p-4 border-[var(--border)] bg-[var(--surface)]">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-bold">{t('settings.notifReminders')}</div>
                  <div className="text-xs text-[var(--text-secondary)]">{t('settings.notifRemindersSub')}</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={reminders}
                  onClick={() => toggleNotif('remindersEnabled', !reminders)}
                  disabled={updateNotifMutation.isPending}
                  className={`w-12 h-7 rounded-full transition-colors relative p-0.5 ${
                    reminders ? 'bg-[var(--primary)]' : 'bg-[var(--surface-3)]'
                  }`}
                >
                  <span
                    className={`block w-6 h-6 rounded-full bg-white transition-transform shadow-md ${
                      reminders ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </Card>
          </div>
        )}
      </div>

      <MicTestModal
        isOpen={showMicModal}
        onClose={() => setShowMicModal(false)}
      />
    </div>
  );
}
