// config/supabase.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    'SUPABASE_URL and SUPABASE_KEY are required. Create a `.env` in the backend folder (or export the env vars) using `.env.example` as a template.'
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

module.exports = supabase;
