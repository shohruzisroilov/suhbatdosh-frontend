import { useState } from 'react';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';
import { useQuery } from '@tanstack/react-query';
import { getReviews } from '../api/endpoints';
import useAppStore from '../store/useAppStore';
import { useT } from '../i18n';
import { selectionHaptic } from '../utils/haptics';
import Avatar from '../components/Avatar';
import SkeletonRow from '../components/SkeletonRow';
import { ArrowLeft, Star } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';

function timeAgo(dateStr: string, t: any) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return t('time.justNow');
  if (diff < 3600) return t('time.minAgo', { n: Math.floor(diff / 60) });
  if (diff < 86400) return t('time.hourAgo', { n: Math.floor(diff / 3600) });
  const d = Math.floor(diff / 86400);
  if (d < 7) return t('time.dayAgo', { n: d });
  return new Date(dateStr).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function Stars({
  value,
  onChange,
  readonly = false,
  size = 28,
}: {
  value: number;
  onChange?: (val: number) => void;
  readonly?: boolean;
  size?: number;
}) {
  const [hov, setHov] = useState(0);
  const active = readonly ? value : hov || value;
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          disabled={readonly}
          onClick={readonly ? undefined : () => { selectionHaptic(); onChange?.(s); }}
          onMouseEnter={readonly ? undefined : () => setHov(s)}
          onMouseLeave={readonly ? undefined : () => setHov(0)}
          className="text-amber-400 transition-transform active:scale-90 disabled:cursor-default"
        >
          <Star size={size} fill={active >= s ? 'currentColor' : 'none'} strokeWidth={1.75} />
        </button>
      ))}
    </div>
  );
}

function RatingBar({ label, count, total }: { label: number; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
      <span className="w-3 text-right font-mono font-medium">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
        <div className="h-full bg-amber-400 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-5 text-left font-mono">{count}</span>
    </div>
  );
}

export default function Reviews() {
  const t = useT();
  const { navigate, screenParams } = useAppStore();

  useTelegramBackButton(() => navigate(screenParams?.from || 'profile'));

  // TanStack Query for Reviews list
  const { data: reviewsData, isLoading: reviewsLoading } = useQuery({
    queryKey: ['reviews'],
    queryFn: () => getReviews(1),
  });

  const reviews = reviewsData?.reviews || [];
  const stats = reviewsData?.stats || null;

  return (
    <div className="flex flex-col h-full bg-[var(--bg)] text-[var(--text-primary)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pt-[calc(12px+env(safe-area-inset-top,0px))] border-b border-[var(--border)] shrink-0 bg-[var(--chrome-bg)] backdrop-blur-md">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(screenParams?.from || 'profile')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-base font-bold">{t('rm.title')}</h1>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-[calc(40px+env(safe-area-inset-bottom,0px))]">
        {/* Stats summary */}
        {stats && stats.total > 0 && (
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex flex-col items-center gap-1 min-w-[64px]">
                <span className="text-2xl font-black">{stats.avg_rating}</span>
                <Stars value={Math.round(Number(stats.avg_rating))} readonly size={14} />
                <span className="text-[10px] text-[var(--text-secondary)]">{stats.total} {t('rm.reviews')}</span>
              </div>
              <div className="flex-1 space-y-1">
                {[5, 4, 3, 2, 1].map((n) => (
                  <RatingBar
                    key={n}
                    label={n}
                    count={stats[`${['one', 'two', 'three', 'four', 'five'][n - 1]}_star`]}
                    total={stats.total}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* All reviews list */}
        <div className="space-y-3">
          <div className="space-y-3">
            {reviewsLoading ? (
              [0, 1, 2, 3].map((i) => <SkeletonRow key={i} avatar={32} />)
            ) : reviews.length === 0 ? (
              <div className="text-center text-xs text-[var(--text-secondary)] py-10">
                {t('rm.noReviews')}
              </div>
            ) : (
              reviews.map((r: any) => (
                <Card key={r.id} className="p-3.5 space-y-2">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.display_name} size={32} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold truncate">{r.display_name || t('common.anonymous')}</div>
                      <div className="text-[10px] text-[var(--text-secondary)]">{timeAgo(r.created_at, t)}</div>
                    </div>
                    <Stars value={r.rating} readonly size={12} />
                  </div>
                  {r.comment && (
                    <p className="text-xs text-[var(--text-primary)] leading-relaxed pl-11">
                      "{r.comment}"
                    </p>
                  )}
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
