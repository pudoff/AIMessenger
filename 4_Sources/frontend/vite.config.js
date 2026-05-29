import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000', // Адрес бэкенда
        changeOrigin: true,               // Меняет заголовок Host на адрес цели
        secure: false,                    // Если бы был HTTPS
      },
    },
  }
});
