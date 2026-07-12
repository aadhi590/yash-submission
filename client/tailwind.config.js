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
          50: '#f5f7ff',
          100: '#ebf0ff',
          200: '#dae3ff',
          300: '#bfcdff',
          400: '#99adff',
          500: '#6680ff',
          600: '#334cff',
          700: '#0019ff',
          800: '#0013cc',
          900: '#000e99',
        },
      },
    },
  },
  plugins: [],
}
