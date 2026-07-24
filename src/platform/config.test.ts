import { describe, expect, it } from 'vitest';
import { readPublicConfig } from './config';

describe('public browser configuration', () => {
  it('fails closed and identifies missing public settings', () => {
    const result = readPublicConfig({});
    expect(result.configured).toBe(false);
    if (!result.configured) {
      expect(result.missing).toContain('VITE_FIREBASE_PROJECT_ID');
      expect(result.missing).toContain('VITE_SUPABASE_PUBLISHABLE_KEY');
    }
  });

  it('accepts public Firebase and Supabase values without service credentials', () => {
    const result = readPublicConfig({
      VITE_FIREBASE_API_KEY: 'public-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'project.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'project',
      VITE_FIREBASE_APP_ID: 'app-id',
      VITE_SUPABASE_URL: 'https://project.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_public',
    });
    expect(result).toMatchObject({ configured: true, value: { supabasePublishableKey: 'sb_publishable_public' } });
  });
});
