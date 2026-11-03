-- Dados de exemplo para os testes: Betoro (vai virar ADM) e Kenji (usuário comum).
insert into auth.users(id,email,raw_user_meta_data) values
 ('aaaaaaaa-0000-0000-0000-00000000000a','adm@x.com','{"nick":"Betoro"}'),
 ('bbbbbbbb-0000-0000-0000-00000000000b','b@x.com','{"nick":"Kenji","avatar_url":"https://evil.example/ip.png"}');
insert into public.works(id,kind,title,slug,created_by,genres,status) values
 ('11111111-1111-1111-1111-111111111111','anime','Sousou no Frieren','sousou-no-frieren','bbbbbbbb-0000-0000-0000-00000000000b','Aventura, Drama','Finalizado');
insert into public.list_items(user_id,work_id,status,score,progress) values
 ('aaaaaaaa-0000-0000-0000-00000000000a','11111111-1111-1111-1111-111111111111','visto',10,28),
 ('bbbbbbbb-0000-0000-0000-00000000000b','11111111-1111-1111-1111-111111111111','assistindo',9,19);
insert into public.comments(id,work_id,user_id,body) values
 ('c0000000-0000-0000-0000-00000000000b','11111111-1111-1111-1111-111111111111','bbbbbbbb-0000-0000-0000-00000000000b','comentário do Kenji'),
 ('c0000000-0000-0000-0000-00000000000a','11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-00000000000a','comentário do Betoro');
