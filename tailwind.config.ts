import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0B1220', soft: '#3B4657', mute: '#6B7686' },
        // Sampled from the Bikepick emblem. 500 is the graphic orange; 600 and
        // 700 are the text/button shades that clear WCAG AA against white.
        brand: {
          50: '#FFF4ED', 100: '#FFE5D4', 200: '#FFC7A6', 300: '#FFA06B',
          400: '#FF7A33', 500: '#F0620C', 600: '#C2410C', 700: '#9A3412',
          800: '#7C2D12', 900: '#652B14',
        },
        steel: { DEFAULT: '#8A94A6', light: '#C6CDD8', dark: '#4A5364' },
        accent: { DEFAULT: '#00B27A', soft: '#E6F8F1', dark: '#00875C' },
        warn: { DEFAULT: '#F59E0B', soft: '#FEF6E7' },
        danger: { DEFAULT: '#E11D48', soft: '#FFF1F4' },
        line: '#E7EBF0',
        surface: '#F6F8FB',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.05), 0 8px 24px -12px rgba(16,24,40,.14)',
        pop: '0 12px 40px -12px rgba(16,24,40,.22)',
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.125rem', '3xl': '1.5rem' },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'none' } },
      },
      animation: { 'fade-up': 'fade-up .35s ease-out both' },
    },
  },
  plugins: [],
};
export default config;
