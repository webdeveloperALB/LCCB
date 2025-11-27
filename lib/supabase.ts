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


export interface CryptoWallet {
  id: string;
  user_id?: string;
  crypto_type: 'bitcoin' | 'ethereum' | 'usdt_erc20' | 'usdt_trc20';
  wallet_address: string;
  label: string;
  symbol: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}


export interface UserBankDetails {
  id: string;
  user_id: string;
  beneficiary: string;
  iban: string;
  bic: string;
  bank_name: string;
  created_at: string;
  updated_at: string;
}

export interface FundAccount {
  id: string;
  user_id: string;
  funding_method: 'crypto' | 'bank';
  status: 'pending' | 'success';
  amount: number;
  currency: string;
  user_name: string;
  user_email: string;
  crypto_type?: 'bitcoin' | 'ethereum' | 'tron';
  crypto_address?: string;
  bank_beneficiary?: string;
  bank_iban?: string;
  bank_bic?: string;
  bank_name?: string;
  reference_number?: string;
  created_at: string;
  updated_at: string;
}


