import { supabase } from '../config/supabase.js'

// GET all products (RLS filters by shop automatically)
export const getProducts = async (req, res) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')

  if (error) return res.status(400).json(error)
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

// LOW STOCK VIEW
export const lowStock = async (req, res) => {
  const { data, error } = await supabase
    .from('low_stock_alerts')
    .select('*')

  if (error) return res.status(400).json(error)
  res.json(data)
}
