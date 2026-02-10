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
          DEFAULT: '#2D3F50',
          hover: '#1F2C38', // Darker shade
          light: '#3E5469', // Lighter shade
          50: '#F2F4F6',
          100: '#E1E5E9',
          200: '#C4CCD3',
          300: '#A6B2BD',
          400: '#8999A7',
          500: '#6B7F91',
          600: '#4E667B',
          700: '#2D3F50', // Base
          800: '#243240',
          900: '#1B2630',
        },
        accent: {
          DEFAULT: '#B1DF19',
          hover: '#9CC716', // Darker shade
          light: '#C2E647', // Lighter shade
          50: '#F9FDE8',
          100: '#F4FCCF',
          200: '#E8F99E',
          300: '#DDF56D',
          400: '#D1F23C',
          500: '#B1DF19', // Base
          600: '#8EB314',
          700: '#6A860F',
          800: '#47590A',
          900: '#232D05',
        }
      }
    },
  },
  plugins: [],
};
