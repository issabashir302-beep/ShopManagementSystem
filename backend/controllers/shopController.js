import { supabase } from '../config/supabase.js';

export const createShop = async (req, res) => {
  const { supabase, user } = req

  const { data, error } = await supabase
    .from('shops')
    .insert({
      owner_id: user.id,
      ...req.body
    })
    .select()
    .single()

  if (error) return res.status(400).json(error)
  res.json(data)
}

export const getShopDetails = async (req, res) => {
  const { supabase } = req

  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .single()

  if (error) return res.status(400).json(error)
  res.json(data)
}


export const inviteShopkeeper = async (req, res) => {
  const { email } = req.body

  // Admin API (service role only)
  const admin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { error } = await admin.auth.admin.inviteUserByEmail(email)

  if (error) return res.status(400).json(error)

  res.json({ message: 'Invite sent' })
}
