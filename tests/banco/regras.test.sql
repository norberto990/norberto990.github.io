-- =====================================================================
--  Testes das regras e travas do banco (supabase/schema.sql).
--  Rodar num Postgres de teste:  psql -v ON_ERROR_STOP=1 -o /dev/null -f supabase-simulado.sql -f ../../supabase/schema.sql -f dados.sql -f regras.test.sql
--  Cada linha "✔" é uma regra conferida; qualquer falha para o teste com "✘ FALHOU".
-- =====================================================================
\set ON_ERROR_STOP 1
\set QUIET 1
\set A 'aaaaaaaa-0000-0000-0000-00000000000a'
\set B 'bbbbbbbb-0000-0000-0000-00000000000b'
\set W '11111111-1111-1111-1111-111111111111'
set client_min_messages = notice;
create function pg_temp.como(uid text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', case when uid is null then '' else json_build_object('sub', uid, 'role', 'authenticated')::text end, false); end $$;
create function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if coalesce(cond, false) then raise notice '✔ %', msg; else raise exception '✘ FALHOU: %', msg; end if; end $$;
-- o comando precisa ser recusado, e a mensagem precisa conter "trecho"
create function pg_temp.recusa(cmd text, trecho text, msg text) returns void language plpgsql as $$
begin
  begin execute cmd; exception when others then
    if sqlerrm ilike '%' || trecho || '%' then raise notice '✔ %', msg; return; end if;
    raise exception '✘ FALHOU: % (erro inesperado: %)', msg, sqlerrm;
  end;
  raise exception '✘ FALHOU: % (deveria ter sido recusado)', msg;
end $$;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

-- ---------- perfis ----------
select pg_temp.ok((select avatar_url from profiles where id = :'B') is null, 'cadastro com foto de site qualquer: foto ignorada');
select pg_temp.como(:'B'); set role authenticated;
update profiles set is_admin = true, nick = 'Kenji2', avatar_url = 'https://evil.example/x.png' where id = :'B';
reset role;
select pg_temp.ok((select not is_admin and nick = 'Kenji2' and avatar_url is null from profiles where id = :'B'), 'usuário comum troca o nome, mas não vira ADM nem põe foto de fora');

-- ---------- obras: quem não é ADM ----------
select pg_temp.como(:'B'); set role authenticated;
select pg_temp.recusa($$insert into works(kind,title,slug,created_by) values ('anime','Hack','hack','bbbbbbbb-0000-0000-0000-00000000000b')$$, 'row-level security', 'usuário comum não adiciona obra à mão (sem AniList)');
update works set title = 'Hackeado' where id = :'W';
delete from works where id = :'W';
reset role;
select pg_temp.ok((select title = 'Sousou no Frieren' from works where id = :'W'), 'usuário comum não edita nem apaga obra');

select pg_temp.como(:'B'); set role authenticated;
insert into works(kind,title,slug,anilist_id,created_by,links,rel_num,rel_url,rel_src,cover_url,feed,next_num,next_at,verificado_em,created_at,synopsis)
values ('manga','One Piece','one-piece-falso',30013,:'B','[{"site":"MANGA Plus","url":"javascript:alert(1)","adm":true}]',99999,'javascript:alert(1)','adm',
        'https://evil.example/p.png','gigaviewer:https://evil.example/trava',5,now(),now(),'2001-01-01','sinopse');
insert into works(kind,title,slug,anilist_id,created_by,cover_url) values ('anime','Kaiju','kaiju',777,:'B','https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx777.jpg');
reset role;
select pg_temp.ok((select links = '[]'::jsonb and rel_num is null and rel_url is null and rel_src = '' and feed = '' and next_num is null and next_at is null
                    and cover_url is null and verificado_em is null and created_at > now() - interval '1 minute' and syn_src = 'gratis'
                   from works where anilist_id = 30013), 'obra de usuário comum: links, capítulo, horários, fonte e capa de fora são limpos; fica para o robô conferir');
select pg_temp.ok((select cover_url like 'https://s4.anilist.co/%' from works where anilist_id = 777), 'obra de usuário comum: capa do AniList é aceita');

select pg_temp.como(:'B'); set role authenticated;
do $$ begin for i in 1..17 loop  -- o Kenji já tem 3 obras nesta hora (Frieren, One Piece, Kaiju): chega a 20
  insert into works(kind,title,slug,anilist_id,created_by) values ('anime','Spam '||i,'spam-'||i,50000+i,'bbbbbbbb-0000-0000-0000-00000000000b');
end loop; end $$;
select pg_temp.recusa($$insert into works(kind,title,slug,anilist_id,created_by) values ('anime','Spam 21','spam-21',50021,'bbbbbbbb-0000-0000-0000-00000000000b')$$, 'limite_obras', 'mais de 20 obras por hora: recusa');
reset role;

-- ---------- obras: ADM ----------
update profiles set is_admin = true where id = (select id from auth.users where email = 'adm@x.com');
select pg_temp.como(:'A'); set role authenticated;
select pg_temp.ok(public.is_admin(), 'Betoro virou ADM pelo SQL do dono');
insert into works(kind,title,slug,created_by,links) values ('manga','Obra à mão','obra-a-mao',:'A','[{"site":"Oficial","url":"https://oficial.example/x","adm":true},{"site":"Golpe","url":"javascript:alert(1)"}]');
update works set rel_num = 1166, rel_src = 'adm', rel_url = 'javascript:alert(2)' where slug = 'obra-a-mao';
reset role;
select pg_temp.ok((select verificado_em is not null and rel_num = 1166 and rel_url is null and jsonb_array_length(links) = 1 and links->0->>'adm' = 'true' from works where slug = 'obra-a-mao'),
                  'ADM adiciona e edita; mesmo assim link que não é https:// é descartado');

-- ---------- robô ----------
set role service_role;
update works set rel_url = 'javascript:x', feed = 'webtoon:https://evil.example/rss', verificado_em = now() where anilist_id = 30013;
reset role;
select pg_temp.ok((select rel_url is null and feed = '' and verificado_em is not null from works where anilist_id = 30013), 'nem o robô consegue gravar link perigoso ou fonte desconhecida');
select pg_temp.ok(public.feed_seguro('gigaviewer:https://shonenjumpplus.com/episode/3270296674397') and public.feed_seguro('mangaplus:100020')
                  and public.feed_seguro('webtoon:https://www.webtoons.com/en/fantasy/tower-of-god/rss?title_no=95') and not public.feed_seguro('mangaplus:1&x=1'), 'fontes oficiais aceitas, estranhas recusadas');

-- ---------- lista ----------
select pg_temp.como(:'B'); set role authenticated;
select pg_temp.recusa($$insert into list_items(user_id,work_id,status) values ('aaaaaaaa-0000-0000-0000-00000000000a',(select id from works where slug='obra-a-mao'),'visto')$$, 'row-level security', 'usuário comum não mexe na lista de outra pessoa');
insert into list_items(user_id,work_id,status,image_url,updated_at) values (:'B',(select id from works where slug='obra-a-mao'),'assistindo','https://evil.example/c.png','2099-01-01');
select pg_temp.recusa($$insert into list_items(user_id,work_id,status,progress) values ('bbbbbbbb-0000-0000-0000-00000000000b',(select id from works where slug='kaiju'),'assistindo',999999)$$, 'progress_check', 'progresso acima de 100000: recusa com o nome do limite');
reset role;
select pg_temp.ok((select image_url is null and updated_at < now() + interval '1 minute' from list_items where user_id = :'B' and work_id = (select id from works where slug='obra-a-mao')), 'lista: imagem de fora e data falsa são descartadas');

-- ---------- comentários ----------
select pg_temp.como(:'B'); set role authenticated;
delete from comments where id = 'c0000000-0000-0000-0000-00000000000a';
reset role;
select pg_temp.ok(exists(select 1 from comments where id = 'c0000000-0000-0000-0000-00000000000a'), 'usuário comum não apaga comentário dos outros');
select pg_temp.como(:'B'); set role authenticated;
select pg_temp.recusa($$insert into comments(work_id,user_id,body,image_url) values ('11111111-1111-1111-1111-111111111111','bbbbbbbb-0000-0000-0000-00000000000b','oi','https://evil.example/rastreio.png')$$, 'imagem_invalida', 'comentário com imagem de outro site: recusa');
insert into comments(id,work_id,user_id,body,image_url,created_at) values ('c1000000-0000-0000-0000-000000000001',:'W',:'B','foto',
  'https://pauloskkqpdsvmjzdyei.supabase.co/storage/v1/object/public/imagens/bbbbbbbb-0000-0000-0000-00000000000b/abc.webp','2099-01-01');
insert into comments(id,work_id,user_id,body,parent_id) values ('c1000000-0000-0000-0000-000000000002',:'W',:'B','resposta','c1000000-0000-0000-0000-000000000001');
select pg_temp.recusa($$insert into comments(work_id,user_id,body,parent_id) values ('11111111-1111-1111-1111-111111111111','bbbbbbbb-0000-0000-0000-00000000000b','x','00000000-0000-0000-0000-000000000000')$$, 'resposta_apagada', 'resposta a comentário apagado: recusa com aviso claro');
select pg_temp.recusa($$insert into comments(work_id,user_id,body,parent_id) values ((select id from works where slug='kaiju'),'bbbbbbbb-0000-0000-0000-00000000000b','x','c1000000-0000-0000-0000-000000000001')$$, 'resposta_outra_obra', 'resposta pendurada em comentário de outra obra: recusa');
reset role;
select pg_temp.ok((select created_at < now() + interval '1 minute' from comments where id = 'c1000000-0000-0000-0000-000000000001'), 'comentário com imagem do próprio Storage entra, e com a data de agora (não 2099)');
select pg_temp.como(:'B'); set role authenticated;
delete from comments where id = 'c1000000-0000-0000-0000-000000000001';
reset role;
select pg_temp.ok((select parent_id = 'c1000000-0000-0000-0000-000000000001' from comments where id = 'c1000000-0000-0000-0000-000000000002'), 'apagar o comentário principal mantém as respostas no lugar');
select pg_temp.como(:'B'); set role authenticated;
select pg_temp.recusa($t$do $$ begin for i in 1..8 loop insert into comments(work_id,user_id,body) values ('11111111-1111-1111-1111-111111111111','bbbbbbbb-0000-0000-0000-00000000000b','spam'); end loop; end $$$t$, 'limite_comentarios', 'mais de 6 comentários por minuto: recusa');
select pg_temp.como(:'A');
delete from comments where id = 'c0000000-0000-0000-0000-00000000000b';
reset role;
select pg_temp.ok(not exists(select 1 from comments where id = 'c0000000-0000-0000-0000-00000000000b'), 'ADM apaga comentário de qualquer pessoa');

-- ---------- imagens (Storage) ----------
select pg_temp.como(:'B'); set role authenticated;
select pg_temp.recusa($$insert into storage.objects(bucket_id,name) values ('imagens','aaaaaaaa-0000-0000-0000-00000000000a/x.png')$$, 'row-level security', 'ninguém envia imagem na pasta de outra pessoa');
do $$ begin for i in 1..20 loop insert into storage.objects(bucket_id,name) values ('imagens','bbbbbbbb-0000-0000-0000-00000000000b/'||i||'.png'); end loop; end $$;
select pg_temp.recusa($$insert into storage.objects(bucket_id,name) values ('imagens','bbbbbbbb-0000-0000-0000-00000000000b/21.png')$$, 'row-level security', 'mais de 20 imagens por hora: recusa');
reset role;

-- ---------- visitante sem login e tabela do robô ----------
select pg_temp.como(null); set role anon;
select pg_temp.ok((select count(*) > 0 from works), 'visitante vê as obras');
select pg_temp.recusa($$insert into list_items(user_id,work_id,status) values ('bbbbbbbb-0000-0000-0000-00000000000b','11111111-1111-1111-1111-111111111111','visto')$$, 'row-level security', 'visitante não marca nada');
reset role;
select pg_temp.como(:'A'); set role authenticated;
select pg_temp.ok((select count(*) = 0 from motor), 'tabela do robô: nem o ADM vê pelo site');
reset role; set role service_role;
insert into motor(chave, valor) values ('teste', '{"ok":1}');
reset role;
select pg_temp.ok(exists(select 1 from motor where chave = 'teste'), 'robô (chave secreta) escreve na tabela dele');
\echo 'Todos os testes do banco passaram.'
