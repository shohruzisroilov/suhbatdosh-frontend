import React, { useEffect, useState } from 'react';
import { getInvite } from '../api/endpoints';
import useAppStore from '../store/useAppStore';
import { useT } from '../i18n';
import { notifyHaptic, tapHaptic } from '../utils/haptics';
import { Gift, Copy, Check, Trophy, Send, Medal, Award } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';

export default function Invite() {
  const t = useT();
  const { invite, setInvite } = useAppStore();
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const loaded = invite !== null;

  useEffect(() => {
    getInvite()
      .then(setInvite)
      .catch(() => {
        if (!invite) setError(t('im.error'));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const link = invite?.referralLink || '';
  const count = invite?.referralCount || 0;
  const weeklyTop = invite?.weeklyTop || [];
  const weeklyCount = invite?.weeklyCount || 0;
  const weeklyRank = invite?.weeklyRank || null;

  function handleShare() {
    if (!link) return;
    tapHaptic('medium');
    const text = t('im.shareText');
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
    const wa = (window as any).Telegram?.WebApp;
    if (wa?.openTelegramLink) {
      wa.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  }

  function handleCopy() {
    if (!link) return;
    try {
      navigator.clipboard?.writeText(link);
    } catch (e) {}
    notifyHaptic('success');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function renderRankBadge(index: number) {
    if (index === 0) return <Trophy className="h-4 w-4 text-amber-400 shrink-0" />;
    if (index === 1) return <Medal className="h-4 w-4 text-slate-300 shrink-0" />;
    if (index === 2) return <Award className="h-4 w-4 text-amber-600 shrink-0" />;
    return <span className="font-mono text-xs font-bold text-[var(--text-secondary)] min-w-[16px] text-center">#{index + 1}</span>;
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg)] text-[var(--text-primary)] overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pt-6">
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-[var(--btn-bg-soft)] text-[var(--btn-bg)] flex items-center justify-center">
            <Gift className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-black tracking-tight">{t('im.title')}</h1>
          <p className="text-xs text-[var(--text-secondary)] max-w-[280px] leading-relaxed">{t('im.subtitle')}</p>
        </div>

        {error && !loaded ? (
          <div className="p-3 rounded-xl bg-red-500/10 text-xs text-[var(--danger)] text-center">{error}</div>
        ) : (
          <>
            {/* Stats */}
            <Card className="p-4 flex items-center justify-around text-center">
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-xl font-black text-[var(--btn-bg)] font-mono">{loaded ? count : '—'}</span>
                <span className="text-xs text-[var(--text-secondary)] font-medium">{t('im.invited')}</span>
              </div>
              <div className="w-px h-7 bg-[var(--border)]" />
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-xl font-black text-[var(--btn-bg)] font-mono">{loaded ? count : '—'}</span>
                <span className="text-xs text-[var(--text-secondary)] font-medium">{t('im.daysEarned')}</span>
              </div>
            </Card>

            {/* Link Box */}
            {loaded && link && (
              <Card
                onClick={handleCopy}
                className="p-3 border-dashed border-[var(--btn-bg)] flex items-center justify-between gap-2 cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
              >
                <span className="text-xs text-[var(--text-secondary)] truncate flex-1 font-mono">{link}</span>
                <Button size="sm" type="button" className="h-8 text-xs font-bold gap-1 shrink-0">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? t('im.copied') : t('im.copy')}</span>
                </Button>
              </Card>
            )}

            {/* Weekly Contest */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <Trophy className="h-4 w-4 text-amber-400" />
                  <span>{t('im.contestTitle')}</span>
                </div>
                <span className="text-[10px] text-[var(--text-secondary)]">{t('im.contestResets')}</span>
              </div>

              <div className="space-y-2">
                {weeklyTop.length ? (
                  weeklyTop.map((u: any, i: number) => (
                    <div
                      key={u.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]"
                    >
                      <div className="w-6 flex items-center justify-center">{renderRankBadge(i)}</div>
                      <span className="flex-1 text-xs font-semibold truncate">{u.name}</span>
                      <span className="text-xs font-bold text-[var(--btn-bg)] font-mono">
                        {u.count} {u.count === 1 ? t('im.contestFriend') : t('im.contestFriends')}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[var(--text-secondary)] italic text-center py-2">
                    {t('im.contestEmpty')}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] pt-2 border-t border-[var(--border)]">
                <span>{t('im.contestYou')}</span>
                <strong className="text-[var(--text-primary)] font-bold">
                  {weeklyCount > 0
                    ? `${weeklyCount} ${weeklyCount === 1 ? t('im.contestFriend') : t('im.contestFriends')} (${t('im.contestRank').replace('{rank}', String(weeklyRank))})`
                    : t('im.contestNone')}
                </strong>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* CTA */}
      <div className="p-4 pb-8 border-t border-[var(--border)] shrink-0">
        <Button onClick={handleShare} disabled={!loaded || !link} className="w-full" size="lg">
          <Send className="h-4 w-4 mr-2" />
          <span>{t('im.share')}</span>
        </Button>
      </div>
    </div>
  );
}
