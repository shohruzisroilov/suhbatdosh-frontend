import * as React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98]';

    const variants = {
      default: 'bg-[var(--primary)] text-[var(--primary-contrast)] shadow-md hover:bg-[var(--primary-hover)] active:bg-[var(--primary-active)]',
      destructive: 'bg-[var(--error)] text-white shadow-sm hover:opacity-90 active:opacity-100',
      outline: 'border border-[var(--border-strong)] bg-transparent hover:bg-[var(--surface-2)] text-[var(--text-primary)]',
      secondary: 'bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--surface-2)]',
      ghost: 'hover:bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
      link: 'text-[var(--primary)] underline-offset-4 hover:underline',
    };

    // 44px (h-11) is the minimum comfortable touch target. `sm` stays at 36px
    // because it is only used inline inside larger tappable rows, never as a
    // standalone control.
    const sizes = {
      default: 'h-11 px-4 py-2',
      sm: 'h-9 rounded-lg px-3 text-xs',
      lg: 'h-12 rounded-xl px-8 text-base',
      icon: 'h-11 w-11 p-0',
    };

    return (
      <button
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
