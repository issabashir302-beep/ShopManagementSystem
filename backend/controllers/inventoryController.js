//controller/inventoryController.js

//initialize supabase client
const supabase = require('../config/supabase');

//controller to add an item to inventory 
const addItem = async (req, res) => {
  const { name, quantity, price } = req.body;
  try {
    const { data, error } = await supabase.from('inventory').insert([{ name, quantity, price }]);
    if (error) return res.status(400).json(error);
    res.status(201).json({ data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getItems = async (req, res) => {
  try {
    const { data, error } = await supabase.from('inventory').select('*');
    if (error) return res.status(400).json(error);
    res.status(200).json({ data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


const updateItem = async (req, res) => {
  const { id } = req.params;
  const { name, quantity, price } = req.body;
  try {
    const { data, error } = await supabase
      .from('inventory')
      .update({ name, quantity, price })
      .eq('id', id);
    if (error) return res.status(400).json(error);
    res.status(200).json({ data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


const deleteItem = async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase.from('inventory').delete().eq('id', id);
    if (error) return res.status(400).json(error);
    res.status(200).json({ data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { addItem, getItems, updateItem, deleteItem };
