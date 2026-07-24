import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '../..');
const migrationsDirectory = resolve(projectRoot, 'supabase/migrations');

function migrationSql() {
  return readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => readFileSync(resolve(migrationsDirectory, file), 'utf8'))
    .join('\n')
    .toLowerCase();
}

describe('Supabase migration security invariants', () => {
  const sql = migrationSql();

  it.each([
    'profiles',
    'children',
    'caregiver_access',
    'policy_versions',
    'policy_acceptances',
    'recipes',
    'activity_events',
    'admin_audit_records',
    'roles',
    'permissions',
    'role_permissions',
    'user_role_assignments',
    'user_permission_overrides',
    'features',
    'role_feature_access',
    'user_feature_overrides',
  ])('enables RLS for public.%s', (table) => {
    const explicitEnable = new RegExp(
      `alter\\s+table\\s+(?:public\\.)?${table}\\s+enable\\s+row\\s+level\\s+security`,
    );
    const dynamicEnable =
      /format\s*\(\s*'alter table public\.%i enable row level security'/;
    const dynamicTableEntry = new RegExp(`['"]${table}['"]`);
    expect(explicitEnable.test(sql) || (dynamicEnable.test(sql) && dynamicTableEntry.test(sql))).toBe(
      true,
    );
  });

  it('does not use deprecated role helpers or user-controlled metadata for authorization', () => {
    expect(sql).not.toContain('auth.role()');
    expect(sql).not.toContain('user_metadata');
    expect(sql).not.toContain('raw_user_meta_data');
  });

  it('uses the Firebase token subject as text identity', () => {
    expect(sql).toMatch(/auth\.jwt\(\)\s*->>\s*'sub'/);
    expect(sql).toMatch(/firebase_uid\s+text/);
  });

  it('keeps audit records immutable to browser roles', () => {
    expect(sql).toMatch(/revoke\s+(?:update|delete|all)[^;]*admin_audit_records[^;]*authenticated/);
    expect(sql).not.toMatch(
      /create\s+policy[^;]*admin_audit_records[^;]*for\s+(?:update|delete)[^;]*to\s+authenticated/,
    );
  });

  it('requires a non-empty reason in the audited raw-data RPC', () => {
    expect(sql).toMatch(/access_reason/);
    expect(sql).toMatch(/(?:nullif\s*\(\s*btrim|length\s*\(\s*btrim)/);
    expect(sql).toMatch(/raise\s+exception/);
  });

  it('revokes privileged function execution from PUBLIC and anon', () => {
    expect(sql).toMatch(/revoke\s+execute\s+on\s+function[^;]*from\s+public/);
    expect(sql).toMatch(/revoke\s+execute\s+on\s+function[^;]*from\s+(?:public\s*,\s*)?anon/);
  });

  it('prevents changing or deleting the reserved super-admin role', () => {
    expect(sql).toMatch(/super_admin/);
    expect(sql).toMatch(/(?:trigger|raise\s+exception)[^;]*(?:reserved|last|super_admin)/s);
  });

  it('serializes removal checks so concurrent requests cannot remove every super admin', () => {
    expect(sql).toMatch(
      /protect_last_super_admin[\s\S]*?(?:pg_advisory_xact_lock|for\s+(?:no\s+key\s+)?update)/,
    );
  });

  it('provides a privileged, audited RBAC mutation path with an escalation guard', () => {
    expect(sql).toMatch(/create\s+or\s+replace\s+function\s+api\.set_role_permission/);
    expect(sql).toMatch(/create\s+or\s+replace\s+function\s+api\.assign_user_role/);
    expect(sql).toMatch(/set_role_permission[\s\S]*?roles\.manage[\s\S]*?admin_audit_records/);
    expect(sql).toMatch(/assign_user_role[\s\S]*?roles\.manage[\s\S]*?admin_audit_records/);
    expect(sql).toMatch(/permission escalation is not allowed/);
  });

  it.each([
    ['create_role', 'roles\\.manage'],
    ['set_role_feature', 'features\\.manage'],
    ['set_user_permission_override', 'roles\\.manage'],
    ['set_user_feature_override', 'features\\.manage'],
  ])('protects and audits api.%s', (functionName, managePermission) => {
    expect(sql).toMatch(new RegExp(`create\\s+or\\s+replace\\s+function\\s+api\\.${functionName}`));
    expect(sql).toMatch(
      new RegExp(`${functionName}[\\s\\S]*?${managePermission}[\\s\\S]*?admin_audit_records`),
    );
    expect(sql).toMatch(
      new RegExp(
        `revoke\\s+execute\\s+on\\s+function\\s+api\\.${functionName}[^;]*from\\s+public\\s*,\\s*anon`,
      ),
    );
    expect(sql).toMatch(
      new RegExp(
        `grant\\s+execute\\s+on\\s+function\\s+api\\.${functionName}[^;]*to\\s+authenticated`,
      ),
    );
  });

  it('prevents feature and per-user permission escalation', () => {
    expect(sql).toMatch(/set_role_feature[\s\S]*?has_feature[\s\S]*?feature escalation is not allowed/);
    expect(sql).toMatch(
      /set_user_feature_override[\s\S]*?has_feature[\s\S]*?feature escalation is not allowed/,
    );
    expect(sql).toMatch(
      /set_user_permission_override[\s\S]*?has_permission[\s\S]*?permission escalation is not allowed/,
    );
  });

  it('does not add direct authenticated mutation policies for RBAC tables', () => {
    for (const table of [
      'roles',
      'role_permissions',
      'user_role_assignments',
      'user_permission_overrides',
      'role_feature_access',
      'user_feature_overrides',
    ]) {
      expect(sql).not.toMatch(
        new RegExp(
          `create\\s+policy[^;]*on\\s+public\\.${table}[^;]*for\\s+(?:insert|update|delete)`,
          's',
        ),
      );
    }
  });

  it('enforces recipe optimistic concurrency in the database write path', () => {
    expect(sql).toMatch(/expected_version/);
    expect(sql).toMatch(/version\s*=\s*(?:version|[a-z_]+\.version)\s*\+\s*1/);
    expect(sql).toMatch(/(?:conflict|version mismatch|stale)/);
  });
});

describe('repository secret safety', () => {
  const clientFiles = readdirSync(resolve(projectRoot, 'src'), { recursive: true })
    .filter((entry): entry is string => typeof entry === 'string')
    .filter((entry) => /\.(?:ts|tsx|js|jsx)$/.test(entry))
    .filter((entry) => !/(?:^|[\\/])test(?:[\\/]|$)|\.test\.[^.]+$/.test(entry))
    .map((entry) => readFileSync(resolve(projectRoot, 'src', entry), 'utf8'))
    .join('\n');

  it('does not expose service-role or secret keys through browser environment names', () => {
    expect(clientFiles).not.toMatch(/(?:vite_|next_public_).*(?:service_role|secret_key)/i);
  });

  it('does not embed JWTs or private keys in browser source', () => {
    expect(clientFiles).not.toMatch(/-----begin private key-----/i);
    expect(clientFiles).not.toMatch(/eyj[a-z0-9_-]{20,}\.[a-z0-9_-]{20,}\.[a-z0-9_-]{20,}/i);
  });
});
