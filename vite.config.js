import { defineConfig } from 'vite';

export default defineConfig({
  // Los archivos musicales nunca se envían a un servidor: Vite sirve solo la app.
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
});
