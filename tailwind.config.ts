import type { Config } from 'tailwindcss';
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#2F6F5E', dark: '#1F4D41', light: '#E6F1ED' },
        ink: '#1F2A27', muted: '#66756F', rule: '#E2E8E5', canvas: '#F7F8F6',
        warn: '#B7791F', danger: '#C0392B', ok: '#2F855A',
      },
    },
  },
  plugins: [],
} satisfies Config;
