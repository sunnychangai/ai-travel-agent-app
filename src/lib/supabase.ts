import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Detect mobile device
const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Use a singleton pattern to avoid multiple GoTrueClient instances
let supabaseInstance: ReturnType<typeof createClient> | null = null;

export const getSupabase = () => {
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Mobile-specific settings
        detectSessionInUrl: !isMobile, // Disable URL session detection on mobile to avoid issues
        flowType: isMobile ? 'pkce' : 'implicit', // Use PKCE flow on mobile for better security
      },
      // Add mobile-specific global settings
      global: {
        headers: isMobile ? {
          'X-Client-Info': 'supabase-js-mobile'
        } : {}
      }
    });
  }
  return supabaseInstance;
};

// For backward compatibility
export const supabase = getSupabase(); 