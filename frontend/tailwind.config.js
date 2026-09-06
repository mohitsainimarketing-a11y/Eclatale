import tailwindcssAnimate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
// ESM syntax: package.json declares "type": "module" since the Vite migration.
export default {
  // shadcn/ui components carry `dark:` variants. Class-based (rather than
  // media) keeps dark mode opt-in, so adding these components does not make
  // the existing light-only app react to a visitor's OS setting.
  darkMode: ['class'],
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          purple: '#7C5CFC',
          pink: '#F72585',
          orange: '#FF6B35',
          teal: '#06D6A0',
          blue: '#118AB2',
          dark: '#1A1A2E',
          muted: '#6B7280',
          bg: '#FDF4FF',
        },
        // shadcn/ui token set, driven by the CSS variables in index.css.
        // Purely additive: these are new colour names, so no existing
        // `border-*` / `bg-*` utility changes meaning.
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        // shadcn derives lg/md/sm from --radius. With --radius: 0.5rem these
        // evaluate to 0.5 / 0.375 / 0.25rem — byte-identical to Tailwind's own
        // defaults, so redefining them does NOT shift any existing
        // rounded-lg/md/sm already used across the app. Change --radius and
        // that guarantee goes with it.
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        '2xl': '16px',
        '3xl': '20px',
        '4xl': '24px',
      },
      boxShadow: {
        brand: '0 4px 24px rgba(124, 92, 252, 0.08)',
        'brand-md': '0 8px 32px rgba(124, 92, 252, 0.12)',
        'brand-lg': '0 12px 48px rgba(124, 92, 252, 0.16)',
        'brand-glow': '0 0 40px rgba(124, 92, 252, 0.25)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
