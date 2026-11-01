-- =====================================================================
--  Lista de Animes do Betoro-chan — banco de dados (versão 2)
--  Cole TUDO isto no Supabase: SQL Editor > New query > Run.
--  Pode rodar quantas vezes quiser: não apaga listas, obras nem comentários.
-- =====================================================================

-- ---------- Perfis (nome que aparece para a galera) ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nick        text check (char_length(nick) <= 40),
  avatar_url  text,
  created_at  timestamptz not null default now()
);
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- quem é ADM (usado pelas regras abaixo)
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false)
$$;

-- cria o perfil automaticamente quando alguém se cadastra
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nick, avatar_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data->>'nick',
                  new.raw_user_meta_data->>'full_name',
                  split_part(new.email, '@', 1)), 40),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ninguém vira ADM sozinho pelo site
create or replace function public.profiles_guard()
returns trigger language plpgsql as $$
begin
  -- vale só para quem usa o site (no SQL Editor do Supabase você continua podendo tudo)
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    if tg_op = 'INSERT' then new.is_admin := false; else new.is_admin := old.is_admin; end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before insert or update on public.profiles
  for each row execute function public.profiles_guard();

-- ---------- Obras (animes, mangás, novels) ----------
create table if not exists public.works (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('anime','manga','novel')),
  title       text not null check (char_length(title) between 1 and 160),
  slug        text not null check (slug ~ '^[a-z0-9-]{1,120}$'),
  alt_titles  text not null default '' check (char_length(alt_titles) <= 600),
  cover_url   text,
  synopsis    text not null default '' check (char_length(synopsis) <= 6000),
  genres      text not null default '' check (char_length(genres) <= 300),
  format      text not null default '',
  total       int  check (total is null or total between 0 and 100000),
  status      text not null default '',
  year        int,
  studio      text not null default '',
  source      text not null default '',
  anilist_id  int unique,
  mal_id      int,
  auto        boolean not null default false,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (kind, slug)
);
create index if not exists works_kind_idx on public.works(kind);

-- campos novos (versão 2): sinopse em inglês, lançamentos e links oficiais
alter table public.works add column if not exists synopsis_en    text not null default '';
alter table public.works add column if not exists syn_src        text not null default '';   -- quem traduziu: ia, gratis, adm
alter table public.works add column if not exists rel_num        numeric;                     -- último episódio/capítulo lançado
alter table public.works add column if not exists rel_label      text not null default '';
alter table public.works add column if not exists rel_at         timestamptz;                 -- quando saiu
alter table public.works add column if not exists rel_prev_at    timestamptz;                 -- quando saiu o anterior (ritmo)
alter table public.works add column if not exists rel_url        text;                        -- link oficial do capítulo
alter table public.works add column if not exists rel_src        text not null default '';    -- anilist, mangaplus, webtoon, ia, adm
alter table public.works add column if not exists rel_checked_at timestamptz;
alter table public.works add column if not exists next_num       int;                         -- anime: próximo episódio
alter table public.works add column if not exists next_at        timestamptz;                 -- anime: horário oficial do próximo
alter table public.works add column if not exists links          jsonb not null default '[]'::jsonb; -- até 3 sites oficiais
alter table public.works add column if not exists feed           text not null default '';    -- mangaplus:ID ou webtoon:URL

-- ---------- O que cada pessoa marcou ----------
create table if not exists public.list_items (
  user_id     uuid not null references auth.users(id) on delete cascade,
  work_id     uuid not null references public.works(id) on delete cascade,
  status      text not null check (status in ('assistindo','visto','quero','dropei')),
  score       int  check (score between 1 and 10),
  progress    int  not null default 0 check (progress between 0 and 100000),
  image_url   text,
  updated_at  timestamptz not null default now(),
  primary key (user_id, work_id)
);
create index if not exists list_items_work_idx on public.list_items(work_id);

-- ---------- Comentários de cada obra ----------
create table if not exists public.comments (
  id             uuid primary key default gen_random_uuid(),
  work_id        uuid not null references public.works(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  parent_id      uuid references public.comments(id) on delete set null,
  reply_to_user  uuid references auth.users(id) on delete set null,
  body           text not null default '' check (char_length(body) <= 1000),
  image_url      text,
  created_at     timestamptz not null default now(),
  check (char_length(body) > 0 or image_url is not null)
);
create index if not exists comments_work_idx on public.comments(work_id, created_at);

-- ---------- Estado da atualização automática (só o robô lê e escreve) ----------
create table if not exists public.motor (
  chave       text primary key,
  valor       jsonb not null default '{}'::jsonb,
  atualizado  timestamptz not null default now()
);

-- ---------- Regras de acesso ----------
-- Qualquer pessoa (mesmo sem login) VÊ tudo.
-- Só o ADM adiciona, edita e apaga obras, e pode apagar qualquer comentário.
-- Cada pessoa só mexe na própria lista e nos próprios comentários.
alter table public.profiles   enable row level security;
alter table public.works      enable row level security;
alter table public.list_items enable row level security;
alter table public.comments   enable row level security;
alter table public.motor      enable row level security;   -- sem regras = ninguém do site acessa

drop policy if exists "perfis: todos veem"        on public.profiles;
drop policy if exists "perfis: dono edita"        on public.profiles;
drop policy if exists "perfis: dono cria"         on public.profiles;
create policy "perfis: todos veem"  on public.profiles for select using (true);
create policy "perfis: dono cria"   on public.profiles for insert with check (auth.uid() = id);
create policy "perfis: dono edita"  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "obras: todos veem"         on public.works;
drop policy if exists "obras: logado adiciona"    on public.works;
drop policy if exists "obras: logado edita"       on public.works;
drop policy if exists "obras: adm adiciona"       on public.works;
drop policy if exists "obras: adm edita"          on public.works;
drop policy if exists "obras: adm apaga"          on public.works;
create policy "obras: todos veem"    on public.works for select using (true);
create policy "obras: adm adiciona"  on public.works for insert to authenticated with check (public.is_admin());
create policy "obras: adm edita"     on public.works for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "obras: adm apaga"     on public.works for delete to authenticated using (public.is_admin());

drop policy if exists "lista: todos veem"         on public.list_items;
drop policy if exists "lista: dono mexe"          on public.list_items;
create policy "lista: todos veem" on public.list_items for select using (true);
create policy "lista: dono mexe"  on public.list_items for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "coment: todos veem"        on public.comments;
drop policy if exists "coment: dono escreve"      on public.comments;
drop policy if exists "coment: dono apaga"        on public.comments;
drop policy if exists "coment: adm apaga"         on public.comments;
create policy "coment: todos veem"   on public.comments for select using (true);
create policy "coment: dono escreve" on public.comments for insert to authenticated with check (user_id = auth.uid());
create policy "coment: dono apaga"   on public.comments for delete to authenticated using (user_id = auth.uid());
create policy "coment: adm apaga"    on public.comments for delete to authenticated using (public.is_admin());

-- marca a hora de cada edição de obra
create or replace function public.works_guard()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists works_guard on public.works;
create trigger works_guard before update on public.works
  for each row execute function public.works_guard();

-- ---------- Imagens (capas, prints de comentário) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imagens', 'imagens', true, 5242880, array['image/png','image/jpeg','image/gif','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/png','image/jpeg','image/gif','image/webp'];

drop policy if exists "imagens: todos veem"      on storage.objects;
drop policy if exists "imagens: logado envia"    on storage.objects;
drop policy if exists "imagens: dono apaga"      on storage.objects;
create policy "imagens: todos veem"   on storage.objects for select using (bucket_id = 'imagens');
create policy "imagens: logado envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'imagens' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "imagens: dono apaga"   on storage.objects for delete to authenticated
  using (bucket_id = 'imagens' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- Atualização ao vivo ----------
do $$
declare t text;
begin
  foreach t in array array['works','list_items','comments','profiles'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
