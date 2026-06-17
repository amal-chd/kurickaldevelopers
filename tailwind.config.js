/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand — deep navy (numbered scale preserved for existing hover states)
        primary: {
          DEFAULT: '#1A3A5C',
          50: '#E8EFF6',
          100: '#C5D6E8',
          200: '#9EBDD9',
          300: '#77A4CA',
          400: '#508BBB',
          500: '#1A3A5C',
          600: '#163250',
          700: '#122944',
          800: '#0E2138',
          900: '#0A182C',
        },
        // Accent — warm amber
        accent: {
          DEFAULT: '#F59E0B',
          50: '#FEF9EE',
          100: '#FDF0CE',
          200: '#FAE09D',
          300: '#F8D06C',
          400: '#F6C03B',
          500: '#F59E0B',
          600: '#D48909',
          700: '#B37407',
          800: '#925F05',
          900: '#714A04',
        },
        // Semantic scales for consistent status colours across the app
        success: {
          DEFAULT: '#059669',
          50: '#ECFDF5', 100: '#D1FAE5', 200: '#A7F3D0', 500: '#10B981',
          600: '#059669', 700: '#047857',
        },
        warning: {
          DEFAULT: '#D97706',
          50: '#FFFBEB', 100: '#FEF3C7', 200: '#FDE68A', 500: '#F59E0B',
          600: '#D97706', 700: '#B45309',
        },
        danger: {
          DEFAULT: '#DC2626',
          50: '#FEF2F2', 100: '#FEE2E2', 200: '#FECACA', 500: '#EF4444',
          600: '#DC2626', 700: '#B91C1C',
        },
        info: {
          DEFAULT: '#2563EB',
          50: '#EFF6FF', 100: '#DBEAFE', 200: '#BFDBFE', 500: '#3B82F6',
          600: '#2563EB', 700: '#1D4ED8',
        },
        // Neutral surface tokens
        surface: '#FFFFFF',
        canvas: '#F7F8FA',
        line: '#EAECF0',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      letterSpacing: {
        tightest: '-0.03em',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        // Slate-tinted, layered, premium-soft shadows (override Tailwind defaults)
        xs: '0 1px 2px 0 rgb(16 24 40 / 0.04)',
        sm: '0 1px 3px 0 rgb(16 24 40 / 0.06), 0 1px 2px -1px rgb(16 24 40 / 0.05)',
        DEFAULT: '0 1px 3px 0 rgb(16 24 40 / 0.06), 0 1px 2px -1px rgb(16 24 40 / 0.05)',
        md: '0 4px 8px -2px rgb(16 24 40 / 0.08), 0 2px 4px -2px rgb(16 24 40 / 0.04)',
        lg: '0 12px 16px -4px rgb(16 24 40 / 0.08), 0 4px 6px -2px rgb(16 24 40 / 0.03)',
        xl: '0 20px 24px -4px rgb(16 24 40 / 0.10), 0 8px 8px -4px rgb(16 24 40 / 0.04)',
        '2xl': '0 24px 48px -12px rgb(16 24 40 / 0.18)',
        card: '0 1px 3px 0 rgb(16 24 40 / 0.06), 0 1px 2px -1px rgb(16 24 40 / 0.05)',
        'card-hover': '0 8px 24px -6px rgb(16 24 40 / 0.12), 0 4px 8px -4px rgb(16 24 40 / 0.06)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out both',
        'scale-in': 'scale-in 0.18s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-up': 'slide-up 0.25s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
}
