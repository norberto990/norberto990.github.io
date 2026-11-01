// Atualização diária da Lista de Animes do Betoro-chan.
// Roda no GitHub Actions todo dia às 9:30 (horário de Brasília).
//  1. Busca no AniList os animes, mangás e novels que começaram nos últimos dias.
//  2. Atualiza situação, episódios/capítulos e capa das obras que ainda estão saindo.
//  3. Completa as obras que a galera cadastrou na mão (sinopse, capa, gêneros...).
// Precisa de duas variáveis: SUPABASE_URL e SUPABASE_SERVICE_KEY (segredos do GitHub).

const SB_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const DAYS   = Number(process.env.SYNC_DAYS || 45);
const LIMIT  = { anime: Number(process.env.LIMIT_ANIME || 40), manga: Number(process.env.LIMIT_MANGA || 25), novel: Number(process.env.LIMIT_NOVEL || 15) };
const DRY    = process.env.DRY_RUN === "1";

if (!DRY && (!SB_URL || !SB_KEY)) {
  console.error("Faltam os segredos SUPABASE_URL e/ou SUPABASE_SERVICE_KEY no GitHub.");
  process.exit(1);
}

const KINDS = {
  anime: { type: "ANIME", formats: ["TV", "TV_SHORT", "MOVIE", "ONA", "OVA", "SPECIAL"] },
  manga: { type: "MANGA", formats: ["MANGA", "ONE_SHOT"] },
  novel: { type: "MANGA", formats: ["NOVEL"] },
};
const FORMAT_PT = { TV: "TV", TV_SHORT: "TV (curto)", MOVIE: "Filme", ONA: "ONA", OVA: "OVA", SPECIAL: "Especial", MANGA: "Mangá", ONE_SHOT: "One-shot", NOVEL: "Light novel" };
const STATUS_PT = { FINISHED: "Finalizado", RELEASING: "Em lançamento", NOT_YET_RELEASED: "Ainda não lançado", CANCELLED: "Cancelado", HIATUS: "Em hiato" };
const SOURCE_PT = { ORIGINAL: "Original", MANGA: "Mangá", LIGHT_NOVEL: "Light novel", WEB_NOVEL: "Web novel", NOVEL: "Novel", VISUAL_NOVEL: "Visual novel", VIDEO_GAME: "Jogo", GAME: "Jogo", WEB_MANGA: "Web mangá", OTHER: "Outro" };
const GENRE_PT = { Action: "Ação", Adventure: "Aventura", Comedy: "Comédia", Drama: "Drama", Ecchi: "Ecchi", Fantasy: "Fantasia", Horror: "Terror", "Mahou Shoujo": "Mahou Shoujo", Mecha: "Mecha", Music: "Música", Mystery: "Mistério", Psychological: "Psicológico", Romance: "Romance", "Sci-Fi": "Ficção científica", "Slice of Life": "Slice of life", Sports: "Esportes", Supernatural: "Sobrenatural", Thriller: "Suspense" };

const FIELDS = `id idMal format status episodes chapters volumes source isAdult
  title { romaji english native } synonyms startDate { year }
  genres coverImage { extraLarge large } description(asHtml: false)
  studios(isMain: true) { nodes { name } }
  staff(perPage: 2, sort: RELEVANCE) { edges { role node { name { full } } } }`;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function anilist(query, variables, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    if (r.status === 429) { const wait = Number(r.headers.get("retry-after") || 30); console.log(`AniList pediu para esperar ${wait}s…`); await sleep((wait + 1) * 1000); continue; }
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.errors) { if (i === tries - 1) throw new Error("AniList: " + JSON.stringify(j.errors || r.status)); await sleep(3000); continue; }
    await sleep(2200); // fica bem abaixo do limite de pedidos do AniList
    return j.data;
  }
}

async function sb(path, opts = {}) {
  const r = await fetch(SB_URL + "/rest/v1/" + path, {
    ...opts,
    headers: { apikey: SB_KEY, ...(SB_KEY.startsWith("eyJ") ? { Authorization: "Bearer " + SB_KEY } : {}), "Content-Type": "application/json", Prefer: "return=minimal", ...(opts.headers || {}) },
  });
  if (!r.ok) throw new Error(`Supabase ${opts.method || "GET"} ${path}: ${r.status} ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const slugify = s => norm(s).replace(/[^a-z0-9 ]/g, "").trim().replace(/ +/g, "-").slice(0, 100) || "obra";
const clean = s => String(s || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#039;/g, "'").replace(/\n{3,}/g, "\n\n").trim().slice(0, 5900);

function toWork(m, kind) {
  const title = m.title.romaji || m.title.english || m.title.native;
  const alts = [m.title.english, m.title.native, ...(m.synonyms || [])].filter(Boolean).filter((v, i, a) => v !== title && a.indexOf(v) === i);
  let alt = ""; for (const a of alts) { if ((alt + " · " + a).length > 590) break; alt = alt ? alt + " · " + a : a; }
  const author = kind === "anime"
    ? (m.studios?.nodes || []).map(s => s.name).join(", ")
    : (m.staff?.edges || []).filter(e => /story|original|art/i.test(e.role)).map(e => e.node.name.full).filter((v, i, a) => a.indexOf(v) === i).join(", ");
  return {
    kind, title: title.slice(0, 160), alt_titles: alt,
    cover_url: m.coverImage?.extraLarge || m.coverImage?.large || null,
    synopsis: clean(m.description),
    genres: (m.genres || []).map(g => GENRE_PT[g] || g).join(", ").slice(0, 300),
    format: FORMAT_PT[m.format] || m.format || "",
    total: kind === "anime" ? (m.episodes ?? null) : kind === "novel" ? (m.volumes ?? m.chapters ?? null) : (m.chapters ?? null),
    status: STATUS_PT[m.status] || "",
    year: m.startDate?.year ?? null,
    studio: author.slice(0, 200),
    source: SOURCE_PT[m.source] || "",
    anilist_id: m.id, mal_id: m.idMal ?? null, auto: true,
  };
}

function ymd(d) { return Number(d.toISOString().slice(0, 10).replace(/-/g, "")); }

async function main() {
  const since = ymd(new Date(Date.now() - DAYS * 864e5));
  console.log(`Buscando obras que começaram depois de ${since}…`);

  const existing = DRY ? [] : await sb("works?select=id,kind,slug,title,alt_titles,anilist_id,auto,cover_url,synopsis,genres,format,total,status,year,studio,source&limit=10000", { headers: { Prefer: "" } });
  const byAni = new Map(existing.filter(w => w.anilist_id).map(w => [w.anilist_id, w]));
  const slugs = new Set(existing.map(w => w.kind + ":" + w.slug));
  let added = 0, updated = 0, linked = 0;

  // 1) novidades
  for (const [kind, cfg] of Object.entries(KINDS)) {
    const q = `query($type: MediaType, $formats: [MediaFormat], $after: FuzzyDateInt, $n: Int) {
      Page(page: 1, perPage: $n) { media(type: $type, format_in: $formats, startDate_greater: $after, isAdult: false, sort: POPULARITY_DESC) { ${FIELDS} } } }`;
    const data = await anilist(q, { type: cfg.type, formats: cfg.formats, after: since, n: LIMIT[kind] });
    const media = data.Page.media.filter(m => !m.isAdult);
    const fresh = [];
    for (const m of media) {
      if (byAni.has(m.id)) continue;
      const w = toWork(m, kind);
      let slug = slugify(w.title); if (slugs.has(kind + ":" + slug)) slug = (slug + "-" + m.id).slice(0, 120);
      slugs.add(kind + ":" + slug); w.slug = slug;
      fresh.push(w); byAni.set(m.id, w);
    }
    console.log(`${kind}: ${media.length} encontrados, ${fresh.length} novos.`);
    if (fresh.length && !DRY) await sb("works", { method: "POST", body: JSON.stringify(fresh) });
    if (DRY) fresh.slice(0, 3).forEach(w => console.log("  +", w.title, "|", w.format, "|", w.total, "|", w.genres));
    added += fresh.length;
  }

  // 2) atualiza obras automáticas que ainda estão saindo
  const live = existing.filter(w => w.anilist_id && w.auto && /lançamento|ainda não|hiato/i.test(w.status)).map(w => w.anilist_id);
  for (let i = 0; i < live.length; i += 50) {
    const ids = live.slice(i, i + 50);
    const data = await anilist(`query($ids: [Int]) { Page(perPage: 50) { media(id_in: $ids) { ${FIELDS} } } }`, { ids });
    for (const m of data.Page.media) {
      const old = byAni.get(m.id); if (!old) continue;
      const w = toWork(m, old.kind);
      const patch = {};
      if (w.status && w.status !== old.status) patch.status = w.status;
      if (w.total != null && w.total !== old.total) patch.total = w.total;
      if (!old.cover_url && w.cover_url) patch.cover_url = w.cover_url;
      if (!old.synopsis && w.synopsis) patch.synopsis = w.synopsis;
      if (Object.keys(patch).length) { await sb(`works?id=eq.${old.id}`, { method: "PATCH", body: JSON.stringify(patch) }); updated++; }
    }
  }

  // 3) completa obras cadastradas na mão (até 15 por dia)
  const manual = existing.filter(w => !w.anilist_id && !w.auto).slice(0, 15);
  for (const old of manual) {
    const cfg = KINDS[old.kind];
    const data = await anilist(`query($q: String, $type: MediaType, $formats: [MediaFormat]) {
      Page(perPage: 5) { media(search: $q, type: $type, format_in: $formats, isAdult: false, sort: SEARCH_MATCH) { ${FIELDS} } } }`,
      { q: old.title, type: cfg.type, formats: cfg.formats });
    const names = new Set([old.title, ...String(old.alt_titles || "").split(/\s*[·,]\s*/)].map(norm).filter(Boolean));
    const hit = data.Page.media.find(m => [m.title.romaji, m.title.english, m.title.native, ...(m.synonyms || [])].some(t => {
      const n = norm(t); if (!n) return false;
      if (names.has(n)) return true;
      // "Frieren" casa com "Sousou no Frieren" / "Frieren: Beyond Journey's End"
      return [...names].some(x => x.length >= 5 && (n.startsWith(x + " ") || n.endsWith(" " + x)));
    }));
    if (!hit || byAni.has(hit.id)) continue;
    const w = toWork(hit, old.kind);
    const patch = { anilist_id: hit.id, mal_id: w.mal_id };
    for (const k of ["cover_url", "synopsis", "genres", "format", "status", "studio", "source"]) if (!old[k] && w[k]) patch[k] = w[k];
    if (old.total == null && w.total != null) patch.total = w.total;
    if (old.year == null && w.year != null) patch.year = w.year;
    const extra = [w.title, ...String(w.alt_titles || "").split(" · ")].filter(a => a && !names.has(norm(a)));
    if (extra.length) patch.alt_titles = [old.alt_titles, ...extra].filter(Boolean).join(" · ").slice(0, 600);
    if (!DRY) await sb(`works?id=eq.${old.id}`, { method: "PATCH", body: JSON.stringify(patch) });
    byAni.set(hit.id, old); linked++;
    console.log(`  completada: ${old.title} → ${w.title}`);
  }

  console.log(`Pronto. ${added} obras novas, ${updated} atualizadas, ${linked} completadas.`);
}

main().catch(e => { console.error(e); process.exit(1); });
