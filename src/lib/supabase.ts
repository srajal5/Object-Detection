import { createClient } from "@supabase/supabase-js";
import { mockSupabase } from "./supabase-mock";

// Default values for development environment
const defaultUrl = "https://your-project.supabase.co";
const defaultAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock-key";

// Use environment variables or fallback to default values
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || defaultUrl;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || defaultAnonKey;

// Determine if we're using mock or real Supabase
const USE_MOCK =
  supabaseUrl === defaultUrl ||
  supabaseAnonKey === defaultAnonKey ||
  process.env.NODE_ENV === "development";

// Define supabase client
let supabaseClient;

if (USE_MOCK) {
  console.warn(
    "Using mock Supabase implementation for development. Authentication will be simulated locally."
  );
  // Use mock implementation
  supabaseClient = mockSupabase;
} else {
  // Use real Supabase client
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
}

// Export the client (either mock or real)
export const supabase = supabaseClient;
