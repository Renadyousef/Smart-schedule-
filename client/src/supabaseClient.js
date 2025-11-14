import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  import.meta.env?.VITE_SUPABASE_URL ?? process.env?.VITE_SUPABASE_URL ?? process.env?.REACT_APP_SUPABASE_URL
const supabaseAnonKey =
  import.meta.env?.VITE_SUPABASE_ANON_KEY ??
  process.env?.VITE_SUPABASE_ANON_KEY ??
  process.env?.REACT_APP_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL environment variable')
}

if (!supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY environment variable')
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

export default supabase
