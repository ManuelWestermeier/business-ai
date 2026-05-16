/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        syne: ['"Syne Variable"', 'sans-serif'],
        outfit: ['"Outfit Variable"', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', 'monospace'],
      },
      colors: {
        accent: '#F5C500',
        'accent-dim': '#D4A900',
        'accent-light': '#FFFBE6',
        ink: '#0A0A0A',
        muted: '#888888',
        border: '#E0E0E0',
        surface: '#F8F8F8',
        danger: '#E53E3E',
      },
      animation: {
        blink: 'blink 1s step-end infinite',
        'fade-up': 'fadeUp 0.4s ease forwards',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
