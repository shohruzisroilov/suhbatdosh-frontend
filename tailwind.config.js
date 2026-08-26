/** @type {import('tailwindcss').Config} */

/*
 * Colours are wired to the CSS custom properties in src/styles/global.css, which is
 * the single source of truth for the palette (and the only place light mode is
 * defined).
 *
 * The previous config mapped shadcn's default names to `hsl(var(--background))`,
 * `hsl(var(--primary))` and so on — none of which exist in global.css. Every one of
 * those utilities resolved to an invalid colour, so `bg-card` or `text-primary`
 * silently rendered as nothing. Components worked around it by writing
 * `bg-[var(--bg-secondary)]` inline, which is why the codebase ended up with two
 * ways of saying the same thing.
 *
 * These names now match the real variables, so `bg-surface` and
 * `bg-[var(--bg-secondary)]` are the same colour, and the short form is the one to
 * reach for.
 */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--bg-secondary)',
        'surface-2': 'var(--surface-2)',
        'surface-3': 'var(--surface-3)',
        chrome: 'var(--chrome-bg)',

        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',

        content: {
          DEFAULT: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
        },

        brand: {
          DEFAULT: 'var(--btn-bg)',
          hover: 'var(--btn-bg-hover)',
          soft: 'var(--btn-bg-soft)',
          foreground: 'var(--btn-text)',
        },

        accent: {
          DEFAULT: 'var(--accent)',
          soft: 'var(--accent-bg)',
        },
        success: {
          DEFAULT: 'var(--success)',
          soft: 'var(--success-bg)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          soft: 'var(--warning-bg)',
        },
        danger: {
          DEFAULT: 'var(--danger)',
          soft: 'var(--danger-bg)',
        },
        rating: {
          DEFAULT: 'var(--rating)',
          soft: 'var(--rating-bg)',
        },
      },

      fontFamily: {
        sans: 'var(--font-body)',
        display: 'var(--font-display)',
      },

      // Mirrors the --text-* scale. `2xs` is ornament only; 12px is the floor for
      // anything a person has to read.
      fontSize: {
        '2xs': 'var(--text-2xs)',
        xs: 'var(--text-xs)',
        sm: 'var(--text-sm)',
        base: 'var(--text-base)',
        md: 'var(--text-md)',
        lg: 'var(--text-lg)',
        xl: 'var(--text-xl)',
        '2xl': 'var(--text-2xl)',
        '3xl': 'var(--text-3xl)',
      },

      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        full: 'var(--radius-full)',
      },

      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        glow: 'var(--shadow-glow)',
      },

      backgroundImage: {
        'grad-primary': 'var(--grad-primary)',
        'grad-hero': 'var(--grad-hero)',
        'grad-ai': 'var(--grad-ai)',
        'grad-streak': 'var(--grad-streak)',
      },

      transitionTimingFunction: {
        out: 'var(--ease-out)',
        spring: 'var(--ease-spring)',
      },

      // 44px — the minimum comfortable touch target.
      minHeight: { tap: '44px' },
      minWidth: { tap: '44px' },
    },
  },
  plugins: [],
};
