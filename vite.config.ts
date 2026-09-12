import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // MODBOX keeps to 5174 so it can run beside other projects (AuraFarmerz holds 5173).
    // Vite bumps to the next free port automatically if this one is taken.
    host: true,
    port: 5174,
  },
  build: {
    target: 'es2020',
    sourcemap: false,
  },
});
