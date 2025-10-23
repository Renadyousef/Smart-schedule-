import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: "/", // ✅ important for correct asset paths in production
  server: {
    historyApiFallback: true, // only affects local dev
  },
})
