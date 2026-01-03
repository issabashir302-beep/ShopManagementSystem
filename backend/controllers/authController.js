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
