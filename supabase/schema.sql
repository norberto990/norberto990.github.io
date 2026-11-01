-- =====================================================================
--  Lista de Animes do Betoro-chan — banco de dados
--  Cole TUDO isto no Supabase: SQL Editor > New query > Run.
--  Pode rodar de novo sem problema (não apaga dados).
-- =====================================================================

-- ---------- Perfis (nome que aparece para a galera) ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nick        text check (char_length(nick) <= 40),
  avatar_url  text,
  created_at  timestamptz not null default now()
);

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
  auto        boolean not null default false,   -- true = veio da atualização automática
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (kind, slug)
);
create index if not exists works_kind_idx on public.works(kind);

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

-- ---------- Regras de acesso ----------
-- Qualquer pessoa (mesmo sem login) VÊ tudo.
-- Quem está logado adiciona obras e edita as informações delas.
-- Cada pessoa só mexe na própria lista e nos próprios comentários.
alter table public.profiles   enable row level security;
alter table public.works      enable row level security;
alter table public.list_items enable row level security;
alter table public.comments   enable row level security;

drop policy if exists "perfis: todos veem"        on public.profiles;
drop policy if exists "perfis: dono edita"        on public.profiles;
drop policy if exists "perfis: dono cria"         on public.profiles;
create policy "perfis: todos veem"  on public.profiles for select using (true);
create policy "perfis: dono cria"   on public.profiles for insert with check (auth.uid() = id);
create policy "perfis: dono edita"  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "obras: todos veem"         on public.works;
drop policy if exists "obras: logado adiciona"    on public.works;
drop policy if exists "obras: logado edita"       on public.works;
create policy "obras: todos veem"       on public.works for select using (true);
create policy "obras: logado adiciona"  on public.works for insert to authenticated with check (created_by = auth.uid());
create policy "obras: logado edita"     on public.works for update to authenticated using (true) with check (true);

drop policy if exists "lista: todos veem"         on public.list_items;
drop policy if exists "lista: dono mexe"          on public.list_items;
create policy "lista: todos veem" on public.list_items for select using (true);
create policy "lista: dono mexe"  on public.list_items for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "coment: todos veem"        on public.comments;
drop policy if exists "coment: dono escreve"      on public.comments;
drop policy if exists "coment: dono apaga"        on public.comments;
create policy "coment: todos veem"   on public.comments for select using (true);
create policy "coment: dono escreve" on public.comments for insert to authenticated with check (user_id = auth.uid());
create policy "coment: dono apaga"   on public.comments for delete to authenticated using (user_id = auth.uid());

-- ninguém do site troca o anilist_id/created_by de uma obra (só a atualização automática)
create or replace function public.works_guard()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if auth.role() = 'authenticated' then
    new.anilist_id := old.anilist_id;
    new.mal_id     := old.mal_id;
    new.created_by := old.created_by;
    new.auto       := old.auto;
  end if;
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
