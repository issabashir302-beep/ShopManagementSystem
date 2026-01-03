import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const SUPABASE_URL = process.env.SUPABASE_URL
// Support either SUPABASE_ANON_KEY or legacy SUPABASE_KEY env var
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn(
    'Warning: Supabase credentials are missing. Set SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_KEY) in your .env to avoid runtime errors.'
  )
}

// Default shared client (used by controllers)
export const supabase = createClient(SUPABASE_URL || '', SUPABASE_KEY || '')

// Factory to create a request-scoped client that adds an Authorization header
export function createSupabaseClientWithToken(token) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Supabase credentials missing (SUPABASE_URL or SUPABASE_ANON_KEY).')
  }
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  })
}
