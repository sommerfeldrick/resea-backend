/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {}
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts', './tests/setup.ts'],
    include: ['./src/**/*.{test,spec}.{js,jsx,ts,tsx}', './tests/**/*.{test,spec}.{js,jsx,ts,tsx}'],
  },
} as any)
