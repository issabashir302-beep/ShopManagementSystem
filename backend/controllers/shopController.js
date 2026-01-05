import { createClient } from '@supabase/supabase-js'
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

// Add Shopkeeper (Create User directly)
export const addShopkeeper = async (req, res) => {
  const { email, password, name, phone } = req.body
  const { user } = req // Owner (authenticated user)

  // 1. Get Owner's Shop
  const admin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    // Check if owner has a shop
    const { data: shop, error: shopError } = await admin
      .from('shops')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (shopError || !shop) {
      return res.status(400).json({ message: 'You must have a shop to add shopkeepers.' })
    }

    // 2. Create User in Auth
    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name }
    })

    if (createError) throw createError

    // 3. Create entry in public.users linked to shop
    const { error: insertError } = await admin
      .from('users')
      .insert({
        id: newUser.user.id,
        full_name: name,
        email: email, // redundant but useful if schema has it
        phone: phone,
        role: 'shopkeeper', // lowercase standard
        shop_id: shop.id
      })

    if (insertError) {
      // Cleanup auth user if profile creation fails? For now just error.
      throw insertError
    }

    res.json({ message: 'Shopkeeper created successfully', user: newUser.user })

  } catch (err) {
    console.error('addShopkeeper error:', err)
    res.status(400).json({ error: err.message || 'Failed to add shopkeeper' })
  }
}

export const getShopkeepers = async (req, res) => {
  const { user } = req
  const { supabase } = req // User client is fine here if RLS allows owner to see their shopkeepers

  try {
    // 1. Get Owner's Shop ID first (optimally we would rely on RLS, but user might strictly be owner)
    // Actually, RLS on 'users' table usually prevents seeing others. 
    // We might need to query 'users' where shop_id matches the owner's shop_id.

    // Let's first find the shop owned by this user
    const { data: shop } = await supabase
      .from('shops')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!shop) return res.json([]) // No shop, no shopkeepers

    // 2. Fetch users with role 'shopkeeper' in this shop
    const { data: shopkeepers, error } = await supabase
      .from('users')
      .select('*')
      .eq('shop_id', shop.id)
      .eq('role', 'shopkeeper')

    if (error) throw error

    res.json(shopkeepers)
  } catch (err) {
    console.error('getShopkeepers error:', err)
    res.status(500).json({ error: 'Failed to fetch shopkeepers' })
  }
}
