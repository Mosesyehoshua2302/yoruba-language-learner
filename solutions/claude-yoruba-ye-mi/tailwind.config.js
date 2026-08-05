/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        yoruba: ['"Noto Sans"', '"DejaVu Sans"', 'Arial', 'system-ui', 'sans-serif'],
        display: ['ui-serif', 'Georgia', 'Cambria', '"Times New Roman"', 'serif'],
      },
      colors: {
        ink: {
          25: '#fbfaf8',
          50: '#f7f5f1',
          100: '#eeeae3',
          200: '#dcd4c7',
          300: '#bfb29b',
          400: '#978565',
          500: '#786a52',
          600: '#5c5041',
          700: '#453c31',
          800: '#2a2520',
          850: '#1f1b17',
          900: '#17130f',
          950: '#0e0b08',
        },
        forest: {
          50: '#edf9f3',
          100: '#d2f0e1',
          200: '#a6e0c3',
          300: '#6fc9a0',
          400: '#3fac80',
          500: '#238e66',
          600: '#187452',
          700: '#145d43',
          800: '#124a37',
          900: '#103d2e',
          950: '#082018',
        },
        gold: {
          50: '#fdf8ec',
          100: '#f9ecc6',
          200: '#f2d788',
          300: '#eabd4f',
          400: '#dea02c',
          500: '#c2841e',
          600: '#9c6819',
          700: '#7c531a',
          800: '#67451c',
          900: '#583b1c',
        },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(23,19,15,0.04), 0 8px 24px -8px rgba(23,19,15,0.10)',
        'soft-lg': '0 4px 12px rgba(23,19,15,0.06), 0 24px 48px -16px rgba(23,19,15,0.18)',
        glow: '0 0 0 1px rgba(222,160,44,0.4), 0 0 24px rgba(222,160,44,0.35)',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'fade-up': {
          from: { opacity: 0, transform: 'translateY(8px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        'pop-in': {
          '0%': { opacity: 0, transform: 'scale(0.9) translateY(-6px)' },
          '60%': { opacity: 1, transform: 'scale(1.02) translateY(0)' },
          '100%': { opacity: 1, transform: 'scale(1) translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'ring-in': {
          from: { strokeDashoffset: 'var(--ring-from, 283)' },
          to: { strokeDashoffset: 'var(--ring-to, 0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.55 },
        },
        sparkle: {
          '0%': { opacity: 0, transform: 'scale(0.4) translateY(0)' },
          '30%': { opacity: 1 },
          '100%': { opacity: 0, transform: 'scale(1.1) translateY(-18px)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.35s ease-out both',
        'fade-up': 'fade-up 0.4s cubic-bezier(.22,1,.36,1) both',
        'pop-in': 'pop-in 0.42s cubic-bezier(.22,1,.36,1) both',
        shimmer: 'shimmer 2.4s linear infinite',
        'pulse-soft': 'pulse-soft 2.2s ease-in-out infinite',
        sparkle: 'sparkle 0.9s ease-out both',
      },
    },
  },
  plugins: [],
};
