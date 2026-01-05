import { supabase } from '../config/supabase.js'

// GET all products (RLS filters by shop automatically)
export const getProducts = async (req, res) => {
  const { supabase } = req

  const { data, error } = await supabase
    .from('products')
    .select('*')

  if (error) return res.status(400).json(error)
  res.json(data)
}

// Helper to map incoming product payload to DB column names
function mapProductPayload(body) {
  const mapped = {}

  // name can come as name, product_name or productName
  if (body.product_name ?? body.name ?? body.productName) mapped.name = body.name || body.product_name || body.productName

  if (body.sku) mapped.sku = body.sku
  if (body.category) mapped.category = body.category

  // quantity maps from stock or quantity
  if (body.stock !== undefined) mapped.quantity = Number(body.stock)
  else if (body.quantity !== undefined) mapped.quantity = Number(body.quantity)

  if (body.unit) mapped.unit = body.unit

  if (body.buying_price !== undefined) mapped.buying_price = Number(body.buying_price)
  else if (body.buyPrice !== undefined) mapped.buying_price = Number(body.buyPrice)
  else if (body.buy_price !== undefined) mapped.buy_price = Number(body.buy_price)

  if (body.selling_price !== undefined) mapped.selling_price = Number(body.selling_price)
  else if (body.sellPrice !== undefined) mapped.selling_price = Number(body.sellPrice)
  else if (body.sell_price !== undefined) mapped.sell_price = Number(body.sell_price)

  if (body.supplier !== undefined) mapped.supplier = body.supplier
  if (body.description !== undefined) mapped.description = body.description

  // Optional fields
  if (body.reorder_level !== undefined) mapped.reorder_level = Number(body.reorder_level)
  if (body.shop_id !== undefined) mapped.shop_id = body.shop_id

  return mapped
}

// UPDATE product (owner only via RLS)
export const updateProduct = async (req, res) => {
  const { supabase } = req
  const { id } = req.params
  const updates = mapProductPayload(req.body)

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields to update' })

  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return res.status(403).json(error)
  res.json(data)
}

// CREATE product (owner only via RLS)
export const createProduct = async (req, res) => {
  const { supabase, user } = req
  const payload = mapProductPayload(req.body)

  // Infer shop_id from the shop owned by the authenticated user (owner_id on shops table)
  if (!payload.shop_id && user && user.id) {
    try {
      const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle()

      if (!shopError && shop && shop.id) {
        payload.shop_id = shop.id
      }
    } catch (err) {
      console.error('createProduct: failed to fetch shop for owner', err)
    }
  }

  // If we still don't have a shop_id, RLS will reject the insert - return informative error
  if (!payload.shop_id) {
    return res.status(403).json({ error: 'Missing shop_id: your user account is not linked to a shop and row-level security prevents inserts without shop_id. Create a shop first via POST /api/shops.' })
  }

  const { data, error } = await supabase
    .from('products')
    .insert(payload)

  if (error) {
    // Detect row-level security failure and return a helpful message
    if (error.message && error.message.toLowerCase().includes('row-level security')) {
      return res.status(403).json({ error: 'Insert blocked by row-level security policy. Ensure your account has permission to create products for this shop.' })
    }
    return res.status(400).json(error)
  }

  res.json(data)
}

// DELETE product (owner only via RLS)
export const deleteProduct = async (req, res) => {
  const { supabase } = req
  const { id } = req.params

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)

  if (error) return res.status(403).json(error)

  res.json({ message: 'Product deleted' })
}

// LOW STOCK VIEW
export const lowStock = async (req, res) => {
  const { data, error } = await supabase
    .from('low_stock_alerts')
    .select('*')

  if (error) return res.status(400).json(error)
  res.json(data)
}
