import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://jxnkvoqtvuofxtdxffge.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_TVkcEa7vtlKIR7P4H9LzuA_Nc4c081g";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);