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

// UPDATE product (owner only via RLS)
export const updateProduct = async (req, res) => {
  const { supabase } = req
  const { id } = req.params
  const updates = req.body

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
  const { data, error } = await supabase
    .from('products')
    .insert(req.body)

  if (error) return res.status(400).json(error)
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
