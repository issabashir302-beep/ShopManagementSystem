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

    // 3. Create entry in public.users linked to shop if possible
    const profilePayload = {
      id: newUser.user.id,
      full_name: name,
      email: email,
      phone: phone,
      role: 'shopkeeper'
      // don't assume users.shop_id exists; we'll try to create mapping separately
    }

    let insertedProfile = false
    try {
      const { error } = await admin
        .from('users')
        .insert({ ...profilePayload, shop_id: shop.id })

      if (error) throw error
      insertedProfile = true
    } catch (insertErr) {
      const msg = (insertErr && (insertErr.message || insertErr.error || JSON.stringify(insertErr))).toString()
      console.warn('addShopkeeper: users table insert failed (may lack column):', msg)

      // Try inserting without email if email column missing
      if (msg.toLowerCase().includes("could not find the 'email'") || msg.toLowerCase().includes('column "email"') || (msg.toLowerCase().includes('email') && msg.toLowerCase().includes('does not exist'))) {
        try {
          const { error: retryErr } = await admin
            .from('users')
            .insert({ id: newUser.user.id, full_name: name, phone: phone, role: 'shopkeeper' })

          if (retryErr) throw retryErr
          insertedProfile = true
        } catch (retryErr2) {
          console.error('addShopkeeper profile insert fallback failed:', retryErr2)
          // continue; we'll still try to create shop_staff mapping
        }
      }
    }

    // 4. Try to create mapping in shop_staff (preferred mapping when users.shop_id doesn't exist)
    let mappingCreated = false
    try {
      const { error: mapErr } = await admin
        .from('shop_staff')
        .insert({ user_id: newUser.user.id, shop_id: shop.id, role: 'shopkeeper' })

      if (mapErr) throw mapErr
      mappingCreated = true
    } catch (mapErr) {
      // If the shop_staff table doesn't exist, warn the user in the response
      console.warn('addShopkeeper: could not create shop_staff mapping (table may not exist):', (mapErr && (mapErr.message || JSON.stringify(mapErr))) || mapErr)
    }

    // 5. Prepare response messages
    const msgs = []
    if (insertedProfile) msgs.push('profile created')
    else msgs.push('profile NOT created (users table may lack required columns)')
    if (mappingCreated) msgs.push('shop mapping created')
    else msgs.push('shop mapping NOT created (shop_staff table missing)')

    return res.json({ message: `Shopkeeper created. ${msgs.join('; ')}`, user: newUser.user })

  } catch (err) {
    console.error('addShopkeeper error:', err)
    res.status(400).json({ error: err.message || 'Failed to add shopkeeper' })
  }
}

export const getShopkeepers = async (req, res) => {
  const { user } = req
  const { supabase } = req // User client is fine here if RLS allows owner to see their shopkeepers

  try {
    // 1. Get Owner's Shop ID first (best-case)
    const { data: shop } = await supabase
      .from('shops')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    // 2a. Try the simple users.shop_id approach first
    if (shop) {
      try {
        const { data: shopkeepers, error } = await supabase
          .from('users')
          .select('*')
          .eq('shop_id', shop.id)
          .eq('role', 'shopkeeper')

        if (!error) return res.json({ shopkeepers: shopkeepers || [], source: 'shop' })

        // If error, fall through to mapping approach
        console.warn('getShopkeepers: users.shop_id query failed, will attempt shop_staff mapping', (error && error.message) || error)
      } catch (qErr) {
        console.warn('getShopkeepers: users.shop_id query threw, falling back to shop_staff:', qErr && qErr.message)
      }

      // 2b. Fallback: try shop_staff mapping table to find user_ids
      try {
        const { data: mapping, error: mapErr } = await supabase
          .from('shop_staff')
          .select('user_id')
          .eq('shop_id', shop.id)
          .eq('role', 'shopkeeper')

        if (!mapErr && mapping && mapping.length > 0) {
          const ids = mapping.map(m => m.user_id).filter(Boolean)

          const { data: users } = await supabase
            .from('users')
            .select('*')
            .in('id', ids)
            .eq('role', 'shopkeeper')

          return res.json({ shopkeepers: users || [], source: 'mapping' })
        }

        // If mapping table missing or empty, fall through to global query
        console.warn('getShopkeepers: shop_staff mapping missing or empty; falling back to global role query')
      } catch (mapQErr) {
        console.warn('getShopkeepers: shop_staff query error, falling back to global role query', mapQErr && mapQErr.message)
      }
    }

    // 3. Global fallback: return all users with role 'shopkeeper'
    try {
      const { data: allShopkeepers } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'shopkeeper')

      return res.json({ shopkeepers: allShopkeepers || [], source: 'global' })
    } catch (globalErr) {
      console.error('getShopkeepers global fallback error:', globalErr)
      return res.status(500).json({ error: 'Failed to fetch shopkeepers' })
    }

  } catch (err) {
    console.error('getShopkeepers error:', err)
    res.status(500).json({ error: 'Failed to fetch shopkeepers' })
  }
}

// Update shopkeeper profile fields (name, phone)
export const updateShopkeeper = async (req, res) => {
  const { supabase, user } = req
  const { id } = req.params
  const { full_name, phone } = req.body

  try {
    // Find owner's shop
    const { data: shop } = await supabase
      .from('shops')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!shop) return res.status(403).json({ error: 'Not authorized (no shop owned)' })

    // Determine shop linkage for target user: try users.shop_id; if missing, fallback to shop_staff
    try {
      const { data: userRec, error: findErr } = await supabase
        .from('users')
        .select('shop_id')
        .eq('id', id)
        .maybeSingle()

      if (findErr || !userRec || userRec.shop_id !== shop.id) {
        // try shop_staff mapping
        const { data: mapping } = await supabase
          .from('shop_staff')
          .select('shop_id')
          .eq('user_id', id)
          .maybeSingle()

        if (!mapping || mapping.shop_id !== shop.id) {
          return res.status(403).json({ error: 'Not authorized to update this shopkeeper' })
        }
      }
    } catch (checkErr) {
      console.warn('updateShopkeeper: fallback checks threw', checkErr && checkErr.message)
      return res.status(403).json({ error: 'Not authorized' })
    }

    const updatePayload = { full_name, phone }
    if (req.body.role) updatePayload.role = req.body.role

    const { data, error } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    res.json(data)
  } catch (err) {
    console.error('updateShopkeeper error:', err)
    res.status(400).json({ error: err.message || 'Failed to update shopkeeper' })
  }
}

// Toggle shopkeeper active/disabled status, using service role admin client
export const toggleShopkeeperStatus = async (req, res) => {
  const { id } = req.params
  const { disabled } = req.body // boolean

  const admin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    // Authorization: ensure the requester owns the shop for this user
    // We'll use service/admin client to fetch mapping (since owner check can use supabase too, but this is simple)
    const ownerId = req.user.id
    const { data: shop } = await admin
      .from('shops')
      .select('id')
      .eq('owner_id', ownerId)
      .single()

    if (!shop) return res.status(403).json({ error: 'Not authorized (no shop owned)' })

    // Check users.shop_id first (if exists), otherwise check shop_staff
    let belongsToShop = false
    try {
      const { data: userRec, error: userErr } = await admin
        .from('users')
        .select('shop_id')
        .eq('id', id)
        .maybeSingle()

      if (!userErr && userRec && userRec.shop_id === shop.id) belongsToShop = true
    } catch (e) {
      // table/column may not exist; fallback
    }

    if (!belongsToShop) {
      try {
        const { data: mapping, error: mapErr } = await admin
          .from('shop_staff')
          .select('shop_id')
          .eq('user_id', id)
          .maybeSingle()

        if (!mapErr && mapping && mapping.shop_id === shop.id) belongsToShop = true
      } catch (e) {
        // swallow
      }
    }

    if (!belongsToShop) return res.status(403).json({ error: 'Not authorized to update this shopkeeper' })

    // Update auth user disabled flag
    const { data: updatedAuth, error: authErr } = await admin.auth.admin.updateUserById(id, { disabled })
    if (authErr) throw authErr

    // Also update users table 'is_disabled' (optional)
    const { error: userErr } = await admin
      .from('users')
      .update({ is_disabled: disabled })
      .eq('id', id)

    if (userErr) console.warn('Failed to update users table disabled flag', userErr)

    res.json({ message: disabled ? 'Shopkeeper deactivated' : 'Shopkeeper activated' })
  } catch (err) {
    console.error('toggleShopkeeperStatus error:', err)
    res.status(400).json({ error: err.message || 'Failed to toggle status' })
  }
}

// Reset password for a shopkeeper and return new password (service role required)
export const resetShopkeeperPassword = async (req, res) => {
  const { id } = req.params

  // Generate simple temp password (owner can customize later)
  const newPassword = Math.random().toString(36).slice(-10) + 'A!'

  const admin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    // Authorization: ensure requester owns the shop of this user (similar logic to toggle)
    const ownerId = req.user.id
    const { data: shop } = await admin
      .from('shops')
      .select('id')
      .eq('owner_id', ownerId)
      .single()

    if (!shop) return res.status(403).json({ error: 'Not authorized (no shop owned)' })

    let belongsToShop = false
    try {
      const { data: userRec } = await admin
        .from('users')
        .select('shop_id')
        .eq('id', id)
        .maybeSingle()

      if (userRec && userRec.shop_id === shop.id) belongsToShop = true
    } catch (e) {
      // ignore
    }

    if (!belongsToShop) {
      try {
        const { data: mapping } = await admin
          .from('shop_staff')
          .select('shop_id')
          .eq('user_id', id)
          .maybeSingle()

        if (mapping && mapping.shop_id === shop.id) belongsToShop = true
      } catch (e) {
        // ignore
      }
    }

    if (!belongsToShop) return res.status(403).json({ error: 'Not authorized to reset password for this shopkeeper' })

    const { data, error: updateErr } = await admin.auth.admin.updateUserById(id, { password: newPassword })
    if (updateErr) throw updateErr

    // Try to fetch email and name for display
    const { data: userRec, error: userErr } = await admin
      .from('users')
      .select('email, full_name')
      .eq('id', id)
      .maybeSingle()

    res.json({ newPassword, email: userRec?.email || null, full_name: userRec?.full_name || null })
  } catch (err) {
    console.error('resetShopkeeperPassword error:', err)
    res.status(400).json({ error: err.message || 'Failed to reset password' })
  }
}
