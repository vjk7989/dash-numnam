export interface PublicAppConfig {
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    appId: string;
  };
  supabaseUrl: string;
  supabasePublishableKey: string;
}

export type ConfigResult =
  | { configured: true; value: PublicAppConfig }
  | { configured: false; missing: string[] };

export function readPublicConfig(env: Record<string, string | boolean | undefined>): ConfigResult {
  const keys = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_APP_ID',
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
  ] as const;
  const missing = keys.filter((key) => typeof env[key] !== 'string' || !(env[key] as string).trim());
  if (missing.length) return { configured: false, missing: [...missing] };

  return {
    configured: true,
    value: {
      firebase: {
        apiKey: env.VITE_FIREBASE_API_KEY as string,
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string,
        projectId: env.VITE_FIREBASE_PROJECT_ID as string,
        appId: env.VITE_FIREBASE_APP_ID as string,
      },
      supabaseUrl: env.VITE_SUPABASE_URL as string,
      supabasePublishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    },
  };
}
