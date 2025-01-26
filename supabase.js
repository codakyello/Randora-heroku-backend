// supabase.js
require("dotenv").config({ path: "./config.env" });
const { createClient } = require("@supabase/supabase-js");

// Initialize Supabase client

const supabase = createClient(
  process.env.SUPABASE_URL, // Your Supabase URL
  process.env.SUPABASE_KEY // Your Supabase API Key
);

module.exports = supabase;
