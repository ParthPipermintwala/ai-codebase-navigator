import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = String(process.env.SUPABASE_URL || "").trim();
const supabaseKey = String(process.env.SUPABASE_KEY || "").trim();

if (!supabaseUrl || !supabaseKey) {
  throw new Error("SUPABASE_URL and SUPABASE_KEY must be set in environment");
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
