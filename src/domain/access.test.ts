import { describe, expect, it } from 'vitest';
import { resolveEffectiveAccess } from './access';

const now = new Date('2026-07-24T12:00:00.000Z');
const validUntil = new Date('2026-07-25T12:00:00.000Z');

describe('effective access resolution', () => {
  it('defaults to denied when no role or user rule grants access', () => {
    expect(
      resolveEffectiveAccess({
        roleGrants: [],
        userOverrides: [],
        now,
        expiresAt: validUntil,
      }),
    ).toEqual({ allowed: false, source: 'default_deny' });
  });

  it('uses a role grant when no explicit user override exists', () => {
    expect(
      resolveEffectiveAccess({
        roleGrants: ['recipes.manage'],
        userOverrides: [],
        key: 'recipes.manage',
        now,
        expiresAt: validUntil,
      }),
    ).toEqual({ allowed: true, source: 'role' });
  });

  it('applies explicit user allow before a missing role grant', () => {
    expect(
      resolveEffectiveAccess({
        roleGrants: [],
        userOverrides: [{ key: 'recipes.manage', allowed: true }],
        key: 'recipes.manage',
        now,
        expiresAt: validUntil,
      }),
    ).toEqual({ allowed: true, source: 'user_allow' });
  });

  it('applies explicit user deny before both user allow and role grant', () => {
    expect(
      resolveEffectiveAccess({
        roleGrants: ['recipes.manage'],
        userOverrides: [
          { key: 'recipes.manage', allowed: true },
          { key: 'recipes.manage', allowed: false },
        ],
        key: 'recipes.manage',
        now,
        expiresAt: validUntil,
      }),
    ).toEqual({ allowed: false, source: 'user_deny' });
  });

  it('fails closed when the entitlement snapshot is expired', () => {
    expect(
      resolveEffectiveAccess({
        roleGrants: ['recipes.manage'],
        userOverrides: [],
        key: 'recipes.manage',
        now,
        expiresAt: new Date('2026-07-24T11:59:59.999Z'),
      }),
    ).toEqual({ allowed: false, source: 'expired' });
  });
});
