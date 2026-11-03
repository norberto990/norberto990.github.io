// =====================================================================
//  Atualização automática da Lista de Animes do Betoro-chan
//  Roda no GitHub Actions a cada 15 minutos. 100% gratuito.
//
//  O que faz, nesta ordem:
//   1. AniList  → confere obras novas (as que um amigo adicionou: dados
//                 oficiais, capa, sinopse) e, em todas, atualiza horário
//                 dos episódios de anime, situação, total e até 3 sites
//                 oficiais onde assistir/ler.
//   2. MANGA Plus, Webtoon e Shonen Jump+ (fontes oficiais) → último
//                 capítulo de cada mangá ou novel que tem fonte automática.
//   3. Tradução gratuita da sinopse para o português.
//  Cada obra é salva assim que termina, e nenhum site pode segurar o robô:
//  cada pedido tem tempo limite e o robô para de começar coisas novas
//  antes do limite de 10 minutos do GitHub.
//
//  Segredos do GitHub: SUPABASE_URL e SUPABASE_SERVICE_KEY (obrigatórios),
//  MYMEMORY_EMAIL (opcional: com um e-mail, a cota grátis de tradução fica 10x maior).
// =====================================================================
import Comum from "../comum.js";
import { pathToFileURL } from "node:url";

const { AL_FIELDS, alToWork, feedSeguro, linkSeguro, igual, tipoConfere, traduzir } = Comum;

const SB_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const MM_EMAIL = process.env.MYMEMORY_EMAIL || "";
const MAX_TRAD = Number(process.env.MAX_TRADUCOES || 3); // sinopses traduzidas por execução
const TEMPO_PEDIDO = Number(process.env.TEMPO_PEDIDO_MS || 20000); // tempo máximo de cada pedido a um site
const TEMPO_TOTAL = Number(process.env.TEMPO_TOTAL_MS || 7 * 60e3); // depois disso não começa nada novo
const DRY = process.env.DRY_RUN === "1";

const H = 3600e3,
  D = 24 * H;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(...a);
const iso = t => (t == null ? null : new Date(t).toISOString());
const UA = { "User-Agent": "Mozilla/5.0 (compatible; BetoroChanLista/1.0)" };

// todo pedido tem tempo limite: um site que não responde não trava o robô
function buscar(url, opts = {}) {
  return fetch(url, { ...opts, signal: AbortSignal.timeout(TEMPO_PEDIDO) });
}

/* ---------------- Supabase ---------------- */
async function sb(path, opts = {}) {
  const r = await buscar(SB_URL + "/rest/v1/" + path, {
    ...opts,
    headers: {
      apikey: SB_KEY,
      ...(SB_KEY.startsWith("eyJ") ? { Authorization: "Bearer " + SB_KEY } : {}),
      "Content-Type": "application/json",
      Prefer: "return=minimal",
      ...(opts.headers || {}),
    },
  });
  if (!r.ok) throw new Error(`Supabase ${opts.method || "GET"} ${path.split("?")[0]}: ${r.status} ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
// o Supabase devolve no máximo 1000 linhas por pedido: lê de 1000 em 1000
async function lerObras() {
  let out = [];
  for (let de = 0; ; de += 1000) {
    const parte = await sb(`works?select=*&order=id&limit=1000&offset=${de}`, { headers: { Prefer: "" } });
    out = out.concat(parte);
    if (parte.length < 1000) return out;
  }
}

/* ---------------- AniList ---------------- */
async function anilist(query, variables, tries = 4) {
  for (let i = 0; i < tries; i++) {
    let r;
    try {
      r = await buscar("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query, variables }),
      });
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(3000);
      continue;
    }
    if (r.status === 429) {
      const wait = Math.min(60, Number(r.headers.get("retry-after") || 30));
      log(`AniList pediu para esperar ${wait}s…`);
      await sleep((wait + 1) * 1000);
      continue;
    }
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.errors) {
      if (i === tries - 1) throw new Error("AniList: " + JSON.stringify(j.errors || r.status));
      await sleep(3000);
      continue;
    }
    await sleep(1500); // bem abaixo do limite de pedidos do AniList
    return j.data;
  }
  throw new Error("AniList: sem resposta");
}

/* ---------------- MANGA Plus (protobuf) ---------------- */
// leitor mínimo do formato protobuf: devolve [{f: campo, w: tipo, v: valor}]
export function pbRead(buf) {
  const out = [];
  let i = 0;
  const varint = () => {
    let x = 0n,
      s = 0n,
      b;
    do {
      if (i >= buf.length) throw new Error("pb: fim inesperado");
      b = buf[i++];
      x |= BigInt(b & 0x7f) << s;
      s += 7n;
    } while (b & 0x80);
    return x;
  };
  while (i < buf.length) {
    const key = Number(varint()),
      f = key >> 3,
      w = key & 7;
    if (w === 0) out.push({ f, w, v: varint() });
    else if (w === 2) {
      const n = Number(varint());
      if (i + n > buf.length) throw new Error("pb: tamanho inválido");
      out.push({ f, w, v: buf.subarray(i, i + n) });
      i += n;
    } else if (w === 1) {
      out.push({ f, w, v: buf.subarray(i, i + 8) });
      i += 8;
    } else if (w === 5) {
      out.push({ f, w, v: buf.subarray(i, i + 4) });
      i += 4;
    } else throw new Error("pb: tipo " + w);
  }
  return out;
}
const pbGet = (fields, f) => fields.filter(x => x.f === f);
const pbStr = v => new TextDecoder().decode(v);

export function mangaPlusParse(buf) {
  const root = pbRead(buf);
  const success = pbGet(root, 1)[0];
  if (!success) return null;
  const tdv = pbGet(pbRead(success.v), 8)[0];
  if (!tdv) return null;
  const chapters = [];
  for (const g of pbGet(pbRead(tdv.v), 28)) {
    const gf = pbRead(g.v);
    for (const c of [...pbGet(gf, 2), ...pbGet(gf, 4)]) {
      const cf = pbRead(c.v);
      const id = pbGet(cf, 2)[0],
        name = pbGet(cf, 3)[0],
        ts = pbGet(cf, 6)[0];
      if (!id || !name) continue;
      const label = pbStr(name.v);
      chapters.push({ id: Number(id.v), label, num: parseFloat(label.replace(/^#/, "")), at: ts ? Number(ts.v) * 1000 : null });
    }
  }
  const numbered = chapters.filter(c => isFinite(c.num));
  if (!numbered.length) return null;
  numbered.sort((a, b) => b.num - a.num || (b.at || 0) - (a.at || 0));
  const c = numbered[0];
  return { num: c.num, label: c.label, at: c.at, url: "https://mangaplus.shueisha.co.jp/viewer/" + c.id };
}
async function mangaPlusLatest(titleId) {
  const r = await buscar(`https://jumpg-webapi.tokyo-cdn.com/api/title_detailV3?title_id=${encodeURIComponent(titleId)}&clang=eng`, {
    headers: {
      "SESSION-TOKEN": crypto.randomUUID(),
      Origin: "https://mangaplus.shueisha.co.jp",
      Referer: "https://mangaplus.shueisha.co.jp/",
      ...UA,
    },
  });
  if (!r.ok) throw new Error("MANGA Plus " + r.status);
  return mangaPlusParse(new Uint8Array(await r.arrayBuffer()));
}

/* ---------------- RSS oficiais (Webtoon, Shonen Jump+ e parecidos) ---------------- */
const tagDe = (item, t) => {
  const m = item.match(new RegExp("<" + t + ">([\\s\\S]*?)</" + t + ">", "i"));
  return m ? Comum.decodeEnt(m[1].replace(/^<!\[CDATA\[|\]\]>$/g, "").trim()) : "";
};
export function webtoonParse(xml) {
  const item = (String(xml).match(/<item>([\s\S]*?)<\/item>/i) || [])[1];
  if (!item) return null;
  const title = tagDe(item, "title"),
    link = tagDe(item, "link"),
    pub = tagDe(item, "pubDate");
  let num = NaN,
    m;
  if ((m = title.match(/(?:ep(?:isode)?|ch(?:apter)?|cap(?:[ií]tulo)?)\.?\s*(\d+(?:\.\d+)?)/i))) num = parseFloat(m[1]);
  else if ((m = link.match(/episode_no=(\d+)/))) num = Number(m[1]);
  if (!isFinite(num)) return null;
  return { num, label: title.slice(0, 80), at: Date.parse(pub) || null, url: link || null };
}
async function webtoonLatest(rss) {
  const r = await buscar(rss, { headers: UA });
  if (!r.ok) throw new Error("Webtoon " + r.status);
  return webtoonParse(await r.text());
}
export function gigaParse(xml) {
  let best = null;
  for (const [, it] of String(xml).matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const title = tagDe(it, "title"),
      link = tagDe(it, "link"),
      pub = tagDe(it, "pubDate");
    const m =
      title.match(/第\s*(\d+(?:\.\d+)?)\s*話/) ||
      title.match(/(?:ep(?:isode)?|ch(?:apter)?)\.?\s*(\d+(?:\.\d+)?)/i) ||
      title.match(/[#＃]\s*(\d+(?:\.\d+)?)/);
    if (!m) continue;
    const num = parseFloat(m[1]);
    if (!best || num > best.num) best = { num, label: title.slice(0, 80), at: Date.parse(pub) || null, url: link || null };
  }
  return best;
}
async function gigaLatest(url) {
  let rss = url;
  if (!/\/rss\/series\/\d+/.test(url)) {
    // página da série ou de um capítulo: acha o feed nela, sempre no MESMO site
    const host = new URL(url).host;
    const r = await buscar(url, { headers: UA });
    if (!r.ok) throw new Error("Jump+ " + r.status);
    const achado = [...(await r.text()).matchAll(/https:\/\/[^"'\s<>]+\/rss\/series\/\d+/g)]
      .map(m => m[0])
      .find(u => new URL(u).host === host);
    if (!achado) throw new Error("Jump+: feed não encontrado na página");
    rss = achado;
  }
  const r = await buscar(rss, { headers: UA });
  if (!r.ok) throw new Error("Jump+ RSS " + r.status);
  return gigaParse(await r.text());
}

/* ---------------- tradução gratuita ---------------- */
export function translatePT(text) {
  return traduzir(text, { email: MM_EMAIL, tempo: TEMPO_PEDIDO, pausa: 700 });
}

/* ---------------- quando conferir de novo ---------------- */
const isFinished = s => /finaliz|cancel|finished|cancelled/i.test(String(s || ""));
export function feedDue(w, now) {
  const since = now - (w.rel_checked_at ? Date.parse(w.rel_checked_at) : 0);
  if (w.rel_num == null) return true;
  if (isFinished(w.status)) return since >= 7 * D;
  const relAt = w.rel_at ? Date.parse(w.rel_at) : 0;
  const prev = w.rel_prev_at ? Date.parse(w.rel_prev_at) : 0;
  const cadence = relAt && prev ? Math.min(35 * D, Math.max(3 * D, relAt - prev)) : 7 * D;
  if (relAt && now >= relAt + cadence - 12 * H) return since >= 10 * 60e3; // perto do próximo: toda execução
  if (relAt && now - relAt < 2 * D) return since >= 6 * H; // acabou de sair
  return since >= 2 * H;
}

/* ---------------- lançamento novo ---------------- */
function setRelease(w, patch, r, src, now) {
  if (!r || !isFinite(r.num)) return false;
  const cur = w.rel_num == null ? null : Number(w.rel_num);
  if (cur != null && r.num < cur) return false; // nunca volta para trás
  if (cur != null && r.num === cur && (w.rel_at || !r.at)) return false; // nada novo
  if (cur != null && r.num > cur && w.rel_at) patch.rel_prev_at = w.rel_at;
  patch.rel_num = r.num;
  patch.rel_label = String(r.label || "").slice(0, 80);
  patch.rel_at = iso(r.at || (cur == null ? null : now));
  patch.rel_url = linkSeguro(r.url);
  patch.rel_src = src;
  return true;
}

// dados que o robô confere no AniList quando um amigo adiciona uma obra
const DADOS_ANILIST = [
  "title",
  "alt_titles",
  "cover_url",
  "genres",
  "format",
  "total",
  "status",
  "year",
  "studio",
  "source",
  "mal_id",
  "synopsis_en",
];

export async function main() {
  if (!DRY && (!SB_URL || !SB_KEY)) {
    console.error("Faltam os segredos SUPABASE_URL e/ou SUPABASE_SERVICE_KEY no GitHub.");
    process.exit(1);
  }
  const now = Date.now(),
    prazo = now + TEMPO_TOTAL;
  const semTempo = () => Date.now() > prazo;
  const conta = { rels: 0, links: 0, trads: 0, conferidas: 0, removidas: 0, salvas: 0, erros: 0 };

  // salva uma obra na hora (se o robô parar depois, o que já foi feito não se perde)
  async function salvar(w, p) {
    if (!Object.keys(p).length) return;
    if (DRY) log("  (teste) mudaria", w.id, JSON.stringify(p).slice(0, 200));
    else {
      try {
        await sb(`works?id=eq.${w.id}`, { method: "PATCH", body: JSON.stringify(p) });
      } catch (e) {
        conta.erros++;
        log(`  Salvar ${w.title} falhou: ${e.message}`);
        return;
      }
    }
    Object.assign(w, p);
    conta.salvas++;
  }
  async function remover(w, motivo) {
    log(`  removida: ${w.title} (${motivo})`);
    if (DRY) return;
    try {
      await sb(`works?id=eq.${w.id}`, { method: "DELETE" });
      conta.removidas++;
    } catch (e) {
      conta.erros++;
      log("  Remover falhou:", e.message);
    }
  }
  async function traduzirPara(w, p) {
    try {
      const pt = await translatePT(p.synopsis_en ?? w.synopsis_en);
      if (pt) {
        p.synopsis = pt;
        p.syn_src = "gratis";
        conta.trads++;
        log(`  traduzida: ${w.title}`);
        return true;
      }
    } catch (e) {
      conta.erros++;
      log("  Tradução falhou:", e.message);
    }
    return false;
  }

  const works = await lerObras();
  log(`${works.length} obras no site.`);

  // 1) AniList: confere obras novas e atualiza dados, links e horários
  const withAl = works.filter(w => w.anilist_id);
  const byAl = new Map(withAl.map(w => [w.anilist_id, w]));
  for (let i = 0; i < withAl.length && !semTempo(); i += 25) {
    const lote = withAl.slice(i, i + 25);
    let media;
    try {
      const d = await anilist(`query($ids: [Int]) { Page(perPage: 25) { media(id_in: $ids) { ${AL_FIELDS} } } }`, {
        ids: lote.map(w => w.anilist_id),
      });
      media = d.Page.media;
    } catch (e) {
      conta.erros++;
      log("AniList falhou:", e.message);
      continue;
    }
    const vieram = new Set(media.map(m => m.id));

    // obra de amigo que não existe no AniList (ou é +18, ou é do tipo errado): sai do site
    for (const w of lote) if (!w.verificado_em && !vieram.has(w.anilist_id)) await remover(w, "não existe no AniList");

    for (const m of media) {
      const w = byAl.get(m.id);
      if (!w) continue;
      const a = alToWork(m, w.kind);
      const p = {};
      if (!w.verificado_em) {
        if (m.isAdult || !tipoConfere(m, w.kind)) {
          await remover(w, m.isAdult ? "obra +18" : "tipo diferente do AniList");
          continue;
        }
        // os dados vêm do AniList, não de quem adicionou
        for (const k of DADOS_ANILIST) if (!igual(a[k], w[k])) p[k] = a[k] ?? null;
        if (w.syn_src !== "adm") {
          p.synopsis = "";
          p.syn_src = "";
          if (a.synopsis_en && conta.trads < MAX_TRAD && !semTempo()) await traduzirPara(w, p);
        }
        p.verificado_em = iso(now);
        conta.conferidas++;
      }
      // links escolhidos à mão pelo ADM (marcados com adm: true) nunca são trocados
      if (a.links.length && !igual(a.links, w.links) && !(w.links || []).some(x => x && x.adm)) {
        p.links = a.links;
        conta.links++;
      }
      if (!w.feed && a.feed) p.feed = a.feed;
      if (!w.synopsis_en && a.synopsis_en && p.synopsis_en === undefined) p.synopsis_en = a.synopsis_en;
      if (!w.cover_url && a.cover_url && p.cover_url === undefined) p.cover_url = a.cover_url;
      if (a.status && a.status !== w.status) p.status = a.status;
      if (a.total != null && a.total !== w.total) p.total = a.total;
      if (w.kind === "anime") {
        const nn = a.next_num ?? null,
          na = a.next_at ?? null;
        if (nn !== (w.next_num ?? null)) p.next_num = nn;
        if (na !== (w.next_at ? iso(Date.parse(w.next_at)) : null)) p.next_at = na;
        if (!m.nextAiringEpisode && m.status === "FINISHED" && m.episodes && (w.rel_num == null || Number(w.rel_num) < m.episodes))
          if (setRelease(w, p, { num: m.episodes, label: "", at: null }, "anilist", now)) conta.rels++;
      }
      await salvar(w, p);
    }
  }

  // episódios de anime que já passaram (últimos 30 dias)
  const animes = withAl.filter(w => w.kind === "anime" && !isFinished(w.status));
  for (let i = 0; i < animes.length && !semTempo(); i += 50) {
    try {
      const d = await anilist(
        `query($ids: [Int], $from: Int, $to: Int) { Page(perPage: 50) {
        airingSchedules(mediaId_in: $ids, airingAt_greater: $from, airingAt_lesser: $to, sort: TIME_DESC) { mediaId episode airingAt } } }`,
        { ids: animes.slice(i, i + 50).map(w => w.anilist_id), from: Math.floor((now - 30 * D) / 1000), to: Math.floor(now / 1000) },
      );
      const ultimo = new Map();
      for (const s of d.Page.airingSchedules) if (!ultimo.has(s.mediaId)) ultimo.set(s.mediaId, s);
      for (const [mid, s] of ultimo) {
        const w = byAl.get(mid),
          p = {};
        if (w && setRelease(w, p, { num: s.episode, label: "", at: s.airingAt * 1000 }, "anilist", now)) {
          conta.rels++;
          await salvar(w, p);
        }
      }
    } catch (e) {
      conta.erros++;
      log("Horários do AniList falharam:", e.message);
    }
  }

  // 2) MANGA Plus, Webtoon e Shonen Jump+ (mangás e novels)
  for (const w of works) {
    if (w.kind === "anime" || !w.feed) continue;
    if (semTempo()) {
      log("Tempo do robô acabou: o resto fica para a próxima execução.");
      break;
    }
    const feed = feedSeguro(w.feed);
    if (!feed) {
      log(`  ${w.title}: fonte desconhecida ignorada`);
      continue;
    }
    if (!feedDue(w, now)) continue;
    const p = { rel_checked_at: iso(now) };
    try {
      let r = null,
        src = "";
      if (feed.startsWith("mangaplus:")) {
        r = await mangaPlusLatest(feed.slice(10));
        src = "mangaplus";
        await sleep(1100);
      } else if (feed.startsWith("webtoon:")) {
        r = await webtoonLatest(feed.slice(8));
        src = "webtoon";
        await sleep(800);
      } else if (feed.startsWith("gigaviewer:")) {
        r = await gigaLatest(feed.slice(11));
        src = "jumpplus";
        await sleep(1000);
      }
      if (r && setRelease(w, p, r, src, now)) {
        conta.rels++;
        log(`  novo: ${w.title} → ${r.label || r.num}`);
      }
    } catch (e) {
      conta.erros++;
      log(`  ${w.title}: ${e.message}`);
    }
    await salvar(w, p);
  }

  // 3) tradução gratuita da sinopse
  for (const w of works) {
    if (conta.trads >= MAX_TRAD || semTempo()) break;
    if (w.synopsis || !w.synopsis_en || !w.verificado_em) continue;
    const p = {};
    if (await traduzirPara(w, p)) await salvar(w, p);
    else break; // tradutores fora do ar: tenta na próxima execução
  }

  log(
    `Pronto. ${conta.conferidas} obras novas conferidas, ${conta.removidas} removidas, ${conta.rels} lançamentos novos, ${conta.links} listas de links, ${conta.trads} sinopses traduzidas, ${conta.salvas} obras atualizadas, ${conta.erros} avisos.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
