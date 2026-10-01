import { createClient } from '@supabase/supabase-js';

// Primary: read from Vite env vars (import.meta.env)
// Fallback: hardcoded values from .env to guarantee the client always
// has a valid URL/key, even if Vite's dev-server define/replacement
// fails to inject the env value at runtime (a known cause of
// "Failed to fetch" when createClient receives an empty string).
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://jczywrfpgmgsarwpotlp.supabase.co';

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impjenl3cmZwZ21nc2Fyd3BvdGxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NjIwODUsImV4cCI6MjEwNjIzODA4NX0.ZWKX0WWGfuf_TlONDqm0XXjaFTa3OzJHWLUtaZ8Pa00';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    'Supabase environment variables are missing. ' +
      'VITE_SUPABASE_URL:',
    import.meta.env.VITE_SUPABASE_URL,
    'VITE_SUPABASE_ANON_KEY:',
    import.meta.env.VITE_SUPABASE_ANON_KEY ? 'present' : 'missing'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
