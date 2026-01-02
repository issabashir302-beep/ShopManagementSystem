// controllers/authController.js

//initialize supabase client
const supabase = require('../config/supabase');

//create a signup controller that validates input before creating a new user
const signup = async (req, res) => {
  const { email, password } = req.body;
  try {
    const { user, error } = await supabase.auth.signUp({ email, password });
    if (error) return res.status(400).json(error);
    res.status(201).json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

//create a login controller that validates input before logging in a user
const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const { user, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(400).json(error);
    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { signup, login };
