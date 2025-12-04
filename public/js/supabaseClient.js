// js/supabaseClient.js
// Include supabase script in HTML using CDN before this, e.g.

const SUPABASE_URL = 'https://urgquqczxtiuodazkhyr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZ3F1cWN6eHRpdW9kYXpraHlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1ODkxOTEsImV4cCI6MjA4MDE2NTE5MX0.t9qVkjm1eQc81wdSBWEqtphW3E8NqKJixYI1PMZzles';

const { createClient } = supabase;

// make a global client that other files can use
window.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);