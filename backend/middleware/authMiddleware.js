import { supabase } from '../config/supabase.js'

export const requireAuth = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '')

  if (!token) {
    return res.status(401).json({ error: 'Missing token' })
  }

  const { data, error } = await supabase.auth.getUser(token)

  if (error) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  req.user = data.user
  next()
}
