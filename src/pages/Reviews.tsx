import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getReviews, getMyReview, submitReview } from '../api/endpoints';
import useAppStore from '../store/useAppStore';
import { useT } from '../i18n';
import { selectionHaptic, tapHaptic } from '../utils/haptics';
import Avatar from '../components/Avatar';
import SkeletonRow from '../components/SkeletonRow';
import { ArrowLeft, PartyPopper, Star, Send, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

const reviewSchema = z.object({
  rating: z.number().min(1, 'Iltimos, kamida 1 yulduz tanlang').max(5),
  comment: z.string().max(500, 'Sharh 500 belgidan oshmasligi kerak').optional(),
});

type ReviewFormData = z.infer<typeof reviewSchema>;

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
  const queryClient = useQueryClient();
  const { navigate } = useAppStore();
  const [tab, setTab] = useState<'all' | 'write'>('all');
  const [submitted, setSubmitted] = useState(false);

  const STAR_LABELS = ['', t('rm.rate.1'), t('rm.rate.2'), t('rm.rate.3'), t('rm.rate.4'), t('rm.rate.5')];

  // TanStack Query for Reviews list
  const { data: reviewsData, isLoading: reviewsLoading } = useQuery({
    queryKey: ['reviews'],
    queryFn: () => getReviews(1),
  });

  // TanStack Query for My Review
  const { data: myReviewData } = useQuery({
    queryKey: ['myReview'],
    queryFn: () => getMyReview(),
  });

  const myReview = myReviewData?.review || null;
  const reviews = reviewsData?.reviews || [];
  const stats = reviewsData?.stats || null;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ReviewFormData>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: myReview?.rating || 0,
      comment: myReview?.comment || '',
    },
  });

  const selectedRating = watch('rating');
  const currentComment = watch('comment') || '';

  // Mutation for submitting review
  const submitMutation = useMutation({
    mutationFn: (data: ReviewFormData) => submitReview(data.rating, data.comment?.trim() || ''),
    onSuccess: () => {
      tapHaptic('medium');
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['myReview'] });
      setTimeout(() => {
        setSubmitted(false);
        setTab('all');
      }, 1200);
    },
  });

  const onFormSubmit = (data: ReviewFormData) => {
    submitMutation.mutate(data);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg)] text-[var(--text-primary)] overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-3 p-4 pt-3 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate('profile')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-base font-bold">{t('rm.title')}</h1>
          <div className="w-10" />
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl bg-[var(--bg-secondary)] p-1 gap-1 border border-[var(--border)]">
          <button
            type="button"
            onClick={() => { selectionHaptic(); setTab('all'); }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              tab === 'all' ? 'bg-[var(--bg)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'
            }`}
          >
            {t('rm.all')} {stats?.total ? `(${stats.total})` : ''}
          </button>
          <button
            type="button"
            onClick={() => { selectionHaptic(); setTab('write'); }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              tab === 'write' ? 'bg-[var(--bg)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'
            }`}
          >
            {myReview ? t('rm.edit') : t('rm.write')}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Stats summary on "all" tab */}
        {stats && stats.total > 0 && tab === 'all' && (
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

        {/* Tab: Write Review */}
        {tab === 'write' && (
          <Card className="p-5">
            {submitted ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <PartyPopper className="h-10 w-10 text-amber-400" />
                <p className="font-bold text-sm text-center">{t('rm.thanks')}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onFormSubmit)} className="flex flex-col items-center space-y-4">
                {myReview && !myReview.is_approved && (
                  <Badge variant="warning" className="w-full justify-center">
                    {t('rm.pending')}
                  </Badge>
                )}
                <p className="text-sm text-[var(--text-secondary)] text-center">
                  {myReview ? t('rm.update') : t('rm.howRate')}
                </p>

                <Stars value={selectedRating} onChange={(val) => setValue('rating', val)} size={32} />
                {errors.rating && <p className="text-xs text-[var(--danger)]">{errors.rating.message}</p>}

                {selectedRating > 0 && (
                  <span className="text-xs font-bold text-amber-400">{STAR_LABELS[selectedRating]}</span>
                )}

                <div className="w-full space-y-1">
                  <textarea
                    {...register('comment')}
                    placeholder={t('rm.placeholder')}
                    maxLength={500}
                    rows={4}
                    className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)] p-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--btn-bg)]"
                  />
                  <div className="text-right text-[10px] text-[var(--text-secondary)]">
                    {currentComment.length}/500
                  </div>
                  {errors.comment && <p className="text-xs text-[var(--danger)]">{errors.comment.message}</p>}
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={submitMutation.isPending || !selectedRating}>
                  {submitMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  {myReview ? t('rm.updateBtn') : t('rm.submit')}
                </Button>
              </form>
            )}
          </Card>
        )}

        {/* CTA — if not rated yet */}
        {tab === 'all' && !reviewsLoading && !myReview && (
          <Card
            className="p-4 border-[var(--btn-bg)] cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
            onClick={() => { selectionHaptic(); setTab('write'); }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold">{t('rm.notRated')}</div>
                <div className="text-xs text-[var(--text-secondary)]">{t('rm.howRate')}</div>
              </div>
              <Button size="sm">{t('rm.notRatedCta')}</Button>
            </div>
          </Card>
        )}

        {/* Tab: All reviews list */}
        {tab === 'all' && (
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
        )}
      </div>
    </div>
  );
}
