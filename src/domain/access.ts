export type AccessSource = 'expired' | 'user_deny' | 'user_allow' | 'role' | 'default_deny';

export interface AccessOverride {
  key: string;
  allowed: boolean;
}

export interface ResolveEffectiveAccessInput {
  roleGrants: readonly string[];
  userOverrides: readonly AccessOverride[];
  key?: string;
  now: Date;
  expiresAt: Date;
}

export interface AccessDecision {
  allowed: boolean;
  source: AccessSource;
}

export function resolveEffectiveAccess(input: ResolveEffectiveAccessInput): AccessDecision {
  if (input.expiresAt.getTime() <= input.now.getTime()) {
    return { allowed: false, source: 'expired' };
  }

  const key = input.key;
  if (!key) return { allowed: false, source: 'default_deny' };

  const overrides = input.userOverrides.filter((override) => override.key === key);
  if (overrides.some((override) => !override.allowed)) {
    return { allowed: false, source: 'user_deny' };
  }
  if (overrides.some((override) => override.allowed)) {
    return { allowed: true, source: 'user_allow' };
  }
  if (input.roleGrants.includes(key)) {
    return { allowed: true, source: 'role' };
  }
  return { allowed: false, source: 'default_deny' };
}

