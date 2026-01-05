import { supabase } from '../config/supabase.js';

export const createShop = async (req, res) => {
  const { supabase, user } = req

  try {
    const { data, error } = await supabase
      .from('shops')
      .insert({
        owner_id: user.id,
        ...req.body
      })
      .select()
      .single()

    if (error) return res.status(400).json(error)

    // Return created shop. We do NOT attempt to write to a non-existent users.shop_id column.
    res.json(data)
  } catch (err) {
    console.error('createShop: unexpected error', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getShopDetails = async (req, res) => {
  const { supabase, user } = req

  try {
    // Try to read shop_id from users table first
    const { data: profile, error: profileError } = await supabase
      .from('shops')
      .select('owner_id')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      console.warn('getShopDetails: failed to fetch user profile', profileError)
    }

    let shop = null

    if (profile && profile.shop_id) {
      const { data: shopData, error: shopError } = await supabase
        .from('shops')
        .select('*')
        .eq('id', profile.shop_id)
        .maybeSingle()

      if (!shopError) shop = shopData
    }

    // Fallback: if no shop_id on profile, try to find a shop where user is owner
    if (!shop) {
      const { data: ownedShop, error: ownedError } = await supabase
        .from('shops')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle()

      if (!ownedError) shop = ownedShop
    }

    if (!shop) return res.status(404).json({ message: 'No shop found for user' })

    res.json(shop)
  } catch (err) {
    console.error('getShopDetails: unexpected error', err)
    res.status(500).json({ error: 'Internal server error' })
  }
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
