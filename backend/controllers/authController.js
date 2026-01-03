import { supabase } from '../config/supabase.js'

export const signup = async (req, res) => {
  const { email, password, full_name, role, phone } = req.body

  const { data, error } = await supabase.auth.signUp({
    email,
    password
  })

  if (error) return res.status(400).json(error)

  // create profile
  await supabase.from('users').insert({
    id: data.user.id,
    full_name,
    role,
    phone
  })

  res.json({ message: 'User created' })
}

export const login = async (req, res) => {
  const { email, password } = req.body

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) return res.status(401).json(error)

  res.json(data)
}

// authController.js
export const getMe = async (req, res) => {
  const { supabase, user } = req

  console.log('getMe: fetching profile for user id:', user && user.id)

  try {
    // Use maybeSingle() to avoid the "Cannot coerce the result to a single JSON object" when
    // the result set is empty. If multiple matching rows exist, Supabase will still return an error
    // which we log and surface cleanly.
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, role')
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      console.error('getMe: supabase error:', error)
      return res.status(500).json({ error: error.message })
    }

    if (!data) {
      console.warn('getMe: profile not found in users table for id:', user.id)
      // Return a minimal fallback so the client can determine next steps (e.g., profile setup)
      const fallback = {
        id: user.id,
        full_name: user.user_metadata?.full_name || user.email || null,
        role: null,
        profileMissing: true
      }
      return res.json(fallback)
    }

    res.json(data)
  } catch (err) {
    console.error('getMe: unexpected error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
