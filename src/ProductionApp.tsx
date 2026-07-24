import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AuthProvider, useAdminAuth } from './platform/auth';
import { createBrowserClients } from './platform/clients';
import { ConfigResult, readPublicConfig } from './platform/config';
import { AccessOption, AdminDataService, EffectiveAccess, RecipeRecord, RoleRecord } from './services/admin-data';
import { SupabaseClient } from '@supabase/supabase-js';

export function UnavailableState({ missing }: { missing: string[] }) {
  return (
    <main className="production-state">
      <section className="state-panel" aria-labelledby="setup-title">
        <img src="/numnam-logo.png" alt="NumNam logo" />
        <h1 id="setup-title">Admin connection required</h1>
        <p>This deployment is safely unavailable until its public Firebase and Supabase configuration is provided.</p>
        <details>
          <summary>Missing public settings</summary>
          <ul>{missing.map((key) => <li key={key}><code>{key}</code></li>)}</ul>
        </details>
        <p className="state-note">Never add Firebase Admin credentials or a Supabase secret/service-role key here.</p>
      </section>
    </main>
  );
}

function SignIn({ supabase }: { supabase: SupabaseClient }) {
  const auth = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  if (auth.loading) return <main className="production-state"><p>Checking admin session…</p></main>;
  if (auth.user) return <AdminWorkspace supabase={supabase} />;
  return (
    <main className="production-state">
      <form className="state-panel auth-form" onSubmit={(event) => {
        event.preventDefault();
        void auth.signIn(email.trim(), password);
      }}>
        <img src="/numnam-logo.png" alt="NumNam logo" />
        <h1>Admin sign in</h1>
        <p>Use your authorised NumNam Firebase account.</p>
        <label>Email<input required type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Password<input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {auth.error ? <p className="form-error" role="alert">{auth.error}</p> : null}
        <button type="submit">Sign in</button>
      </form>
    </main>
  );
}

function PermissionDenied({ name }: { name: string }) {
  return <section className="state-panel"><h2>{name} is locked</h2><p>Your assigned role does not grant access to this feature.</p></section>;
}

function AdminWorkspace({ supabase }: { supabase: SupabaseClient }) {
  const auth = useAdminAuth();
  const service = useMemo(() => new AdminDataService(supabase), [supabase]);
  const [access, setAccess] = useState<EffectiveAccess | null>(null);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [permissions, setPermissions] = useState<AccessOption[]>([]);
  const [features, setFeatures] = useState<AccessOption[]>([]);
  const [recipes, setRecipes] = useState<RecipeRecord[]>([]);
  const [active, setActive] = useState<'recipes' | 'roles'>('recipes');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void service.getEffectiveAccess().then(setAccess).catch(() => setError('Your access policy could not be loaded.'));
  }, [service]);

  const allowed = (permission: string) => access?.permissions[permission]?.allowed ?? false;
  async function loadRecipes() {
    try { setRecipes(await service.listRecipes()); } catch { setError('Recipes are unavailable until the database connection and policies are ready.'); }
  }
  async function loadRoles() {
    try {
      const [nextRoles, nextPermissions, nextFeatures] = await Promise.all([
        service.listRoles(), service.listPermissions(), service.listFeatures(),
      ]);
      setRoles(nextRoles); setPermissions(nextPermissions); setFeatures(nextFeatures);
    } catch { setError('Role management is unavailable until the database connection and policies are ready.'); }
  }

  useEffect(() => {
    if (!access) return;
    if (active === 'recipes' && allowed('recipes.read')) void loadRecipes();
    if (active === 'roles' && allowed('roles.manage')) void loadRoles();
  }, [access, active]);

  if (!access && !error) return <main className="production-state"><p>Loading access policy…</p></main>;
  return (
    <main className="production-admin">
      <aside className="production-nav">
        <div className="brand-lockup"><img src="/numnam-logo.png" alt="NumNam logo" /><strong>NumNam Admin</strong></div>
        <nav aria-label="Production admin modules">
          <button className={active === 'recipes' ? 'active' : ''} onClick={() => setActive('recipes')}>Recipes</button>
          <button className={active === 'roles' ? 'active' : ''} onClick={() => setActive('roles')}>Roles & access</button>
        </nav>
        <button className="secondary-action" onClick={() => void auth.signOut()}>Sign out</button>
      </aside>
      <section className="production-workspace">
        {error ? <div className="notice" role="alert">{error}</div> : null}
        {active === 'recipes'
          ? allowed('recipes.read') ? <RecipeManager actorFirebaseUid={auth.user!.uid} recipes={recipes} service={service} reload={loadRecipes} canEdit={allowed('recipes.manage')} /> : <PermissionDenied name="Recipes" />
          : allowed('roles.manage') ? <RoleManager roles={roles} permissions={permissions} features={features} service={service} reload={loadRoles} /> : <PermissionDenied name="Roles and access" />}
      </section>
    </main>
  );
}

function RecipeManager({ actorFirebaseUid, recipes, service, reload, canEdit }: { actorFirebaseUid: string; recipes: RecipeRecord[]; service: AdminDataService; reload(): Promise<void>; canEdit: boolean }) {
  const [message, setMessage] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await service.saveRecipe({
        title: form.get('title'),
        summary: form.get('summary'),
        ingredients: String(form.get('ingredients')).split('\n'),
        steps: String(form.get('steps')).split('\n'),
        minimumAgeMonths: Number(form.get('minimumAgeMonths')),
      }, actorFirebaseUid);
      event.currentTarget.reset();
      setMessage('Recipe saved.');
      await reload();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Recipe could not be saved.');
    }
  }
  return (
    <>
      <header className="module-header"><div><h1>Recipes</h1><p>Create and review age-appropriate recipe content backed by Supabase.</p></div></header>
      {canEdit ? <form className="production-form" onSubmit={(event) => void submit(event)}>
        <label>Title<input name="title" required /></label>
        <label>Minimum age (months)<input name="minimumAgeMonths" type="number" min="0" step="1" required /></label>
        <label className="wide">Summary<textarea name="summary" required /></label>
        <label>Ingredients, one per line<textarea name="ingredients" required /></label>
        <label>Steps, one per line<textarea name="steps" required /></label>
        <button type="submit">Save draft</button>
        {message ? <p role="status">{message}</p> : null}
      </form> : null}
      <div className="table-wrap"><table><thead><tr><th>Recipe</th><th>Minimum age</th><th>Status</th><th>Version</th></tr></thead><tbody>
        {recipes.map((recipe) => <tr key={recipe.id}><td><strong>{recipe.title}</strong><br /><small>{recipe.summary}</small></td><td>{recipe.minimumAgeMonths} months</td><td>{recipe.status}</td><td>{recipe.version}</td></tr>)}
      </tbody></table>{recipes.length === 0 ? <p className="empty-state">No recipes yet. Create the first reviewed draft.</p> : null}</div>
    </>
  );
}

function RoleManager({ roles, permissions, features, service, reload }: { roles: RoleRecord[]; permissions: AccessOption[]; features: AccessOption[]; service: AdminDataService; reload(): Promise<void> }) {
  const [message, setMessage] = useState<string | null>(null);
  const [overrideMessage, setOverrideMessage] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await service.createRole({
        key: String(form.get('roleKey')),
        displayName: String(form.get('displayName')),
        permissions: form.getAll('permissions').map(String),
        features: form.getAll('features').map(String),
      });
      event.currentTarget.reset();
      setMessage('Role and access grants saved.');
      await reload();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Role could not be saved.');
    }
  }
  async function submitOverride(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const uid = String(form.get('firebaseUid'));
    const allowed = form.get('decision') === 'allow';
    try {
      const permission = String(form.get('permission') ?? '');
      const feature = String(form.get('feature') ?? '');
      const roleId = String(form.get('roleId') ?? '');
      if (permission) await service.setUserPermission(uid, permission, allowed);
      if (feature) await service.setUserFeature(uid, feature, allowed);
      if (roleId) await service.setUserRole(uid, roleId, allowed);
      if (!permission && !feature && !roleId) throw new Error('Select a role, permission, or feature.');
      setOverrideMessage(`User override saved as ${allowed ? 'allowed' : 'denied'}.`);
    } catch (cause) {
      setOverrideMessage(cause instanceof Error ? cause.message : 'User override could not be saved.');
    }
  }
  return (
    <>
      <header className="module-header"><div><h1>Roles and access</h1><p>Review server-enforced roles, permissions, and feature access.</p></div></header>
      <form className="production-form" onSubmit={(event) => void submit(event)}>
        <label>Role name<input name="displayName" required /></label>
        <label>Stable role key<input name="roleKey" pattern="[a-z][a-z0-9_]{1,49}" required /></label>
        <fieldset><legend>Permissions</legend>{permissions.map((item) => <label className="check-row" key={item.key}><input type="checkbox" name="permissions" value={item.key} /><span>{item.displayName}<small>{item.description}</small></span></label>)}</fieldset>
        <fieldset><legend>App features</legend>{features.map((item) => <label className="check-row" key={item.key}><input type="checkbox" name="features" value={item.key} /><span>{item.displayName}<small>{item.description}</small></span></label>)}</fieldset>
        <button type="submit">Create role</button>
        {message ? <p role="status">{message}</p> : null}
      </form>
      <div className="table-wrap"><table><thead><tr><th>Role</th><th>Key</th><th>Protection</th></tr></thead><tbody>
        {roles.map((role) => <tr key={role.id}><td>{role.displayName}</td><td><code>{role.key}</code></td><td>{role.reserved ? 'Reserved' : 'Custom'}</td></tr>)}
      </tbody></table>{roles.length === 0 ? <p className="empty-state">No roles are visible to this account.</p> : null}</div>
      <form className="production-form" onSubmit={(event) => void submitOverride(event)}>
        <h2 className="wide">User-specific access override</h2>
        <label>Firebase user ID<input name="firebaseUid" required /></label>
        <label>Decision<select name="decision"><option value="deny">Deny</option><option value="allow">Allow</option></select></label>
        <label>Permission<select name="permission"><option value="">No permission override</option>{permissions.map((item) => <option key={item.key} value={item.key}>{item.displayName}</option>)}</select></label>
        <label>Feature<select name="feature"><option value="">No feature override</option>{features.map((item) => <option key={item.key} value={item.key}>{item.displayName}</option>)}</select></label>
        <label>Role<select name="roleId"><option value="">No role assignment</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.displayName}</option>)}</select></label>
        <button type="submit">Save user override</button>
        {overrideMessage ? <p role="status">{overrideMessage}</p> : null}
      </form>
      <p className="state-note">Every role and feature change uses audited server RPCs. Direct browser writes are intentionally unavailable.</p>
    </>
  );
}

export function ProductionApp({ config = readPublicConfig(import.meta.env) }: { config?: ConfigResult }) {
  if (!config.configured) return <UnavailableState missing={config.missing} />;
  const clients = createBrowserClients(config.value);
  return <AuthProvider auth={clients.auth}><SignIn supabase={clients.supabase} /></AuthProvider>;
}
