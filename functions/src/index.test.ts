import { describe, expect, it } from 'vitest';
import { supabaseRoutingClaims } from './index.js';

describe('Supabase Firebase routing claims', () => {
  it('assigns only the authenticated Postgres routing role', () => {
    expect(supabaseRoutingClaims()).toEqual({ role: 'authenticated' });
    expect(Object.keys(supabaseRoutingClaims())).toEqual(['role']);
  });
});
