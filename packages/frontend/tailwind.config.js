import colors from 'tailwindcss/colors.js';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          ...colors.teal,
          DEFAULT: colors.teal[600],
          light: colors.teal[400],
          soft: colors.teal[50],
          muted: colors.teal[100],
          border: colors.teal[200],
          text: colors.teal[900],
        },
        primary: {
          ...colors.teal,
          DEFAULT: colors.teal[600],
        },
        slate: {
          850: '#151e2e',
        }
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif'
        ],
      }
    },
  },
  plugins: [],
}
