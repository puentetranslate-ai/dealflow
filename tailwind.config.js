/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0c1e35',
          light: '#1a3456',
          dark: '#07121f',
        },
        gold: {
          DEFAULT: '#c9a84c',
          light: '#e2c47a',
          dark: '#a8882e',
        },
        cream: {
          DEFAULT: '#f7f3ec',
          dark: '#ede8e0',
        },
        muted: '#8a9ab5',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'serif'],
      },
      boxShadow: {
        'soft': '0 1px 2px 0 rgb(12 30 53 / 0.04), 0 1px 3px 0 rgb(12 30 53 / 0.06)',
        'card': '0 2px 8px -2px rgb(12 30 53 / 0.06), 0 4px 16px -4px rgb(12 30 53 / 0.04)',
        'pop': '0 10px 30px -10px rgb(12 30 53 / 0.20)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.18s ease-out',
      },
    },
  },
  plugins: [],
}
