/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
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
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '20px',
        '4xl': '24px',
      },
      boxShadow: {
        'brand': '0 4px 24px rgba(124, 92, 252, 0.08)',
        'brand-md': '0 8px 32px rgba(124, 92, 252, 0.12)',
        'brand-lg': '0 12px 48px rgba(124, 92, 252, 0.16)',
        'brand-glow': '0 0 40px rgba(124, 92, 252, 0.25)',
      },
    },
  },
  plugins: [],
}
