begin;

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
create schema if not exists api;
revoke all on schema private from public, anon, authenticated;
grant usage on schema api to authenticated;

create type public.recipe_status as enum ('draft', 'published', 'archived');

create table public.profiles (
  firebase_uid text primary key,
  display_name text not null check (length(btrim(display_name)) between 1 and 120),
  email text,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.children (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_firebase_uid text not null references public.profiles(firebase_uid) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 1 and 120),
  birth_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index children_owner_idx on public.children(owner_firebase_uid);

create table public.caregiver_access (
  child_id uuid not null references public.children(id) on delete cascade,
  caregiver_firebase_uid text not null references public.profiles(firebase_uid) on delete cascade,
  granted_by_firebase_uid text not null references public.profiles(firebase_uid),
  created_at timestamptz not null default now(),
  primary key (child_id, caregiver_firebase_uid)
);
create index caregiver_access_user_idx on public.caregiver_access(caregiver_firebase_uid);

create table public.policy_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  policy_key text not null,
  version integer not null check (version > 0),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  effective_at timestamptz not null,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  unique(policy_key, version)
);

create table public.policy_acceptances (
  policy_version_id uuid not null references public.policy_versions(id),
  firebase_uid text not null references public.profiles(firebase_uid) on delete cascade,
  accepted_at timestamptz not null default now(),
  primary key (policy_version_id, firebase_uid)
);

create table public.recipes (
  id uuid primary key default extensions.gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 160),
  summary text not null check (length(btrim(summary)) between 1 and 500),
  ingredients jsonb not null check (jsonb_typeof(ingredients) = 'array' and jsonb_array_length(ingredients) > 0),
  steps jsonb not null check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) > 0),
  minimum_age_months integer not null check (minimum_age_months >= 0),
  status public.recipe_status not null default 'draft',
  version integer not null default 1 check (version > 0),
  created_by_firebase_uid text not null references public.profiles(firebase_uid),
  updated_by_firebase_uid text not null references public.profiles(firebase_uid),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recipes_status_idx on public.recipes(status, updated_at desc);

create table public.activity_events (
  id uuid primary key default extensions.gen_random_uuid(),
  firebase_uid text not null references public.profiles(firebase_uid) on delete cascade,
  event_key text not null check (event_key in (
    'auth.sign_in', 'auth.sign_out', 'policy.accepted', 'recipe.viewed',
    'feature.locked', 'sync.completed', 'sync.failed'
  )),
  payload jsonb not null default '{}'::jsonb check (
    jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 4096
  ),
  occurred_at timestamptz not null default now()
);
create index activity_events_user_time_idx on public.activity_events(firebase_uid, occurred_at desc);

create table public.admin_audit_records (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_firebase_uid text not null,
  action_key text not null check (length(btrim(action_key)) between 1 and 100),
  resource_type text not null check (length(btrim(resource_type)) between 1 and 60),
  resource_id text,
  access_reason text not null check (length(btrim(access_reason)) between 3 and 500),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 4096
  ),
  occurred_at timestamptz not null default now()
);
create index admin_audit_actor_time_idx on public.admin_audit_records(actor_firebase_uid, occurred_at desc);

create table public.roles (
  id uuid primary key default extensions.gen_random_uuid(),
  role_key text not null unique check (role_key ~ '^[a-z][a-z0-9_]{1,49}$'),
  display_name text not null check (length(btrim(display_name)) between 1 and 80),
  is_reserved boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.permissions (
  permission_key text primary key check (permission_key ~ '^[a-z][a-z0-9_.]{2,79}$'),
  display_name text not null,
  description text not null default ''
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_key text not null references public.permissions(permission_key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_key)
);

create table public.user_role_assignments (
  firebase_uid text not null references public.profiles(firebase_uid) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  assigned_by_firebase_uid text not null,
  created_at timestamptz not null default now(),
  primary key (firebase_uid, role_id)
);
create index user_role_assignments_role_idx on public.user_role_assignments(role_id);

create table public.user_permission_overrides (
  firebase_uid text not null references public.profiles(firebase_uid) on delete cascade,
  permission_key text not null references public.permissions(permission_key) on delete cascade,
  allowed boolean not null,
  assigned_by_firebase_uid text not null,
  created_at timestamptz not null default now(),
  primary key (firebase_uid, permission_key)
);

create table public.features (
  feature_key text primary key check (feature_key ~ '^[a-z][a-z0-9_.]{2,79}$'),
  display_name text not null,
  description text not null default '',
  default_enabled boolean not null default false
);

create table public.role_feature_access (
  role_id uuid not null references public.roles(id) on delete cascade,
  feature_key text not null references public.features(feature_key) on delete cascade,
  allowed boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (role_id, feature_key)
);

create table public.user_feature_overrides (
  firebase_uid text not null references public.profiles(firebase_uid) on delete cascade,
  feature_key text not null references public.features(feature_key) on delete cascade,
  allowed boolean not null,
  assigned_by_firebase_uid text not null,
  created_at timestamptz not null default now(),
  primary key (firebase_uid, feature_key)
);

create table public.private_attachments (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_firebase_uid text not null references public.profiles(firebase_uid) on delete cascade,
  child_id uuid references public.children(id) on delete cascade,
  storage_path text not null unique,
  content_type text not null,
  byte_size bigint not null check (byte_size between 1 and 10485760),
  created_at timestamptz not null default now(),
  check (storage_path like owner_firebase_uid || '/%')
);
create index private_attachments_owner_idx on public.private_attachments(owner_firebase_uid);

-- Receipt reservation is the idempotency boundary. Domain writes remain separate,
-- typed RPCs so this endpoint can never become a generic payload write escape hatch.
create table public.sync_mutation_receipts (
  id uuid primary key default extensions.gen_random_uuid(),
  firebase_uid text not null references public.profiles(firebase_uid) on delete cascade,
  idempotency_key uuid not null,
  entity_type text not null check (entity_type in ('profile','child','consent','recipe')),
  operation text not null check (operation in ('create','update','delete')),
  payload_version integer not null check (payload_version > 0),
  status text not null default 'reserved' check (status in ('reserved','applied','failed')),
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  unique(firebase_uid, idempotency_key)
);
create index sync_receipts_owner_time_idx on public.sync_mutation_receipts(firebase_uid, created_at desc);

insert into public.roles(role_key, display_name, is_reserved) values
  ('parent', 'Parent', true),
  ('admin', 'Administrator', true),
  ('super_admin', 'Super administrator', true);

insert into public.permissions(permission_key, display_name) values
  ('users.read', 'View users'),
  ('users.manage', 'Manage users'),
  ('recipes.read', 'View recipes'),
  ('recipes.manage', 'Manage recipes'),
  ('recipes.publish', 'Publish recipes'),
  ('roles.manage', 'Manage roles'),
  ('features.manage', 'Manage feature access'),
  ('audit.read', 'View audit records'),
  ('health.raw.read', 'Read raw health data');

insert into public.features(feature_key, display_name, default_enabled) values
  ('app.today', 'Today', false),
  ('app.recipes', 'Recipes', false),
  ('app.shop', 'Shop', false),
  ('app.more', 'More', false),
  ('app.nanha_yatra', 'Nanha Yatra', false),
  ('admin.users', 'Admin users', false),
  ('admin.recipes', 'Admin recipes', false),
  ('admin.roles', 'Admin roles', false),
  ('admin.audit', 'Admin audit', false);

insert into public.role_permissions(role_id, permission_key)
select r.id, p.permission_key from public.roles r cross join public.permissions p
where r.role_key = 'super_admin';
insert into public.role_permissions(role_id, permission_key)
select r.id, p.permission_key from public.roles r join public.permissions p
  on p.permission_key in ('users.read','recipes.read','recipes.manage','recipes.publish','audit.read')
where r.role_key = 'admin';
insert into public.role_permissions(role_id, permission_key)
select r.id, 'recipes.read' from public.roles r where r.role_key = 'parent';

insert into public.role_feature_access(role_id, feature_key)
select r.id, f.feature_key from public.roles r cross join public.features f
where r.role_key = 'super_admin';
insert into public.role_feature_access(role_id, feature_key)
select r.id, f.feature_key from public.roles r join public.features f
  on f.feature_key in ('app.today','app.recipes','app.shop','app.more')
where r.role_key in ('parent','admin');

create or replace function private.firebase_uid()
returns text language sql stable security invoker set search_path = ''
as $$ select nullif((select auth.jwt()->>'sub'), '') $$;

create or replace function private.has_permission(target_uid text, target_permission text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.user_permission_overrides upo
      where upo.firebase_uid = target_uid and upo.permission_key = target_permission and not upo.allowed
    ) then false
    when exists (
      select 1 from public.user_permission_overrides upo
      where upo.firebase_uid = target_uid and upo.permission_key = target_permission and upo.allowed
    ) then true
    else exists (
      select 1
      from public.user_role_assignments ura
      join public.role_permissions rp on rp.role_id = ura.role_id
      where ura.firebase_uid = target_uid and rp.permission_key = target_permission
    )
  end
$$;

create or replace function private.is_super_admin(target_uid text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.user_role_assignments ura
    join public.roles r on r.id = ura.role_id
    where ura.firebase_uid = target_uid and r.role_key = 'super_admin'
  )
$$;

create or replace function private.has_feature(target_uid text, target_feature text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.user_feature_overrides ufo
      where ufo.firebase_uid=target_uid and ufo.feature_key=target_feature and not ufo.allowed
    ) then false
    when exists (
      select 1 from public.user_feature_overrides ufo
      where ufo.firebase_uid=target_uid and ufo.feature_key=target_feature and ufo.allowed
    ) then true
    else exists (
      select 1 from public.user_role_assignments ura
      join public.role_feature_access rfa on rfa.role_id=ura.role_id
      where ura.firebase_uid=target_uid and rfa.feature_key=target_feature and rfa.allowed
    )
  end
$$;

create or replace function private.can_access_child(target_child uuid, target_uid text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.children c
    where c.id = target_child and (
      c.owner_firebase_uid = target_uid or exists (
        select 1 from public.caregiver_access ca
        where ca.child_id = c.id and ca.caregiver_firebase_uid = target_uid
      )
    )
  )
$$;

revoke all on function private.firebase_uid() from public, anon;
revoke all on function private.has_permission(text, text) from public, anon;
revoke all on function private.is_super_admin(text) from public, anon;
revoke all on function private.has_feature(text, text) from public, anon;
revoke all on function private.can_access_child(uuid, text) from public, anon;
revoke execute on function private.has_permission(text, text) from public;
revoke execute on function private.has_permission(text, text) from anon;
grant execute on function private.firebase_uid() to authenticated;
grant execute on function private.has_permission(text, text) to authenticated;
grant execute on function private.is_super_admin(text) to authenticated;
grant execute on function private.has_feature(text, text) to authenticated;
grant execute on function private.can_access_child(uuid, text) to authenticated;

create or replace function private.protect_reserved_role()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.role_key = 'super_admin' then
    raise exception 'reserved super_admin role cannot be changed or deleted';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end
$$;
create trigger protect_reserved_role
before update or delete on public.roles
for each row execute function private.protect_reserved_role();

create or replace function private.protect_last_super_admin()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare reserved_role_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('numnam:last_super_admin'));
  select id into reserved_role_id from public.roles where role_key = 'super_admin';
  if old.role_id = reserved_role_id and
     (select count(*) from public.user_role_assignments where role_id = reserved_role_id) <= 1 then
    raise exception 'last super_admin assignment cannot be removed';
  end if;
  return old;
end
$$;
create trigger protect_last_super_admin
before delete on public.user_role_assignments
for each row execute function private.protect_last_super_admin();

create or replace function private.prevent_audit_mutation()
returns trigger language plpgsql set search_path = ''
as $$ begin raise exception 'admin audit records are immutable'; end $$;
create trigger prevent_audit_mutation before update or delete on public.admin_audit_records
for each row execute function private.prevent_audit_mutation();

create or replace function api.effective_access()
returns jsonb language sql stable security definer set search_path = ''
as $$
  with me as (select private.firebase_uid() uid),
  role_rows as (
    select distinct r.role_key from public.user_role_assignments ura
    join public.roles r on r.id = ura.role_id join me on me.uid = ura.firebase_uid
  ),
  permission_rows as (
    select p.permission_key,
      private.has_permission((select uid from me), p.permission_key) allowed,
      case
        when exists (select 1 from public.user_permission_overrides u where u.firebase_uid=(select uid from me) and u.permission_key=p.permission_key and not u.allowed) then 'user_deny'
        when exists (select 1 from public.user_permission_overrides u where u.firebase_uid=(select uid from me) and u.permission_key=p.permission_key and u.allowed) then 'user_allow'
        when private.has_permission((select uid from me), p.permission_key) then 'role'
        else 'default_deny'
      end source
    from public.permissions p
  ),
  feature_rows as (
    select f.feature_key,
      case
        when exists (select 1 from public.user_feature_overrides u where u.firebase_uid=(select uid from me) and u.feature_key=f.feature_key and not u.allowed) then false
        when exists (select 1 from public.user_feature_overrides u where u.firebase_uid=(select uid from me) and u.feature_key=f.feature_key and u.allowed) then true
        when exists (
          select 1 from public.user_role_assignments ura
          join public.role_feature_access rfa on rfa.role_id=ura.role_id
          where ura.firebase_uid=(select uid from me) and rfa.feature_key=f.feature_key and rfa.allowed
        ) then true else f.default_enabled
      end allowed
    from public.features f
  )
  select jsonb_build_object(
    'roles', coalesce((select jsonb_agg(role_key order by role_key) from role_rows), '[]'::jsonb),
    'permissions', coalesce((select jsonb_object_agg(permission_key, jsonb_build_object('allowed',allowed,'source',source)) from permission_rows), '{}'::jsonb),
    'features', coalesce((select jsonb_object_agg(feature_key, allowed) from feature_rows), '{}'::jsonb),
    'expires_at', now() + interval '24 hours'
  )
$$;

create or replace function api.audited_raw_access(
  resource_type text,
  resource_id uuid,
  access_reason text
) returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare actor text := private.firebase_uid(); result jsonb;
begin
  if actor is null or not private.is_super_admin(actor) then
    raise exception 'not authorized';
  end if;
  if nullif(btrim(access_reason), '') is null or length(btrim(access_reason)) < 3 then
    raise exception 'access reason is required';
  end if;
  if resource_type = 'child' then
    select to_jsonb(c) into result from public.children c where c.id = resource_id;
  elsif resource_type = 'private_attachment' then
    select to_jsonb(a) into result from public.private_attachments a where a.id = resource_id;
  else
    raise exception 'unsupported resource type';
  end if;
  if result is null then raise exception 'resource not found'; end if;
  insert into public.admin_audit_records(
    actor_firebase_uid, action_key, resource_type, resource_id, access_reason
  ) values (actor, 'raw_data.read', resource_type, resource_id::text, btrim(access_reason));
  return result;
end
$$;

create or replace function api.set_role_permission(
  target_role_id uuid,
  target_permission_key text,
  should_allow boolean
) returns void language plpgsql volatile security definer set search_path = ''
as $$
declare actor text := private.firebase_uid(); target_role_key text;
begin
  if actor is null or not private.is_super_admin(actor)
     or not private.has_permission(actor, 'roles.manage') then
    raise exception 'not authorized';
  end if;
  if should_allow and not private.has_permission(actor, target_permission_key) then
    raise exception 'permission escalation is not allowed; cannot grant a permission the actor does not possess';
  end if;
  select role_key into target_role_key from public.roles where id=target_role_id;
  if target_role_key is null or target_role_key='super_admin' then
    raise exception 'reserved role permissions cannot be changed';
  end if;
  if should_allow then
    insert into public.role_permissions(role_id, permission_key)
    values(target_role_id, target_permission_key) on conflict do nothing;
  else
    delete from public.role_permissions
    where role_id=target_role_id and permission_key=target_permission_key;
  end if;
  insert into public.admin_audit_records(actor_firebase_uid,action_key,resource_type,resource_id,access_reason,metadata)
  values(actor,'rbac.role_permission.changed','role',target_role_id::text,'Administrative RBAC change',
    jsonb_build_object('permission_key',target_permission_key,'allowed',should_allow));
end
$$;

create or replace function api.create_role(
  new_role_key text,
  new_display_name text
) returns public.roles language plpgsql volatile security definer set search_path = ''
as $$
declare actor text := private.firebase_uid(); created_role public.roles;
begin
  if actor is null or not private.is_super_admin(actor)
     or not private.has_permission(actor,'roles.manage') then
    raise exception 'not authorized';
  end if;
  if new_role_key in ('parent','admin','super_admin') then
    raise exception 'reserved role key cannot be created';
  end if;
  insert into public.roles(role_key,display_name,is_reserved)
  values(new_role_key,btrim(new_display_name),false)
  returning * into created_role;
  insert into public.admin_audit_records(
    actor_firebase_uid,action_key,resource_type,resource_id,access_reason,metadata
  ) values(
    actor,'rbac.role.created','role',created_role.id::text,'Administrative RBAC change',
    jsonb_build_object('role_key',created_role.role_key)
  );
  return created_role;
end
$$;

create or replace function api.set_role_feature(
  target_role_id uuid,
  target_feature_key text,
  should_allow boolean
) returns void language plpgsql volatile security definer set search_path = ''
as $$
declare actor text := private.firebase_uid(); target_role_key text;
begin
  if actor is null or not private.is_super_admin(actor)
     or not private.has_permission(actor,'features.manage') then
    raise exception 'not authorized';
  end if;
  if should_allow and not private.has_feature(actor,target_feature_key) then
    raise exception 'feature escalation is not allowed; cannot grant unavailable feature';
  end if;
  select role_key into target_role_key from public.roles where id=target_role_id;
  if target_role_key is null then raise exception 'role not found'; end if;
  if target_role_key='super_admin' then
    raise exception 'reserved super_admin feature access cannot be changed';
  end if;
  if should_allow then
    insert into public.role_feature_access(role_id,feature_key,allowed)
    values(target_role_id,target_feature_key,true)
    on conflict(role_id,feature_key) do update set allowed=true;
  else
    delete from public.role_feature_access
    where role_id=target_role_id and feature_key=target_feature_key;
  end if;
  insert into public.admin_audit_records(
    actor_firebase_uid,action_key,resource_type,resource_id,access_reason,metadata
  ) values(
    actor,'rbac.role_feature.changed','role',target_role_id::text,'Administrative feature change',
    jsonb_build_object('feature_key',target_feature_key,'allowed',should_allow)
  );
end
$$;

create or replace function api.set_user_permission_override(
  target_firebase_uid text,
  target_permission_key text,
  override_allowed boolean
) returns void language plpgsql volatile security definer set search_path = ''
as $$
declare actor text := private.firebase_uid(); super_admin_role_id uuid;
begin
  if actor is null or not private.is_super_admin(actor)
     or not private.has_permission(actor,'roles.manage') then
    raise exception 'not authorized';
  end if;
  if override_allowed and not private.has_permission(actor,target_permission_key) then
    raise exception 'permission escalation is not allowed; cannot grant unavailable permission';
  end if;
  if not override_allowed and target_permission_key='roles.manage' then
    perform pg_advisory_xact_lock(hashtext('numnam:last_super_admin'));
    select id into super_admin_role_id from public.roles where role_key='super_admin';
    if exists (
      select 1 from public.user_role_assignments
      where firebase_uid=target_firebase_uid and role_id=super_admin_role_id
    ) and (
      select count(*) from public.user_role_assignments where role_id=super_admin_role_id
    ) <= 1 then
      raise exception 'last super_admin must retain roles.manage';
    end if;
  end if;
  insert into public.user_permission_overrides(
    firebase_uid,permission_key,allowed,assigned_by_firebase_uid
  ) values(target_firebase_uid,target_permission_key,override_allowed,actor)
  on conflict(firebase_uid,permission_key) do update set
    allowed=excluded.allowed,assigned_by_firebase_uid=actor,created_at=now();
  insert into public.admin_audit_records(
    actor_firebase_uid,action_key,resource_type,resource_id,access_reason,metadata
  ) values(
    actor,'rbac.user_permission.changed','profile',target_firebase_uid,'Administrative RBAC change',
    jsonb_build_object('permission_key',target_permission_key,'allowed',override_allowed)
  );
end
$$;

create or replace function api.set_user_feature_override(
  target_firebase_uid text,
  target_feature_key text,
  override_allowed boolean
) returns void language plpgsql volatile security definer set search_path = ''
as $$
declare actor text := private.firebase_uid();
begin
  if actor is null or not private.is_super_admin(actor)
     or not private.has_permission(actor,'features.manage') then
    raise exception 'not authorized';
  end if;
  if override_allowed and not private.has_feature(actor,target_feature_key) then
    raise exception 'feature escalation is not allowed; cannot grant unavailable feature';
  end if;
  insert into public.user_feature_overrides(
    firebase_uid,feature_key,allowed,assigned_by_firebase_uid
  ) values(target_firebase_uid,target_feature_key,override_allowed,actor)
  on conflict(firebase_uid,feature_key) do update set
    allowed=excluded.allowed,assigned_by_firebase_uid=actor,created_at=now();
  insert into public.admin_audit_records(
    actor_firebase_uid,action_key,resource_type,resource_id,access_reason,metadata
  ) values(
    actor,'rbac.user_feature.changed','profile',target_firebase_uid,'Administrative feature change',
    jsonb_build_object('feature_key',target_feature_key,'allowed',override_allowed)
  );
end
$$;

create or replace function api.assign_user_role(
  target_firebase_uid text,
  target_role_id uuid,
  should_assign boolean
) returns void language plpgsql volatile security definer set search_path = ''
as $$
declare actor text := private.firebase_uid(); target_role_key text;
begin
  if actor is null or not private.is_super_admin(actor)
     or not private.has_permission(actor, 'roles.manage') then
    raise exception 'not authorized';
  end if;
  select role_key into target_role_key from public.roles where id=target_role_id;
  if target_role_key is null then raise exception 'role not found'; end if;
  if should_assign then
    insert into public.user_role_assignments(firebase_uid,role_id,assigned_by_firebase_uid)
    values(target_firebase_uid,target_role_id,actor) on conflict do nothing;
  else
    delete from public.user_role_assignments
    where firebase_uid=target_firebase_uid and role_id=target_role_id;
  end if;
  insert into public.admin_audit_records(actor_firebase_uid,action_key,resource_type,resource_id,access_reason,metadata)
  values(actor,'rbac.user_role.changed','profile',target_firebase_uid,'Administrative RBAC change',
    jsonb_build_object('role_key',target_role_key,'assigned',should_assign));
end
$$;

create or replace function api.update_recipe(
  recipe_id uuid,
  expected_version integer,
  recipe_title text,
  recipe_summary text,
  recipe_ingredients jsonb,
  recipe_steps jsonb,
  recipe_minimum_age_months integer,
  recipe_status public.recipe_status
) returns public.recipes language plpgsql volatile security definer set search_path = ''
as $$
declare actor text := private.firebase_uid(); updated_recipe public.recipes;
begin
  if actor is null or not private.has_permission(actor,'recipes.manage') then
    raise exception 'not authorized';
  end if;
  if recipe_status='published' and not private.has_permission(actor,'recipes.publish') then
    raise exception 'publish permission required';
  end if;
  update public.recipes set
    title=btrim(recipe_title), summary=btrim(recipe_summary),
    ingredients=recipe_ingredients, steps=recipe_steps,
    minimum_age_months=recipe_minimum_age_months, status=recipe_status,
    version=version+1, updated_by_firebase_uid=actor, updated_at=now(),
    published_at=case when recipe_status='published' then coalesce(published_at,now()) else published_at end
  where id=recipe_id and version=expected_version
  returning * into updated_recipe;
  if updated_recipe.id is null then raise exception 'recipe version conflict'; end if;
  insert into public.admin_audit_records(actor_firebase_uid,action_key,resource_type,resource_id,access_reason)
  values(actor,'recipe.updated','recipe',recipe_id::text,'Administrative recipe update');
  return updated_recipe;
end
$$;

create or replace function api.record_sync_mutation(
  p_idempotency_key uuid,
  p_entity_type text,
  p_operation text,
  p_payload_version integer
) returns public.sync_mutation_receipts
language plpgsql volatile security definer set search_path = ''
as $$
declare actor text := private.firebase_uid(); receipt public.sync_mutation_receipts;
begin
  if actor is null then raise exception 'not authorized'; end if;
  if p_entity_type not in ('profile','child','consent','recipe') then
    raise exception 'unsupported sync entity type';
  end if;
  if p_operation not in ('create','update','delete') then
    raise exception 'unsupported sync operation';
  end if;
  if p_payload_version < 1 then raise exception 'invalid payload version'; end if;
  insert into public.sync_mutation_receipts(
    firebase_uid,idempotency_key,entity_type,operation,payload_version
  ) values(actor,p_idempotency_key,p_entity_type,p_operation,p_payload_version)
  on conflict (firebase_uid,idempotency_key) do nothing;
  select * into receipt from public.sync_mutation_receipts r
  where r.firebase_uid=actor and r.idempotency_key=p_idempotency_key;
  if receipt.entity_type <> p_entity_type
     or receipt.operation <> p_operation
     or receipt.payload_version <> p_payload_version then
    raise exception 'idempotency key reused with different mutation metadata';
  end if;
  return receipt;
end
$$;

revoke execute on function api.effective_access() from public, anon;
revoke execute on function api.audited_raw_access(text, uuid, text) from public, anon;
revoke execute on function api.effective_access() from public;
revoke execute on function api.effective_access() from anon;
grant execute on function api.effective_access() to authenticated;
grant execute on function api.audited_raw_access(text, uuid, text) to authenticated;
revoke execute on function api.set_role_permission(uuid, text, boolean) from public, anon;
revoke execute on function api.create_role(text, text) from public, anon;
revoke execute on function api.set_role_feature(uuid, text, boolean) from public, anon;
revoke execute on function api.set_user_permission_override(text, text, boolean) from public, anon;
revoke execute on function api.set_user_feature_override(text, text, boolean) from public, anon;
revoke execute on function api.assign_user_role(text, uuid, boolean) from public, anon;
revoke execute on function api.update_recipe(uuid, integer, text, text, jsonb, jsonb, integer, public.recipe_status) from public, anon;
grant execute on function api.set_role_permission(uuid, text, boolean) to authenticated;
grant execute on function api.create_role(text, text) to authenticated;
grant execute on function api.set_role_feature(uuid, text, boolean) to authenticated;
grant execute on function api.set_user_permission_override(text, text, boolean) to authenticated;
grant execute on function api.set_user_feature_override(text, text, boolean) to authenticated;
grant execute on function api.assign_user_role(text, uuid, boolean) to authenticated;
grant execute on function api.update_recipe(uuid, integer, text, text, jsonb, jsonb, integer, public.recipe_status) to authenticated;
revoke execute on function api.record_sync_mutation(uuid, text, text, integer) from public, anon;
grant execute on function api.record_sync_mutation(uuid, text, text, integer) to authenticated;

alter table public.profiles enable row level security;
alter table public.children enable row level security;
alter table public.caregiver_access enable row level security;
alter table public.policy_versions enable row level security;
alter table public.policy_acceptances enable row level security;
alter table public.recipes enable row level security;
alter table public.activity_events enable row level security;
alter table public.admin_audit_records enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_role_assignments enable row level security;
alter table public.user_permission_overrides enable row level security;
alter table public.features enable row level security;
alter table public.role_feature_access enable row level security;
alter table public.user_feature_overrides enable row level security;
alter table public.private_attachments enable row level security;
alter table public.sync_mutation_receipts enable row level security;

create policy profiles_self_select on public.profiles for select to authenticated
using (firebase_uid = (select auth.jwt()->>'sub') or private.has_permission(private.firebase_uid(), 'users.read'));
create policy profiles_self_insert on public.profiles for insert to authenticated
with check (firebase_uid = (select auth.jwt()->>'sub'));
create policy profiles_self_update on public.profiles for update to authenticated
using (firebase_uid = (select auth.jwt()->>'sub'))
with check (firebase_uid = (select auth.jwt()->>'sub'));

create policy children_access_select on public.children for select to authenticated
using (private.can_access_child(id, private.firebase_uid()) or private.has_permission(private.firebase_uid(), 'users.read'));
create policy children_owner_insert on public.children for insert to authenticated
with check (owner_firebase_uid = (select auth.jwt()->>'sub'));
create policy children_owner_update on public.children for update to authenticated
using (owner_firebase_uid = (select auth.jwt()->>'sub'))
with check (owner_firebase_uid = (select auth.jwt()->>'sub'));
create policy children_owner_delete on public.children for delete to authenticated
using (owner_firebase_uid = (select auth.jwt()->>'sub'));

create policy caregiver_child_access_select on public.caregiver_access for select to authenticated
using (private.can_access_child(child_id, private.firebase_uid()));
create policy caregiver_owner_insert on public.caregiver_access for insert to authenticated
with check (exists (select 1 from public.children c where c.id=child_id and c.owner_firebase_uid=(select auth.jwt()->>'sub')) and granted_by_firebase_uid=(select auth.jwt()->>'sub'));
create policy caregiver_owner_delete on public.caregiver_access for delete to authenticated
using (exists (select 1 from public.children c where c.id=child_id and c.owner_firebase_uid=(select auth.jwt()->>'sub')));

create policy policy_versions_read on public.policy_versions for select to authenticated using (effective_at <= now());
create policy policy_acceptances_self_select on public.policy_acceptances for select to authenticated
using (firebase_uid=(select auth.jwt()->>'sub'));
create policy policy_acceptances_self_insert on public.policy_acceptances for insert to authenticated
with check (firebase_uid=(select auth.jwt()->>'sub'));

create policy recipes_read_published on public.recipes for select to authenticated
using (status='published' or private.has_permission(private.firebase_uid(), 'recipes.manage'));
create policy recipes_admin_insert on public.recipes for insert to authenticated
with check (private.has_permission(private.firebase_uid(), 'recipes.manage') and created_by_firebase_uid=private.firebase_uid() and updated_by_firebase_uid=private.firebase_uid());
create policy recipes_admin_update on public.recipes for update to authenticated
using (private.has_permission(private.firebase_uid(), 'recipes.manage'))
with check (private.has_permission(private.firebase_uid(), 'recipes.manage') and updated_by_firebase_uid=private.firebase_uid());

create policy activity_self_select on public.activity_events for select to authenticated
using (firebase_uid=(select auth.jwt()->>'sub') or private.has_permission(private.firebase_uid(), 'audit.read'));
create policy activity_self_insert on public.activity_events for insert to authenticated
with check (firebase_uid=(select auth.jwt()->>'sub'));
create policy audit_admin_select on public.admin_audit_records for select to authenticated
using (private.has_permission(private.firebase_uid(), 'audit.read'));

create policy roles_authenticated_read on public.roles for select to authenticated using (true);
create policy permissions_authenticated_read on public.permissions for select to authenticated using (true);
create policy role_permissions_authenticated_read on public.role_permissions for select to authenticated using (true);
create policy features_authenticated_read on public.features for select to authenticated using (true);
create policy role_features_authenticated_read on public.role_feature_access for select to authenticated using (true);
create policy user_roles_self_or_admin_read on public.user_role_assignments for select to authenticated
using (firebase_uid=private.firebase_uid() or private.has_permission(private.firebase_uid(), 'roles.manage'));
create policy permission_overrides_self_or_admin_read on public.user_permission_overrides for select to authenticated
using (firebase_uid=private.firebase_uid() or private.has_permission(private.firebase_uid(), 'roles.manage'));
create policy feature_overrides_self_or_admin_read on public.user_feature_overrides for select to authenticated
using (firebase_uid=private.firebase_uid() or private.has_permission(private.firebase_uid(), 'features.manage'));

create policy attachments_access_select on public.private_attachments for select to authenticated
using (owner_firebase_uid=private.firebase_uid() or (child_id is not null and private.can_access_child(child_id,private.firebase_uid())));
create policy attachments_owner_insert on public.private_attachments for insert to authenticated
with check (owner_firebase_uid=private.firebase_uid());
create policy attachments_owner_delete on public.private_attachments for delete to authenticated
using (owner_firebase_uid=private.firebase_uid());
create policy sync_receipts_owner_select on public.sync_mutation_receipts for select to authenticated
using (firebase_uid=(select auth.jwt()->>'sub'));

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('private-attachments', 'private-attachments', false, 10485760, array['image/jpeg','image/png','application/pdf'])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

create policy private_attachments_storage_select on storage.objects for select to authenticated
using (bucket_id='private-attachments' and owner_id=(select auth.jwt()->>'sub'));
create policy private_attachments_storage_insert on storage.objects for insert to authenticated
with check (
  bucket_id='private-attachments'
  and owner_id=(select auth.jwt()->>'sub')
  and (storage.foldername(name))[1]=(select auth.jwt()->>'sub')
);
create policy private_attachments_storage_update on storage.objects for update to authenticated
using (bucket_id='private-attachments' and owner_id=(select auth.jwt()->>'sub'))
with check (bucket_id='private-attachments' and owner_id=(select auth.jwt()->>'sub') and (storage.foldername(name))[1]=(select auth.jwt()->>'sub'));
create policy private_attachments_storage_delete on storage.objects for delete to authenticated
using (bucket_id='private-attachments' and owner_id=(select auth.jwt()->>'sub'));

grant select, insert, update on public.profiles, public.children to authenticated;
grant select, insert, delete on public.caregiver_access, public.policy_acceptances, public.private_attachments to authenticated;
grant select on public.policy_versions, public.roles, public.permissions, public.role_permissions,
  public.user_role_assignments, public.user_permission_overrides, public.features,
  public.role_feature_access, public.user_feature_overrides, public.admin_audit_records to authenticated;
grant select, insert, update on public.recipes to authenticated;
grant select, insert on public.activity_events to authenticated;
grant select on public.sync_mutation_receipts to authenticated;
revoke update, delete on public.admin_audit_records from authenticated;

commit;
