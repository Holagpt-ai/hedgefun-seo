import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Browser client — used in Client Components (admin dashboard)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server client — used in Server Components and API routes
// persistSession false = no cookie overhead on server
export const createServerClient = () =>
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

// Source client — reads from the main HedgeFun Lovable Supabase
// Used by enrichment agents to pull ticker data
const sourceUrl = process.env.HF_SOURCE_SUPABASE_URL!;
const sourceAnonKey = process.env.HF_SOURCE_SUPABASE_ANON_KEY!;

export const createSourceClient = () =>
  createClient(sourceUrl, sourceAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
