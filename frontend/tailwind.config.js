/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: '#7C3AED',
          pink: '#EC4899',
          orange: '#F97316',
          violet: '#8B5CF6',
          fuchsia: '#D946EF',
        }
      }
    },
  },
  plugins: [],
}
