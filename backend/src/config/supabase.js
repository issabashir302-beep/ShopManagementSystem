import { createClient } from '@supabase/supabase-js'

const CLIENT_OPTIONS = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
}

export function createSupabaseClients(config) {
  const publicClient = createClient(config.supabaseUrl, config.supabaseAnonKey, CLIENT_OPTIONS)
  const adminClient = createClient(
    config.supabaseUrl,
    config.supabaseServiceRoleKey,
    CLIENT_OPTIONS
  )

  return Object.freeze({
    publicClient,
    adminClient,
    forAccessToken(accessToken) {
      return createClient(config.supabaseUrl, config.supabaseAnonKey, {
        ...CLIENT_OPTIONS,
        global: { headers: { Authorization: `Bearer ${accessToken}` } }
      })
    }
  })
}
