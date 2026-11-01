// =====================================================================
//  Atualização automática da Lista de Animes do Betoro-chan
//  Roda no GitHub Actions a cada 15 minutos. 100% gratuito.
//
//  O que faz:
//   1. AniList  → horário oficial dos episódios de anime, último episódio,
//                 situação, total de episódios/capítulos e até 3 sites
//                 oficiais onde assistir/ler.
//   2. MANGA Plus (oficial da Shueisha) → último capítulo de mangás como
//                 One Piece, Jujutsu Kaisen, Chainsaw Man...
//   3. Webtoon e Shonen Jump+ (feeds oficiais) → último episódio/capítulo.
//   4. Tradução gratuita (MyMemory) → sinopse em português.
//  Não adiciona obras: só o ADM adiciona pelo site.
//
//  Segredos do GitHub: SUPABASE_URL e SUPABASE_SERVICE_KEY (obrigatórios),
//  MYMEMORY_EMAIL (opcional: com um e-mail, a cota grátis de tradução fica 10x maior).
// =====================================================================

const SB_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const MM_EMAIL = process.env.MYMEMORY_EMAIL || "";
const MAX_TRAD = Number(process.env.MAX_TRADUCOES || 3);   // sinopses traduzidas por execução
const DRY = process.env.DRY_RUN === "1";

const H = 3600e3, D = 24 * H;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(...a);

/* ---------------- Supabase ---------------- */
async function sb(path, opts = {}) {
  const r = await fetch(SB_URL + "/rest/v1/" + path, {
    ...opts,
    headers: {
      apikey: SB_KEY,
      ...(SB_KEY.startsWith("eyJ") ? { Authorization: "Bearer " + SB_KEY } : {}),
      "Content-Type": "application/json", Prefer: "return=minimal", ...(opts.headers || {}),
    },
  });
  if (!r.ok) throw new Error(`Supabase ${opts.method || "GET"} ${path.split("?")[0]}: ${r.status} ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

/* ---------------- AniList ---------------- */
async function anilist(query, variables, tries = 4) {
  for (let i = 0; i < tries; i++) {
    let r;
    try {
      r = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query, variables }),
      });
    } catch (e) { if (i === tries - 1) throw e; await sleep(3000); continue; }
    if (r.status === 429) { const wait = Number(r.headers.get("retry-after") || 30); log(`AniList pediu para esperar ${wait}s…`); await sleep((wait + 1) * 1000); continue; }
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.errors) { if (i === tries - 1) throw new Error("AniList: " + JSON.stringify(j.errors || r.status)); await sleep(3000); continue; }
    await sleep(1500); // bem abaixo do limite de pedidos do AniList
    return j.data;
  }
}

const STATUS_PT = { FINISHED: "Finalizado", RELEASING: "Em lançamento", NOT_YET_RELEASED: "Ainda não lançado", CANCELLED: "Cancelado", HIATUS: "Em hiato" };
const LANG = { Portuguese: "PT", English: "EN", Japanese: "JP", Spanish: "ES", French: "FR", German: "DE", Italian: "IT", Korean: "KO", Chinese: "ZH" };

// até 3 sites oficiais, preferindo português, depois inglês
function pickLinks(ext) {
  const all = (ext || []).filter(l => l && l.url && /^https?:\/\//.test(l.url));
  let list = all.filter(l => l.type === "STREAMING");
  if (!list.length) list = all.filter(l => l.type === "INFO" && !/twitter|^x$|instagram|youtube|tiktok|facebook|discord|wikipedia/i.test(l.site || ""));
  // português primeiro; depois links sem idioma (costumam valer no mundo todo, inclusive no Brasil); depois inglês
  const rank = l => /portug/i.test(l.language || "") ? 0 : !l.language ? 1 : /english/i.test(l.language || "") ? 2 : 3;
  const out = [], seen = new Set();
  for (const l of list.slice().sort((a, b) => rank(a) - rank(b))) {
    const k = String(l.site || "").toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k); out.push({ site: String(l.site || "Site oficial").slice(0, 40), url: l.url, lang: LANG[l.language] || "" });
    if (out.length === 3) break;
  }
  return out;
}

// descobre uma fonte oficial que o robô consegue ler sozinho
function feedFromUrl(url) {
  let m;
  if ((m = String(url).match(/mangaplus\.shueisha\.co\.jp\/titles\/(\d+)/))) return "mangaplus:" + m[1];
  if ((m = String(url).match(/webtoons\.com\/([a-z-]+)\/([^/?#]+)\/([^/?#]+)\/(?:list|rss)\?title_no=(\d+)/i)))
    return "webtoon:https://www.webtoons.com/" + m[1] + "/" + m[2] + "/" + m[3] + "/rss?title_no=" + m[4];
  if ((m = String(url).match(/^https?:\/\/(?:www\.)?(?:shonenjumpplus\.com|tonarinoyj\.jp|comic-days\.com|comic-action\.com|comicborder\.com|comic-gardo\.com|kuragebunch\.com|magcomi\.com|comic-zenon\.com|comic-trail\.com|comic-ogyaaa\.com|viewer\.heros-web\.com|comic-earthstar\.com|comicbushi-web\.com|ichicomi\.com)\/(?:episode|rss\/series|series)\/\d+/i)))
    return "gigaviewer:" + m[0].replace(/^http:/, "https:");
  return "";
}
function feedFromLinks(ext) {
  const all = (ext || []).filter(l => l && l.url);
  const mp = all.filter(l => /mangaplus\.shueisha/.test(l.url)).sort((a, b) => (/english/i.test(a.language || "") ? 0 : 1) - (/english/i.test(b.language || "") ? 0 : 1));
  for (const l of [...mp, ...all]) { const f = feedFromUrl(l.url); if (f) return f; }
  return "";
}

const cleanSyn = s => String(s || "")
  .replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")
  .replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/\n{3,}/g, "\n\n").trim().slice(0, 5900);

/* ---------------- MANGA Plus (protobuf) ---------------- */
// leitor mínimo do formato protobuf: devolve [{f: campo, w: tipo, v: valor}]
export function pbRead(buf) {
  const out = []; let i = 0;
  const varint = () => { let x = 0n, s = 0n, b; do { if (i >= buf.length) throw new Error("pb: fim inesperado"); b = buf[i++]; x |= BigInt(b & 0x7f) << s; s += 7n; } while (b & 0x80); return x; };
  while (i < buf.length) {
    const key = Number(varint()), f = key >> 3, w = key & 7;
    if (w === 0) out.push({ f, w, v: varint() });
    else if (w === 2) { const n = Number(varint()); if (i + n > buf.length) throw new Error("pb: tamanho inválido"); out.push({ f, w, v: buf.subarray(i, i + n) }); i += n; }
    else if (w === 1) { out.push({ f, w, v: buf.subarray(i, i + 8) }); i += 8; }
    else if (w === 5) { out.push({ f, w, v: buf.subarray(i, i + 4) }); i += 4; }
    else throw new Error("pb: tipo " + w);
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
      const id = pbGet(cf, 2)[0], name = pbGet(cf, 3)[0], ts = pbGet(cf, 6)[0];
      if (!id || !name) continue;
      const label = pbStr(name.v);
      const num = parseFloat(label.replace(/^#/, ""));
      chapters.push({ id: Number(id.v), label, num, at: ts ? Number(ts.v) * 1000 : null });
    }
  }
  const numbered = chapters.filter(c => isFinite(c.num));
  if (!numbered.length) return null;
  numbered.sort((a, b) => b.num - a.num || (b.at || 0) - (a.at || 0));
  const c = numbered[0];
  return { num: c.num, label: c.label, at: c.at, url: "https://mangaplus.shueisha.co.jp/viewer/" + c.id };
}

async function mangaPlusLatest(titleId) {
  const r = await fetch(`https://jumpg-webapi.tokyo-cdn.com/api/title_detailV3?title_id=${titleId}&clang=eng`, {
    headers: {
      "SESSION-TOKEN": crypto.randomUUID(),
      Origin: "https://mangaplus.shueisha.co.jp", Referer: "https://mangaplus.shueisha.co.jp/",
      "User-Agent": "Mozilla/5.0 (compatible; BetoroChanLista/1.0)",
    },
  });
  if (!r.ok) throw new Error("MANGA Plus " + r.status);
  return mangaPlusParse(new Uint8Array(await r.arrayBuffer()));
}

/* ---------------- Webtoon (RSS oficial) ---------------- */
export function webtoonParse(xml) {
  const item = (String(xml).match(/<item>([\s\S]*?)<\/item>/i) || [])[1];
  if (!item) return null;
  const tag = t => { const m = item.match(new RegExp("<" + t + ">([\\s\\S]*?)</" + t + ">", "i")); return m ? decodeEnt(m[1].replace(/^<!\[CDATA\[|\]\]>$/g, "").trim()) : ""; };
  const title = tag("title"), link = tag("link"), pub = tag("pubDate");
  let num = NaN, m;
  if ((m = title.match(/(?:ep(?:isode)?|ch(?:apter)?|cap(?:[ií]tulo)?)\.?\s*(\d+(?:\.\d+)?)/i))) num = parseFloat(m[1]);
  else if ((m = link.match(/episode_no=(\d+)/))) num = Number(m[1]);
  if (!isFinite(num)) return null;
  return { num, label: title.slice(0, 80), at: Date.parse(pub) || null, url: link || null };
}
async function webtoonLatest(rss) {
  const r = await fetch(rss, { headers: { "User-Agent": "Mozilla/5.0 (compatible; BetoroChanLista/1.0)" } });
  if (!r.ok) throw new Error("Webtoon " + r.status);
  return webtoonParse(await r.text());
}

/* ---------------- Shonen Jump+ e sites parecidos (RSS oficial) ---------------- */
const UA = { "User-Agent": "Mozilla/5.0 (compatible; BetoroChanLista/1.0)" };
export function gigaParse(xml) {
  const items = [...String(xml).matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m => m[1]);
  let best = null;
  for (const it of items) {
    const tag = t => { const m = it.match(new RegExp("<" + t + ">([\\s\\S]*?)</" + t + ">", "i")); return m ? decodeEnt(m[1].replace(/^<!\[CDATA\[|\]\]>$/g, "").trim()) : ""; };
    const title = tag("title"), link = tag("link"), pub = tag("pubDate");
    const m = title.match(/第\s*(\d+(?:\.\d+)?)\s*話/) || title.match(/(?:ep(?:isode)?|ch(?:apter)?)\.?\s*(\d+(?:\.\d+)?)/i) || title.match(/[#＃]\s*(\d+(?:\.\d+)?)/);
    if (!m) continue;
    const num = parseFloat(m[1]);
    if (!best || num > best.num) best = { num, label: title.slice(0, 80), at: Date.parse(pub) || null, url: link || null };
  }
  return best;
}
async function gigaLatest(url) {
  let rss = url;
  if (!/\/rss\/series\/\d+/.test(url)) {               // página da série ou de um capítulo: acha o feed nela
    const r = await fetch(url, { headers: UA });
    if (!r.ok) throw new Error("Jump+ " + r.status);
    const m = (await r.text()).match(/https?:\/\/[^"'\s]+\/rss\/series\/\d+/);
    if (!m) throw new Error("Jump+: feed não encontrado na página");
    rss = m[0];
  }
  const r = await fetch(rss, { headers: UA });
  if (!r.ok) throw new Error("Jump+ RSS " + r.status);
  return gigaParse(await r.text());
}

/* ---------------- tradução gratuita ---------------- */
function chunks(text, max = 450) {
  const out = [];
  for (const para of text.split(/\n{2,}/)) {
    const sentences = para.replace(/\n/g, " ").match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [para];
    let cur = "";
    for (let s of sentences) {
      while (s.length > max) { if (cur) { out.push(cur.trim()); cur = ""; } out.push(s.slice(0, max)); s = s.slice(max); }
      if ((cur + s).length > max) { out.push(cur.trim()); cur = ""; }
      cur += s;
    }
    if (cur.trim()) out.push(cur.trim());
    out.push("\n\n");
  }
  out.pop();
  return out;
}
const decodeEnt = s => String(s).replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)).replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
// tradutor 1: MyMemory · tradutor 2 (reserva): Google Tradutor público. Os dois são gratuitos e sem cadastro.
async function mm(c) {
  const url = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(c) + "&langpair=en|pt-BR" + (MM_EMAIL ? "&de=" + encodeURIComponent(MM_EMAIL) : "");
  const r = await fetch(url);
  const j = await r.json().catch(() => ({}));
  const t = j && j.responseData && j.responseData.translatedText;
  if (!r.ok || Number(j.responseStatus) !== 200 || !t || /MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID/i.test(t)) throw new Error("MyMemory: " + (j.responseDetails || t || r.status));
  return decodeEnt(t).trim();
}
async function gt(c) {
  const r = await fetch("https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q=" + encodeURIComponent(c));
  const j = await r.json().catch(() => null);
  if (!r.ok || !Array.isArray(j) || !Array.isArray(j[0])) throw new Error("Google: " + r.status);
  return j[0].map(x => x[0]).join("").trim();
}
export async function translatePT(text) {
  let out = "";
  for (const c of chunks(text)) {
    if (c === "\n\n") { out = out.trimEnd() + "\n\n"; continue; }
    let t;
    try { t = await mm(c); } catch (e1) {
      try { t = await gt(c); } catch (e2) { throw new Error(e1.message + " | " + e2.message); }
    }
    out += t + " ";
    await sleep(700);
  }
  return out.trim().slice(0, 5900);
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
  if (relAt && now >= relAt + cadence - 12 * H) return since >= 10 * 60e3;   // perto do próximo: toda execução
  if (relAt && now - relAt < 2 * D) return since >= 6 * H;                   // acabou de sair
  return since >= 2 * H;
}

/* ---------------- principal ---------------- */
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const iso = t => (t == null ? null : new Date(t).toISOString());
function setRelease(w, patch, r, src, now) {
  if (!r || !isFinite(r.num)) return false;
  const cur = w.rel_num == null ? null : Number(w.rel_num);
  if (cur != null && r.num < cur) return false;            // nunca volta para trás
  if (cur != null && r.num === cur && (w.rel_at || !r.at)) return false;   // nada novo
  if (cur != null && r.num > cur && w.rel_at) patch.rel_prev_at = w.rel_at;
  patch.rel_num = r.num;
  patch.rel_label = String(r.label || "").slice(0, 80);
  patch.rel_at = iso(r.at || (cur == null ? null : now));
  patch.rel_url = r.url || null;
  patch.rel_src = src;
  return true;
}

export async function main() {
  if (!DRY && (!SB_URL || !SB_KEY)) { console.error("Faltam os segredos SUPABASE_URL e/ou SUPABASE_SERVICE_KEY no GitHub."); process.exit(1); }
  const now = Date.now();
  const works = await sb("works?select=*&limit=10000", { headers: { Prefer: "" } });
  log(`${works.length} obras no site.`);
  const patches = new Map(); const P = w => { if (!patches.has(w.id)) patches.set(w.id, {}); return patches.get(w.id); };
  let rels = 0, links = 0, trads = 0, erros = 0;

  // 1) AniList: dados oficiais, links e horários de anime
  const withAl = works.filter(w => w.anilist_id);
  const byAl = new Map(withAl.map(w => [w.anilist_id, w]));
  for (let i = 0; i < withAl.length; i += 50) {
    const ids = withAl.slice(i, i + 50).map(w => w.anilist_id);
    let media = [];
    try {
      const d = await anilist(`query($ids: [Int]) { Page(perPage: 50) { media(id_in: $ids) {
        id status episodes chapters volumes description(asHtml: false) coverImage { extraLarge large }
        nextAiringEpisode { episode airingAt } externalLinks { site url type language } } } }`, { ids });
      media = d.Page.media;
    } catch (e) { erros++; log("AniList falhou:", e.message); continue; }
    for (const m of media) {
      const w = byAl.get(m.id); if (!w) continue;
      const p = P(w);
      const l = pickLinks(m.externalLinks);
      // links escolhidos à mão pelo ADM (marcados com adm: true) nunca são trocados
      if (l.length && !same(l, w.links) && !(w.links || []).some(x => x && x.adm)) { p.links = l; links++; }
      if (!w.feed) { const f = feedFromLinks(m.externalLinks); if (f) p.feed = f; }
      if (!w.synopsis_en && m.description) p.synopsis_en = cleanSyn(m.description);
      if (!w.cover_url && m.coverImage) p.cover_url = m.coverImage.extraLarge || m.coverImage.large || null;
      const st = STATUS_PT[m.status]; if (st && st !== w.status) p.status = st;
      const total = w.kind === "anime" ? m.episodes : w.kind === "novel" ? (m.volumes ?? m.chapters) : m.chapters;
      if (total != null && total !== w.total) p.total = total;
      if (w.kind === "anime") {
        const n = m.nextAiringEpisode;
        const nn = n ? n.episode : null, na = n ? iso(n.airingAt * 1000) : null;
        if (nn !== w.next_num) p.next_num = nn;
        if (na !== (w.next_at ? iso(Date.parse(w.next_at)) : null)) p.next_at = na;
        if (!n && m.status === "FINISHED" && m.episodes && (w.rel_num == null || Number(w.rel_num) < m.episodes))
          if (setRelease(w, p, { num: m.episodes, label: "", at: null }, "anilist", now)) rels++;
      }
    }
  }

  // episódios de anime que já passaram (últimos 30 dias)
  const animeIds = withAl.filter(w => w.kind === "anime" && !isFinished(w.status)).map(w => w.anilist_id);
  for (let i = 0; i < animeIds.length; i += 50) {
    const ids = animeIds.slice(i, i + 50);
    try {
      const d = await anilist(`query($ids: [Int], $from: Int, $to: Int) { Page(perPage: 50) {
        airingSchedules(mediaId_in: $ids, airingAt_greater: $from, airingAt_lesser: $to, sort: TIME_DESC) { mediaId episode airingAt } } }`,
        { ids, from: Math.floor((now - 30 * D) / 1000), to: Math.floor(now / 1000) });
      const latest = new Map();
      for (const s of d.Page.airingSchedules) if (!latest.has(s.mediaId)) latest.set(s.mediaId, s);
      for (const [mid, s] of latest) {
        const w = byAl.get(mid); if (!w) continue;
        if (setRelease(w, P(w), { num: s.episode, label: "", at: s.airingAt * 1000 }, "anilist", now)) rels++;
      }
    } catch (e) { erros++; log("Horários do AniList falharam:", e.message); }
  }

  // 2) MANGA Plus e Webtoon (mangás/novels)
  for (const w of works) {
    if (w.kind === "anime") continue;
    const feed = (patches.get(w.id) || {}).feed || w.feed;
    if (!feed || !feedDue(w, now)) continue;
    const p = P(w);
    try {
      let r = null, src = "";
      if (feed.startsWith("mangaplus:")) { r = await mangaPlusLatest(feed.slice(10)); src = "mangaplus"; await sleep(1100); }
      else if (feed.startsWith("webtoon:")) { r = await webtoonLatest(feed.slice(8)); src = "webtoon"; await sleep(800); }
      else if (feed.startsWith("gigaviewer:")) { r = await gigaLatest(feed.slice(11)); src = "jumpplus"; await sleep(1000); }
      p.rel_checked_at = iso(now);
      if (r && setRelease(w, p, r, src, now)) { rels++; log(`  novo: ${w.title} → ${r.label || r.num}`); }
    } catch (e) { erros++; p.rel_checked_at = iso(now); log(`  ${w.title}: ${e.message}`); }
  }

  // 3) tradução gratuita da sinopse
  for (const w of works) {
    if (trads >= MAX_TRAD) break;
    const en = (patches.get(w.id) || {}).synopsis_en || w.synopsis_en;
    if (w.synopsis || !en) continue;
    try { const pt = await translatePT(en); if (pt) { const p = P(w); p.synopsis = pt; p.syn_src = "gratis"; trads++; log(`  traduzida: ${w.title}`); } }
    catch (e) { erros++; log("Tradução falhou:", e.message); break; }
  }

  // 4) salva só o que mudou
  let salvas = 0;
  for (const [id, p] of patches) {
    if (!Object.keys(p).length) continue;
    if (DRY) { log("  (teste) mudaria", id, JSON.stringify(p).slice(0, 200)); salvas++; continue; }
    try { await sb(`works?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(p) }); salvas++; }
    catch (e) { erros++; log("Salvar falhou:", e.message); }
  }
  log(`Pronto. ${rels} lançamentos novos, ${links} listas de links, ${trads} sinopses traduzidas, ${salvas} obras atualizadas, ${erros} avisos.`);
}

import { pathToFileURL } from "node:url";
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(e => { console.error(e); process.exit(1); });
