import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

const base = process.env.GITHUB_ACTIONS ? '/global-disaster-monitor/' : '/';

export default defineConfig({
  base,
  plugins: [tailwindcss()],
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.js'],
    restoreMocks: true
  }
});
