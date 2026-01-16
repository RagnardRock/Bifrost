/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Custom colors for Bifrost glassmorphism theme
        glass: {
          light: 'rgba(255, 255, 255, 0.1)',
          dark: 'rgba(17, 24, 39, 0.3)',
        },
      },
      backdropBlur: {
        glass: '16px',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
        'glass-dark': '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
      },
    },
  },
  plugins: [],
}
