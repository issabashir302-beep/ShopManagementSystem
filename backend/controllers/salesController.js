import { supabase } from '../config/supabase.js'

// Create Sale (header)
export const createSale = async (req, res) => {
  const { supabase } = req
  const { sale, items } = req.body

  const { data, error } = await supabase.rpc(
    'create_sale_with_items',
    {
      sale_data: sale,
      items
    }
  )

  if (error) return res.status(400).json(error)
  res.json({ sale_id: data })
}


// Add sale items (trigger handles stock)
export const addSaleItems = async (req, res) => {
  const items = req.body

  const { data, error } = await supabase
    .from('sale_items')
    .insert(items)

  if (error) return res.status(400).json(error)
  res.json(data)
}

// Daily analytics view
export const dailySales = async (req, res) => {
  const { data, error } = await supabase
    .from('daily_sales_summary')
    .select('*')

  if (error) return res.status(400).json(error)
  res.json(data)
}
