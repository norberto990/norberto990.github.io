-- =====================================================================
--  Lista de Animes do Betoro-chan — banco de dados (versão 3)
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
-- (foto de perfil só se vier do login com Google; qualquer outro endereço é ignorado)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare foto text := new.raw_user_meta_data->>'avatar_url';
begin
  insert into public.profiles (id, nick, avatar_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data->>'nick',
                  new.raw_user_meta_data->>'full_name',
                  split_part(new.email, '@', 1)), 40),
    case when foto ~ '^https://lh3\.googleusercontent\.com/[^[:space:]"''<>]+$' then foto end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ninguém vira ADM sozinho nem troca a própria foto por um endereço qualquer
create or replace function public.profiles_guard()
returns trigger language plpgsql as $$
begin
  -- vale só para quem usa o site (no SQL Editor do Supabase você continua podendo tudo)
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.is_admin := false; new.avatar_url := null;
    else
      new.is_admin := old.is_admin; new.avatar_url := old.avatar_url;
    end if;
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
create index if not exists works_created_by_idx on public.works(created_by, created_at);

-- campos da versão 2: sinopse em inglês, lançamentos e links oficiais
alter table public.works add column if not exists synopsis_en    text not null default '';
alter table public.works add column if not exists syn_src        text not null default '';   -- quem traduziu: gratis (tradutor grátis) ou adm
alter table public.works add column if not exists rel_num        numeric;                     -- último episódio/capítulo lançado
alter table public.works add column if not exists rel_label      text not null default '';
alter table public.works add column if not exists rel_at         timestamptz;                 -- quando saiu
alter table public.works add column if not exists rel_prev_at    timestamptz;                 -- quando saiu o anterior (ritmo)
alter table public.works add column if not exists rel_url        text;                        -- link oficial do capítulo
alter table public.works add column if not exists rel_src        text not null default '';    -- anilist, mangaplus, webtoon, jumpplus, adm
alter table public.works add column if not exists rel_checked_at timestamptz;
alter table public.works add column if not exists next_num       int;                         -- anime: próximo episódio
alter table public.works add column if not exists next_at        timestamptz;                 -- anime: horário oficial do próximo
alter table public.works add column if not exists links          jsonb not null default '[]'::jsonb; -- até 3 sites oficiais
alter table public.works add column if not exists feed           text not null default '';    -- mangaplus:ID, webtoon:URL ou gigaviewer:URL
-- versão 3: quando o robô conferiu a obra no AniList (obras novas de quem não é ADM chegam sem conferir)
alter table public.works add column if not exists verificado_em  timestamptz;

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
-- parent_id = comentário principal. Sem chave estrangeira de propósito: se o principal
-- for apagado, as respostas continuam lá embaixo de "Mensagem apagada".
create table if not exists public.comments (
  id             uuid primary key default gen_random_uuid(),
  work_id        uuid not null references public.works(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  parent_id      uuid,
  reply_to_user  uuid references auth.users(id) on delete set null,
  body           text not null default '' check (char_length(body) <= 1000),
  image_url      text,
  created_at     timestamptz not null default now(),
  check (char_length(body) > 0 or image_url is not null)
);
alter table public.comments drop constraint if exists comments_parent_id_fkey;
create index if not exists comments_work_idx on public.comments(work_id, created_at);
create index if not exists comments_user_idx on public.comments(user_id, created_at);

-- ---------- Estado da atualização automática (só o robô lê e escreve) ----------
create table if not exists public.motor (
  chave       text primary key,
  valor       jsonb not null default '{}'::jsonb,
  atualizado  timestamptz not null default now()
);

-- ---------- Conferências usadas pelas travas abaixo ----------
-- imagem enviada pelo próprio dono, para o Storage deste projeto
create or replace function public.imagem_do_dono(url text, dono uuid)
returns boolean language sql immutable as $$
  select coalesce(url ~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/imagens/' || dono::text || '/[A-Za-z0-9._-]+$'), false)
$$;

-- até 3 sites oficiais, só https://, com nome
create or replace function public.links_seguros(l jsonb)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(
           jsonb_build_object('site', left(x->>'site', 40), 'url', x->>'url', 'lang', left(coalesce(x->>'lang', ''), 4))
           || case when x->'adm' = 'true'::jsonb then '{"adm": true}'::jsonb else '{}'::jsonb end
           order by n), '[]'::jsonb)
  from (
    select x, n
    from jsonb_array_elements(case when jsonb_typeof(l) = 'array' then l else '[]'::jsonb end) with ordinality as t(x, n)
    where jsonb_typeof(x) = 'object'
      and coalesce(x->>'url', '') ~* '^https://[^[:space:]"''<>]+$'
      and coalesce(x->>'site', '') <> ''
    order by n
    limit 3
  ) s
$$;

-- fontes de capítulo que o robô sabe ler (mesma lista do comum.js)
create or replace function public.feed_seguro(f text)
returns boolean language sql immutable as $$
  select coalesce(f, '') = ''
      or f ~ '^mangaplus:[0-9]{1,9}$'
      or f ~* '^webtoon:https://www\.webtoons\.com/[a-z-]+/[^/?#[:space:]]+/[^/?#[:space:]]+/rss\?title_no=[0-9]+$'
      or f ~* '^gigaviewer:https://(www\.)?(shonenjumpplus\.com|tonarinoyj\.jp|comic-days\.com|comic-action\.com|comicborder\.com|comic-gardo\.com|kuragebunch\.com|magcomi\.com|comic-zenon\.com|comic-trail\.com|comic-ogyaaa\.com|viewer\.heros-web\.com|comic-earthstar\.com|comicbushi-web\.com|ichicomi\.com)/(episode|rss/series|series)/[0-9]+$'
$$;

-- ---------- Travas das obras ----------
-- Quem não é ADM só traz os dados públicos do AniList. Links, capítulos, horários e
-- fontes automáticas ficam vazios até o robô conferir a obra no AniList (até 15 min).
create or replace function public.works_guard()
returns trigger language plpgsql as $$
declare
  pelo_site boolean := current_user in ('authenticated', 'anon');
  adm       boolean := public.is_admin();
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_at := now();
    if pelo_site and not adm then
      if (select count(*) from public.works w where w.created_by = auth.uid() and w.created_at > now() - interval '1 hour') >= 20 then
        raise exception 'limite_obras: muitas obras adicionadas na última hora';
      end if;
      new.links := '[]'::jsonb;   new.feed := '';
      new.rel_num := null;        new.rel_label := '';   new.rel_at := null;  new.rel_prev_at := null;
      new.rel_url := null;        new.rel_src := '';     new.rel_checked_at := null;
      new.next_num := null;       new.next_at := null;
      new.verificado_em := null;  new.auto := true;
      new.syn_src := case when new.synopsis <> '' then 'gratis' else '' end;
      if new.cover_url is not null and new.cover_url !~* '^https://s[0-9]*\.anilist\.co/[^[:space:]"''<>]+$' then new.cover_url := null; end if;
    elsif new.verificado_em is null then
      new.verificado_em := now();
    end if;
  end if;
  -- vale para todo mundo, inclusive ADM e robô: só links https:// e fontes conhecidas
  if new.rel_url is not null and new.rel_url !~* '^https://[^[:space:]"''<>]+$' then new.rel_url := null; end if;
  if new.cover_url is not null and new.cover_url !~* '^https://[^[:space:]"''<>]+$' then new.cover_url := null; end if;
  new.links := public.links_seguros(new.links);
  if not public.feed_seguro(new.feed) then new.feed := ''; end if;
  return new;
end $$;
drop trigger if exists works_guard on public.works;
create trigger works_guard before insert or update on public.works
  for each row execute function public.works_guard();

-- ---------- Travas da lista ----------
create or replace function public.list_items_guard()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.image_url is not null and not public.imagem_do_dono(new.image_url, new.user_id) then new.image_url := null; end if;
  return new;
end $$;
drop trigger if exists list_items_guard on public.list_items;
create trigger list_items_guard before insert or update on public.list_items
  for each row execute function public.list_items_guard();

-- ---------- Travas dos comentários ----------
create or replace function public.comments_guard()
returns trigger language plpgsql as $$
declare pai record;
begin
  new.created_at := now();   -- ninguém escolhe a data do próprio comentário
  if new.image_url is not null and not public.imagem_do_dono(new.image_url, new.user_id) then
    raise exception 'imagem_invalida: a imagem precisa ser enviada pelo site';
  end if;
  if new.parent_id is not null then
    select c.work_id, c.parent_id into pai from public.comments c where c.id = new.parent_id;
    if not found then raise exception 'resposta_apagada: o comentário que você respondia foi apagado'; end if;
    if pai.work_id <> new.work_id then raise exception 'resposta_outra_obra: a resposta precisa ser na mesma obra'; end if;
    if pai.parent_id is not null then new.parent_id := pai.parent_id; end if;   -- resposta sempre no comentário principal
  end if;
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    if (select count(*) from public.comments c where c.user_id = new.user_id and c.created_at > now() - interval '1 minute') >= 6
       or (select count(*) from public.comments c where c.user_id = new.user_id and c.created_at > now() - interval '1 day') >= 300 then
      raise exception 'limite_comentarios: muitos comentários seguidos';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists comments_guard on public.comments;
create trigger comments_guard before insert on public.comments
  for each row execute function public.comments_guard();

-- ---------- Regras de acesso ----------
-- Qualquer pessoa (mesmo sem login) VÊ tudo.
-- Quem tem conta adiciona obras do AniList (as travas acima limpam o resto). Só o ADM edita e apaga obras,
-- e pode apagar qualquer comentário. Cada pessoa só mexe na própria lista e nos próprios comentários.
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

drop policy if exists "obras: todos veem"               on public.works;
drop policy if exists "obras: logado adiciona"          on public.works;
drop policy if exists "obras: logado edita"             on public.works;
drop policy if exists "obras: adm adiciona"             on public.works;
drop policy if exists "obras: logado adiciona do AniList" on public.works;
drop policy if exists "obras: adm edita"                on public.works;
drop policy if exists "obras: adm apaga"                on public.works;
create policy "obras: todos veem"    on public.works for select using (true);
-- qualquer pessoa logada adiciona obras vindas do AniList; obras "à mão" só o ADM
create policy "obras: logado adiciona do AniList" on public.works for insert to authenticated
  with check (public.is_admin() or (anilist_id is not null and created_by = auth.uid()));
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

-- ---------- Imagens (capas, prints de comentário) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imagens', 'imagens', true, 5242880, array['image/png','image/jpeg','image/gif','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/png','image/jpeg','image/gif','image/webp'];

-- cada pessoa envia no máximo 20 imagens por hora e guarda no máximo 300 (o Storage grátis tem 1 GB)
drop policy if exists "imagens: todos veem"      on storage.objects;
drop policy if exists "imagens: logado envia"    on storage.objects;
drop policy if exists "imagens: dono apaga"      on storage.objects;
create policy "imagens: todos veem"   on storage.objects for select using (bucket_id = 'imagens');
create policy "imagens: logado envia" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'imagens'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (select count(*) from storage.objects o
         where o.bucket_id = 'imagens' and (storage.foldername(o.name))[1] = auth.uid()::text
           and o.created_at > now() - interval '1 hour') < 20
    and (select count(*) from storage.objects o
         where o.bucket_id = 'imagens' and (storage.foldername(o.name))[1] = auth.uid()::text) < 300
  );
create policy "imagens: dono apaga"   on storage.objects for delete to authenticated
  using (bucket_id = 'imagens' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- Arrumação dos dados que já existiam ----------
-- obras que já estavam no site contam como conferidas (só na primeira vez que a versão 3 roda)
do $$
begin
  if not exists (select 1 from public.motor where chave = 'versao3') then
    update public.works set verificado_em = now() where verificado_em is null;
    insert into public.motor (chave, valor) values ('versao3', jsonb_build_object('em', now()));
  end if;
end $$;
-- tira endereços que não são https://, fontes desconhecidas e imagens de fora
update public.works set rel_url = null where rel_url is not null and rel_url !~* '^https://[^[:space:]"''<>]+$';
update public.works set cover_url = null where cover_url is not null and cover_url !~* '^https://[^[:space:]"''<>]+$';
update public.works set links = public.links_seguros(links) where links <> public.links_seguros(links);
update public.works set feed = '' where not public.feed_seguro(feed);
update public.profiles set avatar_url = null
  where avatar_url is not null and avatar_url !~ '^https://lh3\.googleusercontent\.com/[^[:space:]"''<>]+$';
update public.list_items set image_url = null where image_url is not null and not public.imagem_do_dono(image_url, user_id);
delete from public.comments where image_url is not null and char_length(body) = 0 and not public.imagem_do_dono(image_url, user_id);
update public.comments set image_url = null where image_url is not null and not public.imagem_do_dono(image_url, user_id);
update public.comments set created_at = now() where created_at > now() + interval '5 minutes';

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
