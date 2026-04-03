import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

if (!supabase) {
  console.error("Failed to create Supabase client");
  process.exit(1);
}
else{
  console.log("Supabase client created successfully");
}

export default supabase;