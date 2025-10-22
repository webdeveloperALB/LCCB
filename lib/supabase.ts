import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 2,
    },
  },
  global: {
    headers: {
      "x-application-name": "dashboard-app",
    },
  },
})

export type User = {
  id: string
  email: string | null
  password: string | null
  first_name: string | null
  last_name: string | null
  full_name: string | null
  age: number | null
  created_at: string | null
  kyc_status: 'not_started' | 'pending' | 'approved' | 'rejected'
  is_admin: boolean
}