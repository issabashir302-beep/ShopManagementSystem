//initialize the server
const express = require('express'); 
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const saleRoutes = require('./routes/salesRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

//routes
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/sales', saleRoutes);

//check loaded credentials (show presence and mask secrets)
const supabaseUrlDisplay = process.env.SUPABASE_URL ? process.env.SUPABASE_URL : 'Not Set';
const supabaseKeyDisplay = process.env.SUPABASE_KEY ? `${process.env.SUPABASE_KEY.slice(0,8)}... (masked)` : 'Not Set';
console.log('SUPABASE_URL:', supabaseUrlDisplay);
console.log('SUPABASE_KEY:', supabaseKeyDisplay);

//health check route
app.get('/', (req, res) => {
    res.send('Shop Management System API is running');
});

// API health endpoint (returns JSON)
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() });
});

//start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});