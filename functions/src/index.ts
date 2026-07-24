import { beforeUserCreated, beforeUserSignedIn } from 'firebase-functions/v2/identity';

export interface SupabaseRoutingClaims {
  role: 'authenticated';
}

export function supabaseRoutingClaims(): SupabaseRoutingClaims {
  return { role: 'authenticated' };
}

export const assignSupabaseRoleBeforeCreate = beforeUserCreated(() => ({
  customClaims: supabaseRoutingClaims(),
}));

export const assignSupabaseRoleBeforeSignIn = beforeUserSignedIn(() => ({
  customClaims: supabaseRoutingClaims(),
}));
