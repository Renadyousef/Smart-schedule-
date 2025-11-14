import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    base: "/", // ✅ important for correct asset paths in production
    server: {
      historyApiFallback: true, // only affects local dev
    },
    define: {
      'process.env.REACT_APP_SUPABASE_URL': JSON.stringify(env.REACT_APP_SUPABASE_URL || ''),
      'process.env.REACT_APP_SUPABASE_ANON_KEY': JSON.stringify(env.REACT_APP_SUPABASE_ANON_KEY || ''),
      'process.env.REACT_APP_WS_URL': JSON.stringify(env.REACT_APP_WS_URL || ''),
    },
  }
})
