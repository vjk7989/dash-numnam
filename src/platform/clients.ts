import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { PublicAppConfig } from './config';

export interface BrowserClients {
  firebaseApp: FirebaseApp;
  auth: Auth;
  supabase: SupabaseClient;
}

export function createBrowserClients(config: PublicAppConfig): BrowserClients {
  const firebaseApp = getApps().length ? getApp() : initializeApp(config.firebase);
  const auth = getAuth(firebaseApp);
  const supabase = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    accessToken: async () => auth.currentUser?.getIdToken(false) ?? null,
  });
  return { firebaseApp, auth, supabase };
}
