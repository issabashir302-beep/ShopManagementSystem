//controllers/salesController.js

//initialize supabase client
const supabase = require('../config/supabase');

//record a sale
const recordSale = async (req, res) => {
  const { item_id, quantity, total_price } = req.body;
  try {
    const { data, error } = await supabase.from('sales').insert([{ item_id, quantity, total_price }]);
    if (error) return res.status(400).json(error);
    res.status(201).json({ data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

//get all sales
const getSales = async (req, res) => {
  try {
    const { data, error } = await supabase.from('sales').select('*');
    if (error) return res.status(400).json(error);
    res.status(200).json({ data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
module.exports = { recordSale, getSales };
