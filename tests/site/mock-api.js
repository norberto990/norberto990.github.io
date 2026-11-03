// =====================================================================
//  Banco de dados FALSO para os testes do site (tests/site/site.test.py).
//  Imita o Supabase e as travas do supabase/schema.sql, sem internet.
//  Usuários: adm@... entra como ADM (Betoro); qualquer outro e-mail entra como Kenji. Senha: 123456.
// =====================================================================
(function(){
  const now=Date.now(), D=864e5, H=3600e3, iso=t=>new Date(t).toISOString();
  const U={a:"11111111-aaaa",b:"22222222-bbbb",c:"33333333-cccc"};
  let works=[
    {id:"w1-frieren-0001",kind:"anime",title:"Sousou no Frieren",slug:"sousou-no-frieren",alt_titles:"Frieren: Beyond Journey's End · 葬送のフリーレン",cover_url:null,synopsis:"Depois de derrotar o Rei Demônio, a maga elfa Frieren parte numa nova jornada.",synopsis_en:"After defeating the Demon King, the elf mage Frieren sets out on a new journey.",syn_src:"gratis",genres:"Aventura, Drama, Fantasia",format:"TV",total:28,status:"Em lançamento",year:2023,studio:"Madhouse",source:"Mangá",anilist_id:154587,mal_id:52991,created_at:iso(now-40*D),verificado_em:iso(now-40*D),
     rel_num:6,rel_at:iso(now-7*D),rel_src:"anilist",next_num:7,next_at:iso(now-30*60e3),rel_checked_at:iso(now-10*60e3),feed:"",
     links:[{site:"Crunchyroll",url:"https://www.crunchyroll.com/pt-br/series/x",lang:"PT"},{site:"Netflix",url:"https://www.netflix.com/title/1",lang:""},{site:"Prime Video",url:"https://www.primevideo.com/x",lang:"EN"}]},
    {id:"w2-jjk-00000002",kind:"anime",title:"Jujutsu Kaisen",slug:"jujutsu-kaisen",alt_titles:"",cover_url:null,synopsis:"",synopsis_en:"",genres:"",format:"",total:null,status:"",year:null,studio:"",source:"",anilist_id:null,mal_id:null,created_at:iso(now-10*D),verificado_em:iso(now-10*D),links:[],feed:"",rel_num:null,next_num:5,next_at:iso(now+2*D+3*H)},
    {id:"w3-onepiece-003",kind:"manga",title:"One Piece",slug:"one-piece",alt_titles:"ワンピース",cover_url:null,synopsis:"",synopsis_en:"Gol D. Roger was known as the Pirate King...",genres:"Ação, Aventura",format:"Mangá",total:null,status:"Em lançamento",year:1997,studio:"Eiichiro Oda",source:"Original",anilist_id:30013,mal_id:13,created_at:iso(now-5*D),verificado_em:iso(now-5*D),
     rel_num:1166,rel_at:iso(now-2*H),rel_label:"#1166",rel_url:"https://mangaplus.shueisha.co.jp/viewer/1024002",rel_src:"mangaplus",rel_checked_at:iso(now-5*60e3),feed:"mangaplus:100020",
     links:[{site:"MANGA Plus",url:"https://mangaplus.shueisha.co.jp/titles/100312",lang:"PT"},{site:"VIZ",url:"https://www.viz.com/shonenjump/chapters/one-piece",lang:"EN"}]},
    {id:"w4-novel-000004",kind:"novel",title:"Mushoku Tensei",slug:"mushoku-tensei",alt_titles:"",cover_url:null,synopsis:"",synopsis_en:"",genres:"",format:"Light novel",total:26,status:"Finalizado",year:2014,studio:"",source:"",anilist_id:null,created_at:iso(now-9*D),verificado_em:iso(now-9*D),links:[],feed:"",rel_num:null}];
  let items=[
    {user_id:U.a,work_id:"w1-frieren-0001",status:"assistindo",score:10,progress:4,image_url:null,updated_at:iso(now-2*D)},
    {user_id:U.a,work_id:"w3-onepiece-003",status:"assistindo",score:9,progress:1166,image_url:null,updated_at:iso(now-D)},
    {user_id:U.b,work_id:"w1-frieren-0001",status:"assistindo",score:9,progress:6,image_url:null,updated_at:iso(now-3*D)},
    {user_id:U.c,work_id:"w3-onepiece-003",status:"visto",score:8,progress:0,image_url:null,updated_at:iso(now-D)}];
  let profiles=[{id:U.a,nick:"Betoro",is_admin:true},{id:U.b,nick:"Kenji",is_admin:false},{id:U.c,nick:"Mari",is_admin:false}];
  let comments=[
    {id:"c1",work_id:"w1-frieren-0001",user_id:U.b,parent_id:null,reply_to_user:null,body:"Episódio 10 me quebrou.",image_url:null,created_at:iso(now-2*D)},
    {id:"c2",work_id:"w1-frieren-0001",user_id:U.c,parent_id:"c1",reply_to_user:U.b,body:"Verdade!!",image_url:null,created_at:iso(now-D)}];
  let me=null, authCb=()=>{};
  const clone=x=>JSON.parse(JSON.stringify(x));
  const isAdm=()=>me && profiles.find(p=>p.id===me.id).is_admin;
  const deny=()=>{ throw new Error("new row violates row-level security policy for table \"works\""); };
  window.__failNext=false;
  window.__MOCK_API={
    loadAll: async()=>({works:clone(works),items:clone(items),profiles:clone(profiles),comments:comments.map(c=>({id:c.id,work_id:c.work_id,user_id:c.user_id,created_at:c.created_at}))}),
    loadTable: async t=>clone({works,list_items:items,profiles,comments}[t]),
    loadComments: async wid=>clone(comments.filter(c=>c.work_id===wid)),
    insertWork: async w=>{
      if(!isAdm() && !w.anilist_id) deny();
      if(w.anilist_id && works.some(x=>x.anilist_id===w.anilist_id)) throw new Error('duplicate key value violates unique constraint "works_anilist_id_key"');
      if(works.some(x=>x.kind===w.kind && x.slug===w.slug)) throw new Error('duplicate key value violates unique constraint "works_kind_slug_key"');
      const r={id:"w"+Math.random().toString(36).slice(2,10),synopsis:"",synopsis_en:"",genres:"",format:"",total:null,status:"",year:null,studio:"",source:"",anilist_id:null,links:[],feed:"",rel_num:null,...w,created_at:iso(Date.now()),verificado_em:iso(Date.now())};
      if(!isAdm()){ // trava do banco: quem não é ADM só traz dados do AniList; o robô confere depois
        Object.assign(r,{links:[],feed:"",rel_num:null,rel_label:"",rel_at:null,rel_url:null,rel_src:"",next_num:null,next_at:null,verificado_em:null});
        if(r.cover_url && !/^https:\/\/s[0-9]*\.anilist\.co\//.test(r.cover_url)) r.cover_url=null;
      }
      works.push(r); return clone(r); },
    updateWork: async (id,p)=>{ if(!isAdm()) deny(); if(p.title && p.title.length>160) throw new Error('new row for relation "works" violates check constraint "works_title_check"'); const w=works.find(x=>x.id===id); Object.assign(w,p); return clone(w); },
    deleteWork: async id=>{ if(!isAdm()) deny(); works=works.filter(w=>w.id!==id); items=items.filter(i=>i.work_id!==id); comments=comments.filter(c=>c.work_id!==id); },
    upsertItem: async it=>{ if(window.__failNext){ window.__failNext=false; throw new Error("Failed to fetch"); }
      if(!Number.isInteger(it.progress)) throw new Error('invalid input syntax for type integer: "'+it.progress+'"');
      if(it.progress<0 || it.progress>100000) throw new Error('new row for relation "list_items" violates check constraint "list_items_progress_check"');
      items=items.filter(i=>!(i.user_id===it.user_id&&i.work_id===it.work_id)); items.push(clone(it)); return clone(it); },
    deleteItem: async (u,w)=>{ items=items.filter(i=>!(i.user_id===u&&i.work_id===w)); },
    insertComment: async c=>{
      if(c.parent_id){ const pai=comments.find(x=>x.id===c.parent_id); if(!pai) throw new Error("resposta_apagada: o comentário que você respondia foi apagado"); if(pai.work_id!==c.work_id) throw new Error("resposta_outra_obra"); }
      const r={id:"c"+Math.random().toString(36).slice(2,8),...c,created_at:iso(Date.now())}; comments.push(r); return clone(r); },
    deleteComment: async id=>{ const c=comments.find(x=>x.id===id); if(c.user_id!==me.id && !isAdm()) deny(); comments=comments.filter(c=>c.id!==id); },
    updateNick: async (id,nick)=>{ const p=profiles.find(x=>x.id===id); p.nick=nick; return clone(p); },
    upload: async (uid,b)=>URL.createObjectURL(b),
    session: async()=>me, onAuth: cb=>{authCb=cb;},
    signIn: async(e,p)=>{ if(p!=="123456") throw new Error("Invalid login credentials"); me={id:e.startsWith("adm")?U.a:U.b,email:e}; authCb(me); return {}; },
    signUp: async()=>({session:null}), signOut: async()=>{ me=null; authCb(null); }, resetPassword: async()=>{},
    subscribe: ()=>{}
  };
})();
