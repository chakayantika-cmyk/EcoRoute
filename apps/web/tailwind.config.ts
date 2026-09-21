/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F0F7F0',
          100: '#DCF0DC',
          200: '#B5DEB5',
          300: '#82C482',
          400: '#4EA54E',
          500: '#2D7A2D',
          600: '#1B4332',
          700: '#164028',
          800: '#0F2E1C',
          900: '#0A1F13',
          950: '#051008',
        },
        teal: {
          50: '#F0FDFD',
          100: '#CCFBF9',
          200: '#99F5F0',
          300: '#5EE9E1',
          400: '#2DD4CB',
          500: '#14B8B0',
          600: '#0D6E6E',
          700: '#0B5858',
          800: '#094747',
          900: '#073B3B',
        },
        eco: {
          bg: '#F5F5F0',
          surface: '#FAFAF7',
          text: '#0A0A0A',
          'text-secondary': '#6B6B6B',
          border: '#E5E5E0',
          'border-dark': '#D0D0CB',
        },
        dark: {
          bg: '#0F0F0F',
          surface: '#1A1A1A',
          'surface-2': '#252525',
          text: '#F5F5F0',
          'text-secondary': '#A0A0A0',
          border: '#2A2A2A',
        },
      },
      fontFamily: {
        serif: ['"DM Serif Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        'display': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'heading-1': ['2.5rem', { lineHeight: '1.15', letterSpacing: '-0.015em' }],
        'heading-2': ['2rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'heading-3': ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.005em' }],
        'body-lg': ['1.125rem', { lineHeight: '1.6' }],
        'body': ['1rem', { lineHeight: '1.6' }],
        'body-sm': ['0.875rem', { lineHeight: '1.5' }],
        'caption': ['0.75rem', { lineHeight: '1.4' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '112': '28rem',
        '128': '32rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
};
