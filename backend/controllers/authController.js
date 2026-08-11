import { supabase } from '../config/supabase.js'

export const signup = async (req, res) => {
  const { email, password, full_name, role, phone } = req.body
  const { data, error } = await supabase.auth.signUp({email, password})
  if (error) return res.status(400).json(error)
  // create profile
  await supabase.from('users').insert({id: data.user.id,full_name, role, phone})
  res.json({ message: 'User created' })
}

export const login = async (req, res) => {
  const { email, password } = req.body
  const { data, error } = await supabase.auth.signInWithPassword({email,password})
  if (error) return res.status(401).json(error)
  res.json(data)
}

export const logout = async (req, res) => {
  try {
    const { supabase } = req
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('logout: supabase error:', error)
      return res.status(400).json({ error: error.message || error })
    }
    res.json({ message: 'Logged out' })
  } catch (err) {
    console.error('logout: unexpected error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}


// authController.js
export const getMe = async (req, res) => {
  const { supabase, user } = req
  try {
    const { data, error } = await supabase.from('users').select('id, full_name, role, phone').eq('id', user.id).maybeSingle()
    if (error) {
      console.error('getMe: supabase error:', error)
      return res.status(500).json({ error: error.message })
    }
    let profile = data
    if (!profile) {
      console.warn('getMe: profile not found in users table for id:', user.id)
      profile = {
        id: user.id,
        full_name: user.user_metadata?.full_name || user.email || null,
        role: null,
        profileMissing: true
      }
    }

    // Find a shop owned by this user (if any) and expose shop_id in the response
    try {
      const { data: shop, error: shopErr } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle()

      if (!shopErr && shop) profile.shop_id = shop.id
      else profile.shop_id = null
    } catch (err) {
      console.warn('getMe: failed to lookup shop by owner_id', err)
      profile.shop_id = null
    }

    // Always include the user's email from the auth object if present
    profile.email = user?.email || null

    res.json(profile)
  } catch (err) {
    console.error('getMe: unexpected error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
