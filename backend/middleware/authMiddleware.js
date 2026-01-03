import { createSupabaseClientWithToken } from '../config/supabase.js'

export const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization

  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header' })
  }

  const token = authHeader.replace('Bearer ', '')

  // 🔐 Create request-scoped client
  let supabase
  try {
    supabase = createSupabaseClientWithToken(token)
  } catch (err) {
    // Clear, actionable error for missing env vars
    return res.status(500).json({ error: err.message })
  }

  // Validate user
  const { data, error } = await supabase.auth.getUser()

  if (error) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  req.user = data.user
  req.supabase = supabase

  next()
}
