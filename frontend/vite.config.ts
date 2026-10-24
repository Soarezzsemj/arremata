import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Em desenvolvimento o front chama /api e o Vite repassa para a API local.
    // Assim não precisamos configurar CORS nem trocar a URL entre ambientes.
    proxy: {
      '/api': 'http://localhost:3333',
    },
  },
});
