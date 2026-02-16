/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1A7DB9',
          hover: '#156494', // Darker shade (600)
          light: '#5CB1DF', // Lighter shade (400)
          50: '#F0F7FC',
          100: '#E0EFF9',
          200: '#BFE0F2',
          300: '#9ED0EC',
          400: '#5CB1DF',
          500: '#1A7DB9', // Base
          600: '#156494',
          700: '#104B6F',
          800: '#0B324A',
          900: '#051925',
        },
        accent: {
          DEFAULT: '#EBB138',
          hover: '#BC8D2D', // Darker shade (600)
          light: '#F3CE99', // Lighter shade (400)
          50: '#FEFBF5',
          100: '#FDF6EB',
          200: '#FAECD6',
          300: '#F8E2C2',
          400: '#F3CE99',
          500: '#EBB138', // Base
          600: '#BC8D2D',
          700: '#8D6A22',
          800: '#5E4716',
          900: '#2F230B',
        }
      }
    },
  },
  plugins: [],
};
