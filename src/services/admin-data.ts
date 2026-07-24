import { SupabaseClient } from '@supabase/supabase-js';
import { RecipeInput, validateRecipe } from '../domain/recipes';

export interface EffectiveAccess {
  roles: string[];
  permissions: Record<string, { allowed: boolean; source: string }>;
  features: Record<string, boolean>;
  expiresAt: string;
}

export interface RoleRecord {
  id: string;
  key: string;
  displayName: string;
  reserved: boolean;
}

export interface AccessOption {
  key: string;
  displayName: string;
  description: string;
}

export interface RecipeRecord extends RecipeInput {
  id: string;
  status: 'draft' | 'published' | 'archived';
  version: number;
}

function unwrap<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error('The server returned no data.');
  return data;
}

export class AdminDataService {
  constructor(private readonly client: SupabaseClient) {}

  async getEffectiveAccess(): Promise<EffectiveAccess> {
    const { data, error } = await this.client.schema('api').rpc('effective_access');
    return unwrap(data as EffectiveAccess | null, error);
  }

  async listRoles(): Promise<RoleRecord[]> {
    const { data, error } = await this.client
      .from('roles')
      .select('id,role_key,display_name,is_reserved')
      .order('display_name');
    return unwrap(data, error).map((role) => ({
      id: role.id,
      key: role.role_key,
      displayName: role.display_name,
      reserved: role.is_reserved,
    }));
  }

  async listPermissions(): Promise<AccessOption[]> {
    const { data, error } = await this.client.from('permissions')
      .select('permission_key,display_name,description').order('permission_key');
    return unwrap(data, error).map((item) => ({
      key: item.permission_key, displayName: item.display_name, description: item.description,
    }));
  }

  async listFeatures(): Promise<AccessOption[]> {
    const { data, error } = await this.client.from('features')
      .select('feature_key,display_name,description').order('feature_key');
    return unwrap(data, error).map((item) => ({
      key: item.feature_key, displayName: item.display_name, description: item.description,
    }));
  }

  async createRole(input: { key: string; displayName: string; permissions: string[]; features: string[] }): Promise<void> {
    const key = input.key.trim().toLowerCase();
    if (!/^[a-z][a-z0-9_]{1,49}$/.test(key)) throw new Error('Role key must use lowercase letters, numbers, and underscores.');
    if (!input.displayName.trim()) throw new Error('Role name is required.');
    const { data, error } = await this.client.schema('api').rpc('create_role', {
      new_role_key: key, new_display_name: input.displayName.trim(),
    });
    const role = unwrap(data as { id: string } | null, error);
    for (const permission of input.permissions) {
      const result = await this.client.schema('api').rpc('set_role_permission', {
        target_role_id: role.id, target_permission_key: permission, should_allow: true,
      });
      if (result.error) throw new Error(result.error.message);
    }
    for (const feature of input.features) {
      const result = await this.client.schema('api').rpc('set_role_feature', {
        target_role_id: role.id, target_feature_key: feature, should_allow: true,
      });
      if (result.error) throw new Error(result.error.message);
    }
  }

  async setUserPermission(firebaseUid: string, permissionKey: string, allowed: boolean): Promise<void> {
    const { error } = await this.client.schema('api').rpc('set_user_permission_override', {
      target_firebase_uid: firebaseUid.trim(), target_permission_key: permissionKey, override_allowed: allowed,
    });
    if (error) throw new Error(error.message);
  }

  async setUserFeature(firebaseUid: string, featureKey: string, allowed: boolean): Promise<void> {
    const { error } = await this.client.schema('api').rpc('set_user_feature_override', {
      target_firebase_uid: firebaseUid.trim(), target_feature_key: featureKey, override_allowed: allowed,
    });
    if (error) throw new Error(error.message);
  }

  async setUserRole(firebaseUid: string, roleId: string, assigned: boolean): Promise<void> {
    const { error } = await this.client.schema('api').rpc('assign_user_role', {
      target_firebase_uid: firebaseUid.trim(), target_role_id: roleId, should_assign: assigned,
    });
    if (error) throw new Error(error.message);
  }

  async listRecipes(): Promise<RecipeRecord[]> {
    const { data, error } = await this.client
      .from('recipes')
      .select('id,title,summary,ingredients,steps,minimum_age_months,status,version')
      .neq('status', 'archived')
      .order('updated_at', { ascending: false })
      .limit(100);
    return unwrap(data, error).map((recipe) => ({
      id: recipe.id,
      title: recipe.title,
      summary: recipe.summary,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      minimumAgeMonths: recipe.minimum_age_months,
      status: recipe.status,
      version: recipe.version,
    }));
  }

  async saveRecipe(input: unknown, actorFirebaseUid: string, id?: string, expectedVersion?: number): Promise<RecipeRecord> {
    const validation = validateRecipe(input);
    if (!validation.ok) throw new Error(validation.errors.map((item) => item.message).join(' '));
    if (!id) {
      const { data, error } = await this.client.from('recipes').insert({
        title: validation.value.title,
        summary: validation.value.summary,
        ingredients: validation.value.ingredients,
        steps: validation.value.steps,
        minimum_age_months: validation.value.minimumAgeMonths,
        status: 'draft',
        created_by_firebase_uid: actorFirebaseUid,
        updated_by_firebase_uid: actorFirebaseUid,
      }).select('id,title,summary,ingredients,steps,minimum_age_months,status,version').single();
      const recipe = unwrap(data, error);
      return {
        id: recipe.id, title: recipe.title, summary: recipe.summary,
        ingredients: recipe.ingredients, steps: recipe.steps,
        minimumAgeMonths: recipe.minimum_age_months, status: recipe.status, version: recipe.version,
      };
    }
    const { data, error } = await this.client.schema('api').rpc('update_recipe', {
      recipe_id: id,
      expected_version: expectedVersion,
      recipe_title: validation.value.title,
      recipe_summary: validation.value.summary,
      recipe_ingredients: validation.value.ingredients,
      recipe_steps: validation.value.steps,
      recipe_minimum_age_months: validation.value.minimumAgeMonths,
      recipe_status: 'draft',
    });
    const recipe = unwrap(data as Record<string, unknown> | null, error);
    return {
      id: recipe.id as string, title: recipe.title as string, summary: recipe.summary as string,
      ingredients: recipe.ingredients as string[], steps: recipe.steps as string[],
      minimumAgeMonths: recipe.minimum_age_months as number,
      status: recipe.status as RecipeRecord['status'], version: recipe.version as number,
    };
  }
}
