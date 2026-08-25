import * as React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const base =
    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2';
  const variants = {
    default: 'bg-[var(--btn-bg-soft)] text-[var(--btn-bg)] border border-[var(--btn-bg)]/20',
    secondary: 'bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)]',
    destructive: 'bg-[var(--danger-bg)] text-[var(--danger)] border border-[var(--danger)]/20',
    outline: 'border border-[var(--border-strong)] text-[var(--text-secondary)]',
    success: 'bg-[var(--success-bg)] text-[var(--success)] border border-[var(--success)]/20',
    warning: 'bg-[var(--warning-bg)] text-[var(--warning)] border border-[var(--warning)]/20',
  };

  return <div className={cn(base, variants[variant], className)} {...props} />;
}

export { Badge };
