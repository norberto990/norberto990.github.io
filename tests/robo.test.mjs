// =====================================================================
//  Testes do robô (scripts/sync.mjs) e do código comum (comum.js).
//  Rodar:  node tests/robo.test.mjs      (não precisa de internet)
//  Tudo o que o robô pediria à internet é respondido aqui por um "site falso".
// =====================================================================
process.env.SUPABASE_URL = "https://x.supabase.co";
process.env.SUPABASE_SERVICE_KEY = "sb_secret_teste";
process.env.TEMPO_PEDIDO_MS = "300"; // um site que não responde em 0,3 s é abandonado
const real = globalThis.setTimeout;
globalThis.setTimeout = (f, ms, ...a) => real(f, Math.min(ms || 0, 5), ...a); // sem esperas longas no teste

const { default: Comum } = await import("../comum.js");
const robo = await import("../scripts/sync.mjs");

let falhas = 0;
const ok = (c, msg, extra) => {
  console.log((c ? "✔" : "✘ FALHOU") + " " + msg + (c || extra === undefined ? "" : "  → " + extra));
  if (!c) falhas++;
};

/* ---------- respostas falsas dos sites ---------- */
const enc = new TextEncoder();
const varint = n => {
  n = BigInt(n);
  const o = [];
  do {
    let b = Number(n & 0x7fn);
    n >>= 7n;
    if (n) b |= 0x80;
    o.push(b);
  } while (n);
  return o;
};
const fV = (f, v) => [...varint((f << 3) | 0), ...varint(v)];
const fL = (f, bytes) => [...varint((f << 3) | 2), ...varint(bytes.length), ...bytes];
const fS = (f, s) => fL(f, [...enc.encode(s)]);
const chapter = (id, name, sub, ts) => [...fV(2, id), ...fS(3, name), ...(sub ? fS(4, sub) : []), ...fV(6, ts)];
const NOW = Date.now(),
  D = 864e5,
  T = s => Math.floor(s / 1000);
const mpBytes = new Uint8Array(
  fL(
    1,
    fL(8, [
      ...fL(1, [...fV(1, 100020), ...fS(2, "One Piece")]),
      ...fS(3, "overview..."),
      ...fL(28, [
        ...fL(2, chapter(1000001, "#001", "Romance Dawn", T(NOW - 9e11))),
        ...fL(4, chapter(1024001, "#1165", "x", T(NOW - 8 * D))),
        ...fL(4, chapter(1024002, "#1166", "The Flag", T(NOW - 3600e3))),
        ...fL(4, chapter(1024003, "ex", "Extra", T(NOW))),
      ]),
    ]),
  ),
);
const rss = `<?xml version="1.0"?><rss><channel><title>Tower of God</title>
<item><title><![CDATA[[Season 3] Ep. 640]]></title><link>https://www.webtoons.com/en/fantasy/tower-of-god/s3-ep-640/viewer?title_no=95&amp;episode_no=661</link><pubDate>Sun, 01 Nov 2026 15:00:00 GMT</pubDate></item>
<item><title>[Season 3] Ep. 639</title><link>https://x?episode_no=660</link><pubDate>Sun, 25 Oct 2026 15:00:00 GMT</pubDate></item></channel></rss>`;
const media = (id, extra) => ({
  id,
  idMal: null,
  type: "ANIME",
  format: "TV",
  status: "RELEASING",
  episodes: null,
  chapters: null,
  volumes: null,
  source: "MANGA",
  isAdult: false,
  title: { romaji: "Obra " + id, english: null, native: null },
  synonyms: [],
  startDate: { year: 2020 },
  genres: [],
  coverImage: {},
  description: "",
  studios: { nodes: [] },
  staff: { edges: [] },
  nextAiringEpisode: null,
  externalLinks: [],
  ...extra,
});
const MEDIA = [
  media(1, {
    title: { romaji: "Frieren 2" },
    episodes: 12,
    description: "An elf mage<br>journeys on. She remembers her friends. The end is near!",
    coverImage: { large: "https://s4.anilist.co/1.jpg" },
    nextAiringEpisode: { episode: 5, airingAt: T(NOW + 6 * D) },
    externalLinks: [
      { site: "Crunchyroll", url: "https://www.crunchyroll.com/series/x", type: "STREAMING", language: "Portuguese" },
      { site: "Netflix", url: "https://netflix.com/title/1", type: "STREAMING", language: null },
      { site: "Twitter", url: "https://twitter.com/x", type: "SOCIAL", language: "Japanese" },
      { site: "Crunchyroll", url: "https://www.crunchyroll.com/en/x", type: "STREAMING", language: "English" },
      { site: "Prime Video", url: "https://primevideo.com/x", type: "STREAMING", language: "English" },
      { site: "Golpe", url: "javascript:alert(1)", type: "STREAMING", language: "Portuguese" },
    ],
  }),
  media(2, {
    type: "MANGA",
    format: "MANGA",
    title: { romaji: "One Piece" },
    description: "Pirates",
    externalLinks: [
      { site: "MANGA Plus", url: "https://mangaplus.shueisha.co.jp/titles/100020", type: "STREAMING", language: "English" },
      { site: "MANGA Plus", url: "https://mangaplus.shueisha.co.jp/titles/100312", type: "STREAMING", language: "Portuguese" },
      { site: "VIZ", url: "https://www.viz.com/shonenjump/chapters/one-piece", type: "STREAMING", language: "English" },
    ],
  }),
  media(3, {
    type: "MANGA",
    format: "MANGA",
    title: { romaji: "Tower of God" },
    description: "A tower.",
    externalLinks: [
      { site: "WEBTOON", url: "https://www.webtoons.com/en/fantasy/tower-of-god/list?title_no=95", type: "STREAMING", language: "English" },
    ],
  }),
  media(4, {
    title: { romaji: "Já em dia" },
    externalLinks: [{ site: "Crunchyroll", url: "https://www.crunchyroll.com/y", type: "STREAMING", language: "Portuguese" }],
  }),
  media(30013, {
    type: "MANGA",
    format: "MANGA",
    title: { romaji: "One Piece", english: "One Piece" },
    description: "Gol D. Roger was the Pirate King.",
    coverImage: { large: "https://s4.anilist.co/op.jpg" },
    genres: ["Action"],
  }),
  media(66, { isAdult: true, title: { romaji: "Proibida" } }),
  media(77, { type: "MANGA", format: "NOVEL", title: { romaji: "É novel" } }),
];

let obras = [],
  patches = [],
  apagadas = [],
  pedidos = [],
  mmCalls = 0,
  travar = () => false;
const json = (o, status = 200) => ({
  ok: status < 300,
  status,
  headers: { get: () => null },
  json: async () => o,
  text: async () => JSON.stringify(o),
});
globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  pedidos.push(url);
  if (travar(url))
    return new Promise((_, rej) => opts.signal && opts.signal.addEventListener("abort", () => rej(new Error("tempo esgotado"))));
  if (url.startsWith("https://graphql.anilist.co")) {
    const b = JSON.parse(opts.body);
    if (b.query.includes("airingSchedules"))
      return json({
        data: {
          Page: {
            airingSchedules: [
              { mediaId: 1, episode: 4, airingAt: T(NOW - 3600e3) },
              { mediaId: 1, episode: 3, airingAt: T(NOW - 7 * D - 3600e3) },
            ],
          },
        },
      });
    return json({ data: { Page: { media: MEDIA.filter(m => b.variables.ids.includes(m.id)) } } });
  }
  if (url.startsWith("https://jumpg-webapi.tokyo-cdn.com")) {
    if (!/title_id=100020/.test(url)) throw new Error("título errado " + url);
    if (!opts.headers || !opts.headers["SESSION-TOKEN"]) throw new Error("sem SESSION-TOKEN");
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => mpBytes.buffer.slice(mpBytes.byteOffset, mpBytes.byteOffset + mpBytes.byteLength),
    };
  }
  if (url.startsWith("https://www.webtoons.com/en/fantasy/tower-of-god/rss?title_no=95"))
    return { ok: true, status: 200, text: async () => rss };
  if (url.startsWith("https://api.mymemory.translated.net")) {
    mmCalls++;
    const q = new URL(url).searchParams.get("q");
    if (q.length > 500) throw new Error("q grande");
    return json({ responseStatus: 200, responseData: { translatedText: "[PT] " + q } });
  }
  if (url.includes("/rest/v1/works?select")) {
    const de = Number(new URL(url).searchParams.get("offset") || 0);
    return json(obras.slice(de, de + 1000));
  }
  if (url.includes("/rest/v1/works?id=eq.")) {
    const id = url.split("eq.")[1];
    if (opts.method === "DELETE") apagadas.push(id);
    else patches.push([id, JSON.parse(opts.body)]);
    return { ok: true, status: 204, text: async () => "" };
  }
  throw new Error("URL inesperada: " + url);
};
async function rodar(lista, trava) {
  obras = JSON.parse(JSON.stringify(lista));
  patches = [];
  apagadas = [];
  pedidos = [];
  mmCalls = 0;
  travar = trava || (() => false);
  const fim = await Promise.race([robo.main().then(() => "terminou"), new Promise(r => real(() => r("TRAVADO"), 15000))]);
  const P = {};
  for (const [id, p] of patches) P[id] = { ...(P[id] || {}), ...p };
  return { fim, P };
}
const iso = t => new Date(t).toISOString(),
  ontem = iso(NOW - D);

/* ---------- 1. funcionamento normal ---------- */
console.log("\n— Robô: funcionamento normal");
let { fim, P } = await rodar([
  {
    id: "a1",
    kind: "anime",
    title: "Frieren 2",
    anilist_id: 1,
    status: "Em lançamento",
    total: null,
    rel_num: 3,
    rel_at: iso(NOW - 7 * D),
    links: [],
    feed: "",
    synopsis: "",
    synopsis_en: "",
    cover_url: null,
    next_num: 4,
    next_at: iso(NOW - 3600e3),
    verificado_em: ontem,
  },
  {
    id: "m1",
    kind: "manga",
    title: "One Piece",
    anilist_id: 2,
    status: "Em lançamento",
    total: null,
    rel_num: 1165,
    rel_at: iso(NOW - 8 * D),
    rel_prev_at: iso(NOW - 15 * D),
    rel_checked_at: iso(NOW - 20 * 60e3),
    links: [],
    feed: "",
    synopsis: "já traduzida",
    synopsis_en: "x",
    cover_url: "c",
    verificado_em: ontem,
  },
  {
    id: "w1",
    kind: "manga",
    title: "Tower of God",
    anilist_id: 3,
    status: "Em lançamento",
    total: null,
    rel_num: null,
    links: [],
    feed: "",
    synopsis: "",
    synopsis_en: "",
    cover_url: "c",
    verificado_em: ontem,
  },
  {
    id: "e1",
    kind: "anime",
    title: "Já em dia",
    anilist_id: 4,
    status: "Em lançamento",
    total: null,
    links: [{ url: "https://www.crunchyroll.com/y", lang: "PT", site: "Crunchyroll" }],
    feed: "",
    synopsis: "a",
    synopsis_en: "",
    cover_url: "c",
    verificado_em: ontem,
  },
  {
    id: "n1",
    kind: "novel",
    title: "Novel sem fonte",
    anilist_id: null,
    status: "",
    rel_num: 5,
    links: [],
    feed: "",
    synopsis: "",
    synopsis_en: "",
    cover_url: "c",
    verificado_em: ontem,
  },
]);
ok(fim === "terminou", "robô termina");
ok(P.a1.rel_num === 4 && P.a1.next_num === 5, "anime: ep. 4 saiu, próximo é o 5");
ok(
  P.a1.links.length === 3 && P.a1.links[0].lang === "PT" && P.a1.links[1].site === "Netflix" && !P.a1.links.some(l => l.site === "Twitter"),
  "anime: 3 links oficiais, português, depois Netflix, sem rede social",
  JSON.stringify(P.a1.links),
);
ok(!JSON.stringify(P).includes("javascript:"), "nenhum link javascript: vindo do AniList é salvo");
ok(!/&amp;/.test(P.w1.rel_url), "link do Webtoon sem &amp;");
ok(P.a1.rel_prev_at, "anime: guardou quando saiu o anterior (ritmo)");
ok(
  P.m1.feed === "mangaplus:100020" && P.m1.rel_num === 1166 && /viewer\/1024002$/.test(P.m1.rel_url),
  "One Piece: cap. 1166 pelo MANGA Plus, com link oficial do capítulo",
);
ok(P.m1.links[0].lang === "PT" && P.m1.links.length === 2, "One Piece: link do MANGA Plus em português primeiro (sem repetir site)");
ok(P.w1.feed.startsWith("webtoon:") && P.w1.rel_num === 640, "Webtoon: Ep. 640 pelo feed oficial");
ok(P.a1.synopsis && P.a1.synopsis.startsWith("[PT]") && P.a1.syn_src === "gratis", "sinopse traduzida de graça");
ok(!P.m1.synopsis, "não retraduz sinopse que já existe");
ok(!P.n1, "obra sem fonte oficial: não mexe (fica para o ADM)");
ok(!P.e1, "links iguais em outra ordem de campos: não salva de novo à toa", JSON.stringify(P.e1));
ok(!P.m1.title && !P.a1.title, "obra já conferida: o robô não troca nome nem dados que o ADM possa ter corrigido");

/* ---------- 2. obra envenenada por quem não é ADM ---------- */
console.log("\n— Robô: obras adicionadas por amigos (ou por um estranho)");
({ fim, P } = await rodar([
  {
    id: "u1",
    kind: "manga",
    title: "LIXO",
    alt_titles: "golpe",
    anilist_id: 30013,
    status: "",
    total: null,
    links: [],
    feed: "",
    synopsis: "sinopse falsa",
    syn_src: "gratis",
    synopsis_en: "texto falso",
    cover_url: null,
    verificado_em: null,
  },
  {
    id: "u2",
    kind: "anime",
    title: "Inventada",
    anilist_id: 999999,
    links: [],
    feed: "",
    synopsis: "",
    synopsis_en: "",
    verificado_em: null,
  },
  { id: "u3", kind: "anime", title: "Proibida", anilist_id: 66, links: [], feed: "", synopsis: "", synopsis_en: "", verificado_em: null },
  {
    id: "u4",
    kind: "anime",
    title: "Tipo errado",
    anilist_id: 77,
    links: [],
    feed: "",
    synopsis: "",
    synopsis_en: "",
    verificado_em: null,
  },
  {
    id: "v1",
    kind: "anime",
    title: "Antiga",
    anilist_id: 888888,
    links: [],
    feed: "",
    synopsis: "",
    synopsis_en: "",
    verificado_em: ontem,
  },
]));
ok(
  P.u1 && P.u1.title === "One Piece" && P.u1.alt_titles === "" && P.u1.cover_url === "https://s4.anilist.co/op.jpg",
  "nome, outros nomes e capa voltam a ser os do AniList",
  JSON.stringify(P.u1),
);
ok(
  P.u1 && P.u1.synopsis_en === "Gol D. Roger was the Pirate King." && P.u1.synopsis === "[PT] Gol D. Roger was the Pirate King.",
  "sinopse falsa trocada pela oficial traduzida",
);
ok(P.u1 && P.u1.verificado_em, "obra marcada como conferida");
ok(
  apagadas.includes("u2") && apagadas.includes("u3") && apagadas.includes("u4"),
  "obra inexistente, +18 ou de outro tipo sai do site",
  JSON.stringify(apagadas),
);
ok(!apagadas.includes("v1"), "obra antiga já conferida nunca é apagada pelo robô");

/* ---------- 3. site que não responde e fonte desconhecida ---------- */
console.log("\n— Robô: sites travados e fontes estranhas");
({ fim, P } = await rodar(
  [
    {
      id: "t1",
      kind: "manga",
      title: "Webtoon travado",
      anilist_id: null,
      rel_num: null,
      links: [],
      feed: "webtoon:https://www.webtoons.com/en/x/trava/rss?title_no=1",
      synopsis: "a",
      synopsis_en: "",
      verificado_em: ontem,
    },
    {
      id: "x1",
      kind: "manga",
      title: "Fonte do atacante",
      anilist_id: null,
      rel_num: null,
      links: [],
      feed: "gigaviewer:https://evil.example/trava",
      synopsis: "a",
      synopsis_en: "",
      verificado_em: ontem,
    },
    {
      id: "w1",
      kind: "manga",
      title: "Tower of God",
      anilist_id: null,
      rel_num: 1,
      links: [],
      feed: "webtoon:https://www.webtoons.com/en/fantasy/tower-of-god/rss?title_no=95",
      synopsis: "a",
      synopsis_en: "",
      verificado_em: ontem,
    },
  ],
  url => url.includes("/trava"),
));
ok(fim === "terminou", "robô termina mesmo com um site que não responde", fim);
ok(P.w1 && P.w1.rel_num === 640, "a obra depois da travada é atualizada e salva");
ok(P.t1 && P.t1.rel_checked_at && P.t1.rel_num === undefined, "a obra travada fica para a próxima, sem inventar capítulo");
ok(!pedidos.some(u => u.includes("evil.example")), "o robô nunca acessa uma fonte fora da lista oficial");

/* ---------- 4. mais de 1000 obras ---------- */
console.log("\n— Robô: muitas obras");
const muitas = Array.from({ length: 1005 }, (_, i) => ({
  id: "o" + i,
  kind: "novel",
  title: "N" + i,
  anilist_id: null,
  links: [],
  feed: "",
  synopsis: "a",
  synopsis_en: "",
  verificado_em: ontem,
}));
const antes = console.log;
let lido = "";
console.log = (...a) => {
  if (String(a[0]).includes("obras no site")) lido = a[0];
};
await rodar(muitas);
console.log = antes;
ok(lido.startsWith("1005 "), "lê todas as obras, mesmo passando de 1000", lido);

/* ---------- 5. funções isoladas ---------- */
console.log("\n— Funções do robô e do comum.js");
ok(
  robo.feedDue(
    { rel_num: 1, rel_at: iso(NOW - 8 * D), rel_prev_at: iso(NOW - 15 * D), rel_checked_at: iso(NOW - 11 * 60e3), status: "Em lançamento" },
    NOW,
  ),
  "confere toda hora perto do próximo capítulo",
);
ok(
  !robo.feedDue({ rel_num: 1, rel_at: iso(NOW - 1 * D), rel_checked_at: iso(NOW - 60 * 60e3), status: "Em lançamento" }, NOW),
  "não fica conferindo logo depois que saiu",
);
ok(!robo.feedDue({ rel_num: 1, rel_checked_at: iso(NOW - D), status: "Finalizado" }, NOW), "obra finalizada: só 1 vez por semana");
const jp = robo.gigaParse(
  `<rss><item><title>[第150話]怪獣8号</title><link>https://shonenjumpplus.com/episode/3270296674397</link><pubDate>Mon, 30 Oct 2026 15:00:00 GMT</pubDate></item><item><title>[第149話]怪獣8号</title><link>https://x</link></item></rss>`,
);
ok(jp && jp.num === 150 && jp.url === "https://shonenjumpplus.com/episode/3270296674397", "Shonen Jump+: lê 第150話");
ok(
  Comum.linkSeguro("javascript:alert(1)") === null &&
    Comum.linkSeguro("data:text/html,x") === null &&
    Comum.linkSeguro("https://ok.com/a") === "https://ok.com/a",
  "linkSeguro só aceita https://",
);
ok(
  Comum.feedSeguro("gigaviewer:https://evil.example/x") === "" &&
    Comum.feedSeguro("mangaplus:1&x=1") === "" &&
    Comum.feedSeguro("mangaplus:100020") === "mangaplus:100020",
  "feedSeguro recusa fontes estranhas",
);
ok(
  Comum.cleanSyn("Tom &lt;3 Jerry<br>&amp; &#39;x&#39;") === "Tom <3 Jerry\n& 'x'",
  "sinopse: &lt; &gt; &amp; viram símbolos (site e robô iguais)",
);
ok(
  Comum.chunks("a".repeat(1000) + ". Fim.").every(c => c.length <= 450),
  "tradução: nenhum trecho passa de 450 letras",
);
ok(Comum.igual({ url: "a", lang: "", site: "s" }, { site: "s", url: "a", lang: "" }), "comparação ignora a ordem dos campos");
const tr = await Comum.traduzir("First sentence. Second one!\n\nNew paragraph.");
ok(tr === "[PT] First sentence. Second one!\n\n[PT] New paragraph.", "tradução mantém os parágrafos", JSON.stringify(tr));

console.log(falhas ? `\n${falhas} teste(s) falharam.` : "\nTodos os testes do robô passaram.");
process.exit(falhas ? 1 : 0);
