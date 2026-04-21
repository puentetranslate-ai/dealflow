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
          light: '#d9be7a',
          dark: '#a8882e',
        },
        cream: {
          DEFAULT: '#f7f3ec',
          dark: '#ede8e0',
        },
        muted: '#8a9ab5',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['"Playfair Display"', 'serif'],
      },
    },
  },
  plugins: [],
}
