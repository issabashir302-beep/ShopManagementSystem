//get supabase client
const supabase = require('../config/supabase');


const authMiddleware = async (req, res, next) => {
  const token = req.headers['authorization'];

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const { user, error } = await supabase.auth.api.getUser(token);
    if (error || !user) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    req.user = user; // Store user info in request object
    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    return res.status(500).json({ message: 'Authentication failed', error: error.message });
  }
};

module.exports = authMiddleware;