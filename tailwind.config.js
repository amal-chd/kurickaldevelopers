/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
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
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)',
      },
    },
  },
  plugins: [],
}
