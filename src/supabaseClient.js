import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const missingEnvVars = [];

if (!supabaseUrl) missingEnvVars.push("VITE_SUPABASE_URL");
if (!supabaseAnonKey) missingEnvVars.push("VITE_SUPABASE_ANON_KEY");

export const supabaseConfigError = missingEnvVars.length
  ? `Missing Supabase environment variables: ${missingEnvVars.join(
      ", ",
    )}. Update your .env file and restart the dev server.`
  : "";

if (supabaseConfigError) {
  console.error(supabaseConfigError);

  // Fail loudly during development to avoid confusing runtime errors.
  if (import.meta.env.DEV) {
    throw new Error(supabaseConfigError);
  }
}

export const supabase = supabaseConfigError
  ? null
  : createClient(supabaseUrl, supabaseAnonKey);
